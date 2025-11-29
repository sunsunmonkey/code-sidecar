import { OpenAI } from "openai";

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
export type HistoryItem = OpenAI.Chat.Completions.ChatCompletionMessageParam;

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
  async *createMessage(systemPrompt: string, messages: HistoryItem[]) {
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
        };

      const { data: completion } = await client.chat.completions
        .create(request)
        .withResponse();

      for await (const chunk of completion) {
        if (chunk.choices[0].delta.content) {
          yield chunk.choices[0].delta.content;
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
