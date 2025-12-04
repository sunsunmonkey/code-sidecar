import { ApiConfiguration, ApiHandler, HistoryItem } from "./apiHandler";
import { AgentWebviewProvider } from "../ui/AgentWebviewProvider";
import { ToolExecutor } from "../tools";
import { PromptBuilder } from "../managers/PromptBuilder";
import { XMLParser } from "fast-xml-parser";
import { ContextCollector, ProjectContext } from "../managers/ContextCollector";
import { ErrorHandler, ErrorContext } from "../managers/ErrorHandler";

/**
 * Text content in assistant message
 */
export type TextContent = {
  type: "text";
  content: string;
};

/**
 * Tool use request from assistant
 */
export type ToolUse = {
  type: "tool_use";
  name: string;
  params: Record<string, any>;
};

/**
 * Tool execution result
 */
export type ToolResult = {
  type: "tool_result";
  tool_name: string;
  content: string;
  is_error: boolean;
};

/**
 * Content types in assistant message
 */
export type AssistantMessageContent = ToolUse | TextContent;

/**
 * Task class manages the ReAct (Reasoning and Acting) loop
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */
export class Task {
  private systemPrompt: string = "";
  private history: HistoryItem[] = [];
  private loopCount: number = 0;
  private readonly MAX_LOOPS: number = 5;
  private readonly id: string;
  private toolExecutor: ToolExecutor;
  private promptBuilder?: PromptBuilder;
  private contextCollector: ContextCollector;
  private context?: ProjectContext;
  private conversationHistoryManager?: any; // ConversationHistoryManager
  private errorHandler: ErrorHandler;

  constructor(
    private provider: AgentWebviewProvider,
    private apiConfiguration: ApiConfiguration,
    private message: string,
    toolExecutor?: ToolExecutor,
    promptBuilder?: PromptBuilder,
    contextCollector?: ContextCollector,
    conversationHistoryManager?: any,
    errorHandler?: ErrorHandler
  ) {
    this.id = `task-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 11)}`;
    this.toolExecutor = toolExecutor || new ToolExecutor();
    this.promptBuilder = promptBuilder;
    this.contextCollector = contextCollector || new ContextCollector();
    this.conversationHistoryManager = conversationHistoryManager;
    this.errorHandler = errorHandler || new ErrorHandler();
  }

  /**
   * Start the task and initiate the ReAct loop
   */
  async start() {
    try {
      // Load conversation history if available
      // TODO webview 恢复？？？
      if (this.conversationHistoryManager) {
        const previousMessages =
          this.conversationHistoryManager.getTruncatedMessages();
        this.history = [...previousMessages];
        console.log(
          `[Task ${this.id}] Loaded ${previousMessages.length} messages from history`
        );
      }

      // Collect context before starting
      console.log(`[Task ${this.id}] Collecting project context...`);
      this.context = await this.contextCollector.collectContext();

      // Format user message with context (Requirement 8.1, 8.4)
      const messageWithContext = this.formatUserMessageWithContext(
        this.message,
        this.context
      );

      const userMessage: HistoryItem = {
        role: "user",
        content: messageWithContext,
      };
      this.history.push(userMessage);

      // Save user message to history
      if (this.conversationHistoryManager) {
        this.conversationHistoryManager.addMessage(userMessage);
      }

      await this.recursivelyMakeRequest(this.history);
    } catch (error) {
      // Handle errors at the top level (Requirements 12.1, 12.2, 12.3, 12.4, 12.5)
      this.handleTaskError(error, "task_start");
    }
  }

  /**
   * Format user message with context information
   * Requirements: 8.1, 8.3, 8.4
   */
  private formatUserMessageWithContext(
    message: string,
    context: ProjectContext
  ): string {
    const parts: string[] = [];

    // Add user message first
    parts.push("# User Request");
    parts.push(message);

    // Add context information
    const contextStr = this.contextCollector.formatContext(context);
    if (contextStr) {
      parts.push("\n# Project Context");
      parts.push(contextStr);
    }

    return parts.join("\n");
  }

