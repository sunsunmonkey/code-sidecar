import {
  ApiHandler,
  HistoryItem,
  OpenAIHistoryItem,
  TokenUsage,
} from "./apiHandler";
import { AgentWebviewProvider } from "../ui/AgentWebviewProvider";
import { ToolExecutor } from "../tools";
import { PromptBuilder } from "../managers/PromptBuilder";
import { ContextCollector, ProjectContext } from "../managers/ContextCollector";
import { ErrorHandler } from "../managers/ErrorHandler";
import { ConversationHistoryManager } from "../managers";
import { TaskDiffTracker } from "./TaskDiffTracker";
import { logger } from "code-sidecar-shared/utils/logger";
import {
  buildAssistantContent,
  createAssistantMessageParser,
  getAssistantDisplayText,
  streamAssistantResponse,
} from "./assistantStreaming";
import {
  formatToolResult,
  hasAttemptCompletion,
  ToolCallHandler,
} from "./toolCallHandler";
import { TaskErrorHandler } from "./taskErrorHandler";

import type { ApiConfiguration } from "code-sidecar-shared/types/api";
import type { ToolUse, ToolResult } from "code-sidecar-shared/types/tools";

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
  private toolCallHandler: ToolCallHandler;
  private taskErrorHandler: TaskErrorHandler;
  private contextWindowTokens: number;
  private displayMessage: string;
  private isCancelled = false;
  private isCompleted = false;
  private abortController: AbortController | null = null;
  private diffTracker: TaskDiffTracker;

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
    contextWindowTokens: number,
    displayMessage?: string
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
    this.displayMessage = displayMessage ?? message;
    this.diffTracker = new TaskDiffTracker(this.id);
    this.toolCallHandler = new ToolCallHandler({
      taskId: this.id,
      toolExecutor: this.toolExecutor,
      conversationHistoryManager: this.conversationHistoryManager,
      publishToolCall: (toolCall) =>
        this.provider.postMessageToWebview({ type: "tool_call", toolCall }),
      isCancelled: () => this.isCancelled,
    });
    this.taskErrorHandler = new TaskErrorHandler({
      errorHandler: this.errorHandler,
      postMessage: (message) => this.provider.postMessageToWebview(message),
      getContext: () => ({
        taskId: this.id,
        loopCount: this.loopCount,
        displayMessage: this.displayMessage,
      }),
      retry: () => this.recursivelyMakeRequest(this.history),
      completeTask: () => this.completeTask(),
    });
  }

  /**
   * Start the task and initiate the ReAct loop
   */
  async start() {
    try {
      this.toolExecutor.setFileChangeTracker(this.diffTracker);
      // Collect context before starting
      logger.debug(`[Task ${this.id}] Collecting project context...`);
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
        content: this.displayMessage,
      });
      logger.debug("save", this.displayMessage);
      await this.recursivelyMakeRequest(this.history);
    } catch (error) {
      await this.taskErrorHandler.handle(error, "task_start");
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
        logger.debug(
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
        this.completeTask();
        return;
      }

      this.loopCount++;

      const apiHandler = new ApiHandler(this.apiConfiguration);
      const systemPrompt = await this.getSystemPrompt();

      history = history.map((item) => {
        if (item.role === "tool_result") {
          const content = formatToolResult(item.content as ToolResult);
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

      const parser = createAssistantMessageParser(this.toolExecutor);
      const { assistantMessage, contentBlocks, usage } =
        await streamAssistantResponse({
          stream,
          parser,
          isCancelled: () => this.isCancelled,
          taskId: this.id,
          loopCount: this.loopCount,
          callbacks: {
            onStreamChunk: (content, isStreaming) => {
              this.provider.postMessageToWebview({
                type: "stream_chunk",
                content,
                isStreaming,
              });
            },
            onToolCall: (toolCall) => {
              this.provider.postMessageToWebview({
                type: "tool_call",
                toolCall: toolCall,
              });
            },
          },
        });

      this.abortController = null;

      if (usage) {
        this.publishTokenUsage(usage);
      }

      logger.debug(
        `[Task ${this.id}] Loop ${this.loopCount}: Assistant response received`
      );

      // Parse assistant message for tool calls
      const assistantContent = buildAssistantContent(
        contentBlocks,
        assistantMessage
      );

      // Add assistant message to history for the LLM
      const assistantHistoryItem: HistoryItem = {
        role: "assistant",
        content: assistantMessage,
      };
      this.history.push(assistantHistoryItem);

      // Save assistant message to display history (tool XML stripped)
      const assistantDisplayContent = getAssistantDisplayText(
        assistantContent
      );
      if (assistantDisplayContent) {
        this.conversationHistoryManager.addMessage({
          role: "assistant",
          content: assistantDisplayContent,
        });
      }
      const toolCalls = assistantContent.filter(
        (content): content is ToolUse => content.type === "tool_use"
      );

      // If no tool calls found, prompt LLM to use tools (Requirement 6.6)
      if (toolCalls.length === 0) {
        logger.debug(
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
          logger.debug(`[Task ${this.id}] Empty response, ending ReAct loop`);
          this.completeTask();
        }
        return;
      }

      // Check if attempt_completion was called
      const hasCompletion = hasAttemptCompletion(toolCalls);

      // Execute tool calls and get results
      const toolResults = await this.toolCallHandler.executeToolCalls(toolCalls);

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
        logger.debug(
          `[Task ${this.id}] Task completion requested, ending ReAct loop`
        );
        this.completeTask();
        return;
      }

      // Continue the ReAct loop
      await this.recursivelyMakeRequest(this.history);
    } catch (error) {
      await this.taskErrorHandler.handle(error, `react_loop_${this.loopCount}`);
    }
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
    this.completeTask();
  }

  private completeTask(): void {
    if (this.isCompleted) {
      return;
    }
    this.isCompleted = true;
    this.toolExecutor.setFileChangeTracker(undefined);

    const diff = this.diffTracker.buildTaskDiff();
    if (diff) {
      this.provider.postMessageToWebview({ type: "task_diff", diff });
    }

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
