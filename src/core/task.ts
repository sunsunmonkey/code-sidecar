import {
  ApiConfiguration,
  ApiHandler,
  HistoryItem,
  OpenAIHistoryItem,
  TokenUsage,
} from "./apiHandler";
import { AgentWebviewProvider } from "../ui/AgentWebviewProvider";
import { ToolExecutor } from "../tools";
import { PromptBuilder } from "../managers/PromptBuilder";
import { ContextCollector, ProjectContext } from "../managers/ContextCollector";
import { ErrorHandler, ErrorContext } from "../managers/ErrorHandler";
import { ConversationHistoryManager } from "../managers";
import {
  AssistantMessageContent,
  AssistantMessageParser,
  ToolUse,
} from "./assistantMessage";

/**
 * Tool execution result
 */
export type ToolResult = {
  type: "tool_result";
  tool_name: string;
  content: string;
  is_error: boolean;
};

export {
  AssistantMessageContent,
  AssistantMessageParser,
  ToolUse,
} from "./assistantMessage";

/**
 * Task class manages the ReAct (Reasoning and Acting) loop
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */
export class Task {
  private systemPrompt: string = "";
  private history: HistoryItem[] = [];
  private loopCount: number = 0;
  private readonly id: string;
  private toolExecutor: ToolExecutor;
  private promptBuilder: PromptBuilder;
  private contextCollector: ContextCollector;
  private context?: ProjectContext;
  private conversationHistoryManager: ConversationHistoryManager;
  private errorHandler: ErrorHandler;
  private contextWindowTokens: number;
  private isCancelled = false;
  private abortController: AbortController | null = null;

  constructor(
    private provider: AgentWebviewProvider,
    private apiConfiguration: ApiConfiguration,
    private message: string,
    private maxLoopCount: number,
    toolExecutor: ToolExecutor,
    promptBuilder: PromptBuilder,
    contextCollector: ContextCollector,
    conversationHistoryManager: ConversationHistoryManager,
    errorHandler: ErrorHandler,
    contextWindowTokens: number
  ) {
    this.id = `task-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 11)}`;
    this.maxLoopCount = maxLoopCount;
    this.toolExecutor = toolExecutor;
    this.promptBuilder = promptBuilder;
    this.contextCollector = contextCollector;
    this.conversationHistoryManager = conversationHistoryManager;
    this.errorHandler = errorHandler;
    this.contextWindowTokens = contextWindowTokens || 0;
  }

  /**
   * Start the task and initiate the ReAct loop
   */
  async start() {
    try {
      // Collect context before starting
      console.log(`[Task ${this.id}] Collecting project context...`);
      const context = await this.contextCollector.collectContext();

      this.context = context;
      const formattedContext = this.contextCollector.formatContext(context);
      // Format user message with context
      const messageWithContext = this.formatUserMessageWithContext(
        this.message,
        formattedContext
      );

      const userMessage: HistoryItem = {
        role: "user",
        content: messageWithContext,
      };

      this.history.push(userMessage);

      // Save user message to history
      // TODO 这块的 history 和 展示的, 思考vscode workspace context

      this.conversationHistoryManager.addMessage({
        role: "user",
        content: this.message,
      });
      console.log("save", this.message);
      await this.recursivelyMakeRequest(this.history);
    } catch (error) {
      this.handleTaskError(error, "task_start");
    }
  }

  /**
   * Format user message with context information
   */
  private formatUserMessageWithContext(
    message: string,
    contextText: string
  ): string {
    const parts: string[] = [];

    if (contextText) {
      parts.push("# Project Context");
      parts.push(contextText);
    }

    parts.push("# User Request");
    parts.push(message);

    return parts.join("\n");
  }