  /**
   * Recursively execute the ReAct loop
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 12.1, 12.2, 12.3, 12.4, 12.5
   */
  private async recursivelyMakeRequest(history: HistoryItem[]) {
    try {
      // Check loop count limit (Requirement 6.7)
      if (!this.shouldContinueLoop()) {
        this.provider.postMessageToWebview({
          type: "error",
          message: `已达到最大循环次数限制 (${this.MAX_LOOPS})。任务可能过于复杂，请简化任务或分解为多个步骤。`,
        });
        this.provider.postMessageToWebview({ type: "task_complete" });
        return;
      }

      this.loopCount++;

      const apiHandler = new ApiHandler(this.apiConfiguration);
      const systemPrompt = await this.getSystemPrompt();
      // Stream LLM response (Requirement 6.1)
      const stream = apiHandler.createMessage(systemPrompt, history);

      let assistantMessage = "";
      for await (const chunk of stream) {
        assistantMessage += chunk;
        this.provider.postMessageToWebview({
          type: "stream_chunk",
          content: chunk,
          isStreaming: true,
        });
      }
      this.provider.postMessageToWebview({
        type: "stream_chunk",
        content: "",
        isStreaming: false,
      });
      console.log(
        `[Task ${this.id}] Loop ${this.loopCount}: Assistant response received`
      );

      // Add assistant message to history
      const assistantHistoryItem: HistoryItem = {
        role: "assistant",
        content: assistantMessage,
      };
      this.history.push(assistantHistoryItem);

      // Save assistant message to history
      if (this.conversationHistoryManager) {
        this.conversationHistoryManager.addMessage(assistantHistoryItem);
      }

      // Parse assistant message for tool calls (Requirement 6.1, 6.2)
      const assistantContent = this.parseAssistantMessage(assistantMessage);
      const toolCalls = assistantContent.filter(
        (content): content is ToolUse => content.type === "tool_use"
      );

      // If no tool calls found, prompt LLM to use tools (Requirement 6.6)
      if (toolCalls.length === 0) {
        console.log(
          `[Task ${this.id}] No tool calls found, prompting to use tools`
        );

        // Check if this is a completion scenario or if we need to prompt for tool use
        const hasTextContent = assistantContent.some((c) => c.type === "text");

        if (hasTextContent) {
          // LLM provided reasoning but no tool - prompt to use a tool
          this.history.push({ role: "user", content: this.noToolsUsed() });
          await this.recursivelyMakeRequest(this.history);
        } else {
          // Empty response - end the loop
          console.log(`[Task ${this.id}] Empty response, ending ReAct loop`);
          this.provider.postMessageToWebview({ type: "task_complete" });
        }
        return;
      }

      // Check if attempt_completion was called
      const hasCompletion = this.hasAttemptCompletion(toolCalls);

      // Execute tool calls and get results
      const toolResults = await this.handleToolCalls(toolCalls);

      // Add tool results to history as user messages
      for (const result of toolResults) {
        const resultMessage = this.formatToolResult(result);
        const toolResultHistoryItem: HistoryItem = {
          role: "user",
          content: resultMessage,
        };
        this.history.push(toolResultHistoryItem);

        // Save tool result to history
        if (this.conversationHistoryManager) {
          this.conversationHistoryManager.addMessage(toolResultHistoryItem);
        }

        this.provider.postMessageToWebview({
          type: "tool_result",
          result: result,
        });
      }

      // If attempt_completion was called, end the ReAct loop (Requirement 6.6)
      if (hasCompletion) {
        console.log(
          `[Task ${this.id}] Task completion requested, ending ReAct loop`
        );
        this.provider.postMessageToWebview({ type: "task_complete" });
        return;
      }

      // Continue the ReAct loop (Requirement 6.4, 6.5)
      await this.recursivelyMakeRequest(this.history);
    } catch (error) {
      // Handle errors in ReAct loop (Requirements 12.1, 12.2, 12.3, 12.4, 12.5)
      await this.handleTaskError(error, `react_loop_${this.loopCount}`);
    }
  }

