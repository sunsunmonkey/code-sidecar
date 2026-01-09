import {
  OpenAI,
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
  AuthenticationError,
  InternalServerError,
  PermissionDeniedError,
  RateLimitError,
} from "openai";
import type { ToolResult, ToolUse } from "code-sidecar-shared/types/tools";
import type { ApiConfiguration } from "code-sidecar-shared/types/api";
import { logger } from "code-sidecar-shared/utils/logger";
import { AppError } from "../managers/errorTypes";
import { ErrorType } from "code-sidecar-shared/types/errors";

/**
 * Message history item
 */
// TODO 收口这些消息
export type HistoryItem = {
  role: string;
  content: string | ToolResult;
  toolCalls?: ToolUse[];
  toolResults?: ToolResult[];
};

export type OpenAIHistoryItem =
  OpenAI.Chat.Completions.ChatCompletionMessageParam[];

export type TokenUsage = {
  totalTokens: number;
};

export type ChatStreamEvent =
  | { type: "content"; content: string }
  | { type: "usage"; usage: TokenUsage };

/**
 * API Handler for communicating with LLM service
 */
export class ApiHandler {
  private readonly MAX_API_ATTEMPTS = 3;
  private readonly BASE_RETRY_DELAY_MS = 500;
  private readonly MAX_RETRY_DELAY_MS = 8000;
  private readonly RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

  constructor(private apiConfiguration: ApiConfiguration) {}