  /**
   * Recursively execute the ReAct loop
   */
  private async recursivelyMakeRequest(history: HistoryItem[]) {
    try {
      if (this.isCancelled) {
        console.log(
          `[Task ${this.id}] Cancelled before loop ${this.loopCount + 1}`
        );
        return;
      }

      // Check loop count limit
      if (!this.shouldContinueLoop()) {
        this.provider.postMessageToWebview({
          type: "error",
          message: `已达到最大循环次数限制 (${this.maxLoopCount})。任务可能过于复杂，请简化任务或分解为多个步骤。`,
        });
        this.provider.postMessageToWebview({ type: "task_complete" });
        return;
      }

      this.loopCount++;

      const apiHandler = new ApiHandler(this.apiConfiguration);
      const systemPrompt = await this.getSystemPrompt();

      history = history.map((item) => {
        if (item.role === "tool_result") {
          const content = this.formatToolResult(item.content as ToolResult);
          return {
            role: "user",
            content,
          };
        } else {
          return item;
        }
      });

      // Stream LLM response
      const stream = apiHandler.createMessage(
        systemPrompt,
        history as OpenAIHistoryItem,
        this.createAbortController().signal
      );

      const parser = this.createAssistantMessageParser();
      let assistantMessage = "";
      let usage: TokenUsage | undefined;
      for await (const chunk of stream) {
        if (this.isCancelled) {
          break;
        }
        if (chunk.type === "content") {
          assistantMessage += chunk.content;
          parser.processChunk(chunk.content);
          this.provider.postMessageToWebview({
            type: "stream_chunk",
            content: chunk.content,
            isStreaming: true,
          });
        } else if (chunk.type === "usage") {
          usage = chunk.usage;
        }
      }

      this.abortController = null;

      parser.finalizeContentBlocks();

      // completely stream
      this.provider.postMessageToWebview({
        type: "stream_chunk",
        content: "",
        isStreaming: false,
      });

      if (usage) {
        this.publishTokenUsage(usage);
      }

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
      this.conversationHistoryManager.addMessage(assistantHistoryItem);

      // Parse assistant message for tool calls
      const assistantContent = this.buildAssistantContent(
        parser.getContentBlocks(),
        assistantMessage
      );
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
        this.history.push({
          role: "tool_result",
          content: result,
        });

        this.provider.postMessageToWebview({
          type: "tool_result",
          content: result,
        });

        // TODO 优化！！！
        const messages = this.conversationHistoryManager.getMessages();
        const lastToolCallIndex = messages.findIndex(
          (msg) =>
            msg.toolCalls &&
            msg.toolCalls.some((tc) => tc.name === result.tool_name) &&
            !msg.toolResults
        );
        messages[lastToolCallIndex] = {
          ...messages[lastToolCallIndex],
          toolResults: [result],
        };
        this.conversationHistoryManager.updateMessages(messages);
      }

      // If attempt_completion was called, end the ReAct loop
      if (hasCompletion) {
        console.log(
          `[Task ${this.id}] Task completion requested, ending ReAct loop`
        );
        this.provider.postMessageToWebview({ type: "task_complete" });
        return;
      }

      // Continue the ReAct loop
      await this.recursivelyMakeRequest(this.history);
    } catch (error) {
      await this.handleTaskError(error, `react_loop_${this.loopCount}`);
    }
  }

  /**
   * Build parsed assistant content from the streaming parser,
   * falling back to treating the response as plain text if needed.
   */
  private buildAssistantContent(
    parsedBlocks: AssistantMessageContent[],
    assistantMessage: string
  ): AssistantMessageContent[] {
    if (parsedBlocks.length > 0) {
      return parsedBlocks;
    }

    return [
      {
        type: "text",
        content: assistantMessage.trim(),
        partial: false,
      },
    ];
  }

  /**
   * Create a streaming parser wired to the registered tool names and parameters.
   */
  private createAssistantMessageParser(): AssistantMessageParser {
    const toolNames = this.toolExecutor.getToolNames();
    const paramNames = this.getAllToolParameterNames(toolNames);
    return new AssistantMessageParser(toolNames, paramNames);
  }

  private getAllToolParameterNames(toolNames: string[]): string[] {
    const paramNames = new Set<string>();

    for (const toolName of toolNames) {
      const tool = this.toolExecutor.getTool(toolName);
      if (tool?.parameters) {
        for (const param of tool.parameters) {
          paramNames.add(param.name);
        }
      }
    }

    return Array.from(paramNames);
  }

  /**
   * Handle multiple tool calls
   */
  private async handleToolCalls(toolCalls: ToolUse[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const toolCall of toolCalls) {
      if (this.isCancelled) {
        break;
      }
      console.log(`[Task ${this.id}] Executing tool: ${toolCall.name}`);

      this.provider.postMessageToWebview({
        type: "tool_call",
        toolCall: toolCall,
      });

      this.conversationHistoryManager.addMessage({
        role: "system",
        content: "",
        toolCalls: [toolCall],
      });

      // Execute tool using ToolExecutor
      const result = await this.toolExecutor.executeTool(toolCall);

      results.push(result);
    }

    return results;
  }

  /**
   * Check if any tool call is attempt_completion
   */
  private hasAttemptCompletion(toolCalls: ToolUse[]): boolean {
    return toolCalls.some((toolCall) => toolCall.name === "attempt_completion");
  }

  /**
   * Format tool result for adding to conversation history
   */
  private formatToolResult(result: ToolResult): string {
    if (result.is_error) {
      return `[TOOL ERROR: ${result.tool_name}]\n${result.content}`;
    }
    return `[TOOL RESULT: ${result.tool_name}]\n${result.content}`;
  }

  /**
   * Check if the loop should continue
   */
  private shouldContinueLoop(): boolean {
    return this.loopCount < this.maxLoopCount;
  }

  /**
   * Get system prompt - uses PromptBuilder if available, otherwise falls back to file
   */
  private async getSystemPrompt(): Promise<string> {
    // TODO 这块缓存真的有用？？？
    if (this.systemPrompt) {
      return this.systemPrompt;
    }

    // Use PromptBuilder if available (dynamic prompt generation)
    this.systemPrompt = this.promptBuilder.buildSystemPrompt();
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
   * Cancel the running task
   */
  public cancel(): void {
    if (this.isCancelled) {
      return;
    }
    this.isCancelled = true;
    this.abortController?.abort();
    this.abortController = null;
    this.provider.postMessageToWebview({ type: "task_complete" });
  }

  /**
   * Publish token usage to the webview
   */
  private publishTokenUsage(usage: TokenUsage): void {
    const totalTokens = usage.totalTokens;
    this.provider.postMessageToWebview({
      type: "token_usage",
      usage: {
        totalTokens,
        availableTokens: this.contextWindowTokens,
      },
    });
  }

  /**
   * Handle task errors with error handler
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

  private createAbortController(): AbortController {
    this.abortController = new AbortController();
    return this.abortController;
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