  /**
   * Parse assistant message to extract text and tool calls
   * Supports multiple tool calls in a single message
   * Requirements: 6.1, 6.2
   */
  private parseAssistantMessage(
    assistantMessage: string
  ): AssistantMessageContent[] {
    const contents: AssistantMessageContent[] = [];

    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        parseTagValue: false,
        trimValues: false,
      });

      // Try to parse XML tool calls
      const parsed = parser.parse(assistantMessage);

      // Extract all tool calls from parsed content
      for (const key in parsed) {
        if (typeof parsed[key] === "object" && parsed[key] !== null) {
          // This is a potential tool call
          contents.push({
            type: "tool_use",
            name: key,
            params: parsed[key],
          });
        }
      }

      // If we found tool calls, also extract any text content
      if (contents.length > 0) {
        // Extract text that's not part of XML tags
        const textContent = assistantMessage
          .replace(/<[^>]+>.*?<\/[^>]+>/gs, "")
          .trim();
        if (textContent) {
          contents.unshift({
            type: "text",
            content: textContent,
          });
        }
      }
    } catch (error) {
      // If parsing fails, treat entire message as text
      console.log(
        `[Task ${this.id}] XML parsing failed, treating as text:`,
        error
      );
    }

    // If no tool calls were found, return the entire message as text
    if (contents.length === 0) {
      contents.push({
        type: "text",
        content: assistantMessage,
      });
    }

    return contents;
  }

  /**
   * Handle multiple tool calls
   * Requirements: 6.2, 6.3, 6.6, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7
   */
  private async handleToolCalls(toolCalls: ToolUse[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const toolCall of toolCalls) {
      console.log(`[Task ${this.id}] Executing tool: ${toolCall.name}`);

      this.provider.postMessageToWebview({
        type: "tool_call",
        toolCall: toolCall,
      });

      // Execute tool using ToolExecutor (Requirements 13.1-13.7)
      const result = await this.toolExecutor.executeTool(toolCall);

      results.push(result);
    }

    return results;
  }

  /**
   * Check if any tool call is attempt_completion
   * Requirement 6.6
   */
  private hasAttemptCompletion(toolCalls: ToolUse[]): boolean {
    return toolCalls.some((toolCall) => toolCall.name === "attempt_completion");
  }

  /**
   * Format tool result for adding to conversation history
   * Requirement 6.3
   */
  private formatToolResult(result: ToolResult): string {
    if (result.is_error) {
      return `[TOOL ERROR: ${result.tool_name}]\n${result.content}`;
    }
    return `[TOOL RESULT: ${result.tool_name}]\n${result.content}`;
  }

  /**
   * Check if the loop should continue
   * Requirement 6.7
   */
  private shouldContinueLoop(): boolean {
    return this.loopCount < this.MAX_LOOPS;
  }

  /**
   * Get system prompt - uses PromptBuilder if available, otherwise falls back to file
   * Requirements: 6.1, 7.1, 13.1, 13.2
   */
  private async getSystemPrompt(): Promise<string> {
    if (this.systemPrompt) {
      return this.systemPrompt;
    }

    // Use PromptBuilder if available (dynamic prompt generation)
    if (this.promptBuilder) {
      this.systemPrompt = this.promptBuilder.buildSystemPrompt();
      return this.systemPrompt;
    }

    // Fallback: use static prompt file (for backward compatibility)
    // This will be removed once PromptBuilder is fully integrated
    const fs = await import("fs/promises");
    const path = await import("path");
    this.systemPrompt = await fs.readFile(
      path.join(
        this.provider.context.extensionPath,
        "assets",
        "systemPrompt.md"
      ),
      {
        encoding: "utf-8",
      }
    );
    return this.systemPrompt;
  }

  /**
   * Get task ID
   */
  public getId(): string {
    return this.id;
  }

  /**
   * Get current loop count
   */
  public getLoopCount(): number {
    return this.loopCount;
  }

  /**
   * Get tool executor
   */
  public getToolExecutor(): ToolExecutor {
    return this.toolExecutor;
  }

  /**
   * Get context collector
   */
  public getContextCollector(): ContextCollector {
    return this.contextCollector;
  }

  /**
   * Get collected context
   */
  public getContext(): ProjectContext | undefined {
    return this.context;
  }

  /**
   * Get error handler
   */
  public getErrorHandler(): ErrorHandler {
    return this.errorHandler;
  }

  /**
   * Handle task errors with error handler
   * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
   */
  private async handleTaskError(
    error: unknown,
    operation: string
  ): Promise<void> {
    const errorContext: ErrorContext = {
      operation,
      timestamp: new Date(),
      userMessage: this.message,
      additionalInfo: {
        taskId: this.id,
        loopCount: this.loopCount,
      },
    };

    // Handle the error and get response
    const errorResponse = this.errorHandler.handleError(error, errorContext);

    // Display error message to user (Requirement 12.1, 12.2, 12.3)
    this.provider.postMessageToWebview({
      type: "error",
      message: errorResponse.userMessage,
    });

    // Attempt recovery if error is retryable (Requirement 12.4, 12.5)
    if (errorResponse.shouldRetry) {
      const canRecover = await this.errorHandler.attemptRecovery(
        error,
        errorContext
      );

      if (canRecover) {
        console.log(`[Task ${this.id}] Attempting recovery for ${operation}`);

        // For network errors, retry the request
        if (this.errorHandler.isRetryable(error)) {
          // Wait a bit before retrying
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Retry the request
          try {
            await this.recursivelyMakeRequest(this.history);

            // Reset retry attempts on success
            this.errorHandler.resetRetryAttempts(operation);
            return;
          } catch (retryError) {
            // If retry fails, handle it again
            await this.handleTaskError(retryError, operation);
            return;
          }
        }
      }
    }

    // If no recovery or recovery failed, end the task
    console.error(`[Task ${this.id}] Task failed due to error in ${operation}`);
    this.provider.postMessageToWebview({ type: "task_complete" });
  }

  /**
   * Generate error message when LLM doesn't use tools
   * This prompts the LLM to use the proper tool format
   */
  private noToolsUsed(): string {
    return `[ERROR] You did not use a tool in your previous response! Please retry with a tool use.

# Reminder: Instructions for Tool Use

Tool uses are formatted using XML-style tags. The tool name itself becomes the XML tag name. Each parameter is enclosed within its own set of tags. Here's the structure:

<actual_tool_name>
<parameter1_name>value1</parameter1_name>
<parameter2_name>value2</parameter2_name>
...
</actual_tool_name>

For example, to use the attempt_completion tool:

<attempt_completion>
<result>
I have completed the task...
</result>
</attempt_completion>

Always use the actual tool name as the XML tag name for proper parsing and execution.
`;
  }
}