  private createClient(): OpenAI {
    return new OpenAI({
      baseURL: this.apiConfiguration.baseUrl,
      apiKey: this.apiConfiguration.apiKey,
      maxRetries: 0,
    });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof APIError && typeof error.status === "number") {
      return `${error.message} (status ${error.status})`;
    }
    return error instanceof Error ? error.message : String(error);
  }

  private isAbortError(error: unknown, signal?: AbortSignal): boolean {
    return signal?.aborted === true || error instanceof APIUserAbortError;
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof APIConnectionError || error instanceof APIConnectionTimeoutError) {
      return true;
    }

    if (error instanceof RateLimitError || error instanceof InternalServerError) {
      return true;
    }

    if (error instanceof APIError) {
      const status = error.status ?? 0;
      return this.RETRYABLE_STATUS_CODES.has(status);
    }

    return false;
  }

  private getRetryDelayMs(error: unknown, attempt: number): number {
    if (error instanceof APIError) {
      const retryAfter = error.headers?.get("retry-after");
      if (retryAfter) {
        const seconds = Number(retryAfter);
        if (!Number.isNaN(seconds)) {
          return Math.max(0, seconds * 1000);
        }

        const dateMs = Date.parse(retryAfter);
        if (!Number.isNaN(dateMs)) {
          return Math.max(0, dateMs - Date.now());
        }
      }
    }

    const baseDelay = this.BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
    const jitter = Math.floor(Math.random() * 200);
    return Math.min(baseDelay + jitter, this.MAX_RETRY_DELAY_MS);
  }

  private async waitBeforeRetry(
    delayMs: number,
    signal?: AbortSignal
  ): Promise<void> {
    if (delayMs <= 0) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, delayMs);
      if (!signal) {
        return;
      }

      const onAbort = () => {
        clearTimeout(timer);
        reject(this.buildAbortError(signal?.reason));
      };

      if (signal.aborted) {
        onAbort();
        return;
      }

      signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  private buildFinalError(error: unknown, attempt: number): AppError {
    const technicalDetails = this.getErrorMessage(error);
    const attemptLabel = attempt === 1 ? "attempt" : "attempts";
    const errorType = this.getErrorType(error);
    const { userMessage, recoveryAction } = this.getUserFacingDetails(error);

    return new AppError({
      type: errorType,
      message: `API request failed after ${attempt} ${attemptLabel}: ${technicalDetails}`,
      userMessage,
      recoveryAction,
      technicalDetails,
      retryable: false,
      cause: error,
    });
  }

  private buildAbortError(error: unknown): AppError {
    const technicalDetails = this.getErrorMessage(error);
    return new AppError({
      type: ErrorType.SYSTEM_ERROR,
      message: "Request cancelled.",
      userMessage: "Request cancelled.",
      recoveryAction: "Retry the request when you are ready.",
      technicalDetails,
      retryable: false,
      cause: error,
    });
  }

  private getErrorType(error: unknown): ErrorType {
    if (error instanceof APIConnectionError || error instanceof APIConnectionTimeoutError) {
      return ErrorType.NETWORK_ERROR;
    }

    if (
      error instanceof APIError ||
      error instanceof RateLimitError ||
      error instanceof AuthenticationError ||
      error instanceof PermissionDeniedError ||
      error instanceof InternalServerError
    ) {
      return ErrorType.API_ERROR;
    }

    return ErrorType.API_ERROR;
  }

  private getUserFacingDetails(error: unknown): {
    userMessage: string;
    recoveryAction: string;
  } {
    if (error instanceof AuthenticationError) {
      return {
        userMessage: "API authentication failed. Please check your API key in settings.",
        recoveryAction: "Update your API key in the extension settings.",
      };
    }

    if (error instanceof PermissionDeniedError) {
      return {
        userMessage:
          "API permission denied. Please check your account and model access.",
        recoveryAction: "Verify your API permissions and model access.",
      };
    }

    if (error instanceof RateLimitError) {
      return {
        userMessage:
          "API rate limit exceeded. Please wait a moment before trying again.",
        recoveryAction: "Wait a few minutes and retry your request.",
      };
    }

    if (error instanceof APIConnectionError || error instanceof APIConnectionTimeoutError) {
      return {
        userMessage: "Network error while contacting the API.",
        recoveryAction: "Check your network connection and try again.",
      };
    }

    if (error instanceof InternalServerError) {
      return {
        userMessage: "API service is temporarily unavailable.",
        recoveryAction: "Try again in a few minutes.",
      };
    }

    return {
      userMessage: "API request failed.",
      recoveryAction: "Check your API configuration and try again.",
    };
  }

  /**
   * Create a streaming message request to the LLM
   * @param systemPrompt System prompt for the LLM
   * @param messages Conversation history
   * @param signal Optional abort signal to cancel the request
   * @returns AsyncGenerator yielding message chunks
   * @throws Error if API call fails (Requirements 12.1, 12.4)
   */
  async *createMessage(
    systemPrompt: string,
    messages: OpenAIHistoryItem,
    signal?: AbortSignal
  ): AsyncGenerator<ChatStreamEvent> {
    const client = this.createClient();
    const request: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
      stream: true,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      model: this.apiConfiguration.model,
      temperature: this.apiConfiguration.temperature,
      max_tokens: this.apiConfiguration.maxTokens,
      stream_options: { include_usage: true },
    };

    let attempt = 0;

    while (attempt < this.MAX_API_ATTEMPTS) {
      attempt += 1;
      let hasYieldedContent = false;

      if (signal?.aborted) {
        throw this.buildAbortError(signal.reason);
      }

      try {
        const { data: completion } = await client.chat.completions
          .create(request, { signal })
          .withResponse();

        for await (const chunk of completion) {
          const content = chunk.choices?.[0]?.delta?.content;

          if (content) {
            hasYieldedContent = true;
            yield { type: "content", content };
          }

          if (chunk.usage) {
            yield {
              type: "usage",
              usage: {
                totalTokens: chunk.usage.total_tokens ?? 0,
              },
            };
          }
        }

        return;
      } catch (error) {
        if (this.isAbortError(error, signal)) {
          throw this.buildAbortError(error);
        }

        const shouldRetry =
          this.isRetryableError(error) &&
          attempt < this.MAX_API_ATTEMPTS &&
          !hasYieldedContent;

        if (shouldRetry) {
          const delayMs = this.getRetryDelayMs(error, attempt - 1);
          logger.debug(
            `[ApiHandler] API request failed. Retrying attempt ${attempt + 1}/${this.MAX_API_ATTEMPTS} in ${delayMs}ms`,
            error
          );
          await this.waitBeforeRetry(delayMs, signal);
          continue;
        }

        throw this.buildFinalError(error, attempt);
      }
    }
  }

  /**
   * Validate API configuration
   * @returns Promise<boolean> indicating if configuration is valid
   */
  async validateConfiguration(): Promise<boolean> {
    try {
      const client = this.createClient();

      // Try a simple request to validate
      await client.models.list();
      return true;
    } catch (error) {
      logger.debug("API configuration validation failed:", error);
      return false;
    }
  }
}

