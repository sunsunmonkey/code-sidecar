import { OpenAI } from "openai";
import { ToolUse } from "./assistantMessage";
import { ToolResult } from "./task";

/**
 * API configuration for LLM service
 */
export type ApiConfiguration = {
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature?: number;
  maxTokens?: number;
};

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
  constructor(private apiConfiguration: ApiConfiguration) {}

  /**
   * Create a streaming message request to the LLM
   * @param systemPrompt System prompt for the LLM
   * @param messages Conversation history
   * @returns AsyncGenerator yielding message chunks
   * @throws Error if API call fails (Requirements 12.1, 12.4)
   */
  async *createMessage(
    systemPrompt: string,
    messages: OpenAIHistoryItem
  ): AsyncGenerator<ChatStreamEvent> {
    try {
      const client = new OpenAI({
        baseURL: this.apiConfiguration.baseUrl,
        apiKey: this.apiConfiguration.apiKey,
      });

      const request: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming =
        {
          stream: true,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          model: this.apiConfiguration.model,
          temperature: this.apiConfiguration.temperature,
          max_tokens: this.apiConfiguration.maxTokens,
          stream_options: { include_usage: true },
        };

      const { data: completion } = await client.chat.completions
        .create(request)
        .withResponse();

      for await (const chunk of completion) {
        const content = chunk.choices?.[0]?.delta?.content;

        if (content) {
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
    } catch (error) {
      // Re-throw with more context for error handler (Requirement 12.1)
      if (error instanceof Error) {
        throw new Error(`API request failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Validate API configuration
   * @returns Promise<boolean> indicating if configuration is valid
   */
  async validateConfiguration(): Promise<boolean> {
    try {
      const client = new OpenAI({
        baseURL: this.apiConfiguration.baseUrl,
        apiKey: this.apiConfiguration.apiKey,
      });

      // Try a simple request to validate
      await client.models.list();
      return true;
    } catch (error) {
      console.error("API configuration validation failed:", error);
      return false;
    }
  }
}
