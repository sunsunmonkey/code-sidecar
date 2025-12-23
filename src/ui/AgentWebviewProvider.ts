import * as vscode from "vscode";
import { Task } from "../core/task";
import { HistoryItem } from "../core/apiHandler";

import {
  ToolExecutor,
  AttemptCompletionTool,
  ReadFileTool,
  WriteFileTool,
  ListFilesTool,
  ApplyDiffTool,
  InsertContentTool,
  SearchFilesTool,
  ExecuteCommandTool,
  GetDiagnosticsTool,
  ListCodeDefinitionNamesTool,
} from "../tools";
import { ModeManager } from "../managers/ModeManager";
import type { ApiConfiguration } from "code-sidecar-shared/types/api";
import type { WorkMode } from "code-sidecar-shared/types/modes";
import { PromptBuilder } from "../managers/PromptBuilder";
import { PermissionManager } from "../managers/PermissionManager";
import { ContextCollector } from "../managers/ContextCollector";
import { ConfigurationManager } from "../config/ConfigurationManager";
import { ConversationHistoryManager } from "../managers/ConversationHistoryManager";
import { ErrorHandler } from "../managers/ErrorHandler";
import { logger } from "code-sidecar-shared/utils/logger";
import type {
  DisplayMessage,
  AgentConfiguration,
  UserMessage,
  WebviewMessage,
} from "code-sidecar-shared/types/messages";

/**
 * Agent Webview Provider manages the sidebar panel and task execution
 */
export class AgentWebviewProvider implements vscode.WebviewViewProvider {
  configurationManager: ConfigurationManager;
  private webview: vscode.Webview | undefined;
  private currentTask: Task | undefined = undefined;
  private toolExecutor: ToolExecutor;
  private modeManager: ModeManager;
  private promptBuilder: PromptBuilder;
  private permissionManager: PermissionManager;
  private contextCollector: ContextCollector;
  private conversationHistoryManager: ConversationHistoryManager;
  private errorHandler: ErrorHandler;
  private apiConfiguration: ApiConfiguration = {
    model: "",
    apiKey: "",
    baseUrl: "",
  };

  constructor(readonly context: vscode.ExtensionContext) {
    // Initialize configuration manager
    this.configurationManager = new ConfigurationManager(context);

    // Initialize permission manager
    this.permissionManager = new PermissionManager();
    this.permissionManager.setWebviewProvider(this);

    // Initialize error handler
    this.errorHandler = new ErrorHandler();

    // Initialize tool executor and register default tools
    this.toolExecutor = new ToolExecutor(
      this.permissionManager,
      this.errorHandler
    );
    this.registerDefaultTools();

    // Initialize mode manager and prompt builder
    this.modeManager = new ModeManager();
    this.promptBuilder = new PromptBuilder(this.modeManager, this.toolExecutor);

    // Initialize context collector
    this.contextCollector = new ContextCollector();

    // Initialize conversation history manager
    this.conversationHistoryManager = new ConversationHistoryManager(context);

    // Load configuration and set up change listener
    this.initializeConfiguration();
  }

  /**
   * Initialize configuration from settings
   * Requirements: 10.1, 10.2, 10.3, 10.5
   */
  private async initializeConfiguration(): Promise<void> {
    try {
      // Load configuration
      const config = await this.configurationManager.getConfiguration();

      // Update API configuration
      this.apiConfiguration = config.api;

      // Update permission settings
      this.permissionManager.updateSettings(config.permissions);

      // Set default mode to 'code'
      this.modeManager.switchMode("code");

      logger.debug("[AgentWebviewProvider] Configuration initialized");

      // Listen for configuration changes
      this.context.subscriptions.push(
        this.configurationManager.onConfigurationChanged((newConfig) => {
          this.apiConfiguration = newConfig.api;
          this.permissionManager.updateSettings(newConfig.permissions);
          logger.debug("[AgentWebviewProvider] Configuration updated");
        })
      );
    } catch (error) {
      logger.debug(
        "[AgentWebviewProvider] Failed to initialize configuration:",
        error
      );
    }
  }

  /**
   * Register default tools
   * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 6.6
   */
  private registerDefaultTools(): void {
    // Register attempt_completion tool (Requirement 6.6)
    this.toolExecutor.registerTool(new AttemptCompletionTool());

    // Register file operation tools (Requirements 13.1, 13.2, 13.4)
    this.toolExecutor.registerTool(new ReadFileTool());
    this.toolExecutor.registerTool(new WriteFileTool());
    this.toolExecutor.registerTool(new ListFilesTool());

    // Register advanced file editing tools (Requirements 13.3, 13.5)
    this.toolExecutor.registerTool(new ApplyDiffTool());
    this.toolExecutor.registerTool(new InsertContentTool());
    this.toolExecutor.registerTool(new SearchFilesTool());

    // Register command execution and diagnostics tools (Requirements 13.5, 13.6)
    this.toolExecutor.registerTool(new ExecuteCommandTool());
    this.toolExecutor.registerTool(new GetDiagnosticsTool());
    this.toolExecutor.registerTool(new ListCodeDefinitionNamesTool());

    logger.debug(`Registered ${this.toolExecutor.getToolCount()} tools`);
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Thenable<void> | void {
    this.webview = webviewView.webview;

    const scriptUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "webview-ui",
        "dist",
        "assets",
        "main.js"
      )
    );

    const styleUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "webview-ui",
        "dist",
        "assets",
        "main.css"
      )
    );

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Coding Assistant</title>
    <script type="module" crossorigin src="${scriptUri}"></script>
    <link rel="stylesheet" crossorigin href="${styleUri}">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

    webviewView.webview.onDidReceiveMessage(async (message: UserMessage) => {
      await this.handleMessage(message);
    });
  }

  /**
   * Handle messages from webview
   */
  private readonly messageHandlers: {
    [K in UserMessage["type"]]?: (
      message: Extract<UserMessage, { type: K }>
    ) => Promise<void> | void;
  } = {
    mode_change: (message) => this.handleModeChange(message.mode),
    clear_conversation: () => this.handleClearConversation(),
    get_conversation_history: () => this.handleGetConversationHistory(),
    new_conversation: () => this.handleNewConversation(),
    get_conversation_list: () => this.handleGetConversationList(),
    switch_conversation: (message) =>
      this.handleSwitchConversation(message.conversationId),
    delete_conversation: (message) =>
      this.handleDeleteConversation(message.conversationId),
    get_configuration: () => this.handleGetConfiguration(),
    save_configuration: (message) =>
      this.handleSaveConfiguration(message.config),
    test_connection: (message) => this.handleTestConnection(message.apiConfig),
    permission_response: (message) =>
      this.permissionManager.handlePermissionResponse(
        message.requestId,
        message.approved
      ),
    cancel_task: () => this.cancelCurrentTask(),
    user_message: (message) => this.handleUserMessage(message),
  };

  private async handleMessage(message: UserMessage): Promise<void> {
    const handler = this.messageHandlers[message.type];
    if (handler) {
      await handler(message as never);
    }
  }

  private async handleUserMessage(
    message: Extract<UserMessage, { type: "user_message" }>
  ): Promise<void> {
    const isConfigured =
      await this.configurationManager.promptConfigureApiIfNeeded();
    if (!isConfigured) {
      this.postMessageToWebview({
        type: "error",
        message:
          "API is not configured. Please configure your API settings first.",
      });
      return;
    }

    const { advanced } = await this.configurationManager.getConfiguration();

    this.cancelCurrentTask();

    this.currentTask = new Task(
      this,
      this.apiConfiguration,
      message.content,
      advanced.maxLoopCount,
      this.toolExecutor,
      this.promptBuilder,
      this.contextCollector,
      this.conversationHistoryManager,
      this.errorHandler,
      advanced.contextWindowSize
    );
    await this.currentTask.start();
  }

  /**
   * Handle mode change request
   */
  private handleModeChange(mode: WorkMode): void {
    try {
      this.modeManager.switchMode(mode);
      const modeDefinition = this.modeManager.getCurrentModeDefinition();

      // Notify webview of mode change
      this.postMessageToWebview({
        type: "mode_changed",
        mode: mode,
      });

      // Show notification to user
      vscode.window.showInformationMessage(
        `Switched to ${modeDefinition.icon} ${modeDefinition.name} mode`
      );

      logger.debug(`[AgentWebviewProvider] Mode changed to: ${mode}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to switch mode: ${errorMessage}`);
      this.postMessageToWebview({
        type: "error",
        message: `Failed to switch mode: ${errorMessage}`,
      });
    }
  }

  /**
   * Handle clear conversation request
   */
  private handleClearConversation(): void {
    try {
      this.cancelCurrentTask();
      this.conversationHistoryManager.clearConversation();

      // Notify webview that conversation was cleared
      this.postMessageToWebview({
        type: "conversation_cleared",
      });

      logger.debug("[AgentWebviewProvider] Conversation cleared");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.debug(
        "[AgentWebviewProvider] Failed to clear conversation:",
        error
      );
      this.postMessageToWebview({
        type: "error",
        message: `Failed to clear conversation: ${errorMessage}`,
      });
    }
  }

  /**
   * Handle get conversation history request
   */
  private handleGetConversationHistory(): void {
    try {
      const messages = this.conversationHistoryManager.getMessages();

      // Convert HistoryItem[] to DisplayMessage format
      const displayMessages: DisplayMessage[] = messages.map(
        (msg: HistoryItem, index: number) => {
          const content =
            typeof msg.content === "string" ? msg.content : msg.content.content;
          return {
            ...msg,
            role: msg.role as DisplayMessage["role"],
            content,
            id: `msg-${Date.now()}-${index}`,
            timestamp: new Date(),
          };
        }
      );
      logger.debug(displayMessages);
      // Send conversation history to webview
      this.postMessageToWebview({
        type: "conversation_history",
        messages: displayMessages,
      });

      logger.debug(
        `[AgentWebviewProvider] Sent ${displayMessages.length} messages to webview`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.debug(
        "[AgentWebviewProvider] Failed to get conversation history:",
        error
      );
      this.postMessageToWebview({
        type: "error",
        message: `Failed to get conversation history: ${errorMessage}`,
      });
    }
  }

  /**
   * Handle new conversation request
   */
  private handleNewConversation(): void {
    try {
      this.cancelCurrentTask();
      this.conversationHistoryManager.clearConversation();

      // Send empty conversation history to webview
      this.postMessageToWebview({
        type: "conversation_history",
        messages: [],
      });

      this.postMessageToWebview({
        type: "conversation_cleared",
      });

      logger.debug("[AgentWebviewProvider] New conversation started");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.debug(
        "[AgentWebviewProvider] Failed to start new conversation:",
        error
      );
      this.postMessageToWebview({
        type: "error",
        message: `Failed to start new conversation: ${errorMessage}`,
      });
    }
  }

  /**
   * Handle get conversation list request
   */
  private handleGetConversationList(): void {
    try {
      const conversations =
        this.conversationHistoryManager.getConversationHistory();
      const currentId =
        this.conversationHistoryManager.getCurrentConversationId();
      logger.debug(conversations);
      // Format conversations for display
      const formattedConversations = conversations.map((conv) => ({
        id: conv.id,
        timestamp: conv.timestamp,
        messageCount: conv.messages.length,
        preview: this.getConversationPreview(conv.messages),
        isCurrent: conv.id === currentId,
      }));

      logger.debug(
        "🚀 ~ AgentWebviewProvider ~ handleGetConversationList ~ formattedConversations:",
        formattedConversations
      );

      // Sort by timestamp, newest first
      formattedConversations.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      this.postMessageToWebview({
        type: "conversation_list",
        conversations: formattedConversations,
      });

      logger.debug(
        `[AgentWebviewProvider] Sent ${formattedConversations.length} conversations to webview`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.debug(
        "[AgentWebviewProvider] Failed to get conversation list:",
        error
      );
      this.postMessageToWebview({
        type: "error",
        message: `Failed to get conversation list: ${errorMessage}`,
      });
    }
  }

  /**
   * Handle switch conversation request
   */
  private handleSwitchConversation(conversationId: string): void {
    try {
      this.cancelCurrentTask();
      const success =
        this.conversationHistoryManager.restoreConversation(conversationId);

      if (success) {
        // Send the conversation messages to webview
        this.handleGetConversationHistory();

        logger.debug(
          `[AgentWebviewProvider] Switched to conversation: ${conversationId}`
        );
      } else {
        this.postMessageToWebview({
          type: "error",
          message: `Failed to switch to conversation: ${conversationId}`,
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.debug(
        "[AgentWebviewProvider] Failed to switch conversation:",
        error
      );
      this.postMessageToWebview({
        type: "error",
        message: `Failed to switch conversation: ${errorMessage}`,
      });
    }
  }

  /**
   * Handle delete conversation request
   */
  private handleDeleteConversation(conversationId: string): void {
    logger.debug(
      `[AgentWebviewProvider] Received delete request for: ${conversationId}`
    );
    try {
      const currentConversationId =
        this.conversationHistoryManager.getCurrentConversationId();
      const isCurrentConversation = currentConversationId === conversationId;

      if (isCurrentConversation) {
        this.cancelCurrentTask();
      }
      const success =
        this.conversationHistoryManager.deleteConversation(conversationId);

      logger.debug(`[AgentWebviewProvider] Delete result: ${success}`);

      if (success) {
        if (isCurrentConversation) {
          this.conversationHistoryManager.startNewConversation();
          this.postMessageToWebview({ type: "conversation_cleared" });
        }

        this.postMessageToWebview({
          type: "conversation_deleted",
          conversationId: conversationId,
        });

        // Refresh conversation list
        this.handleGetConversationList();

        logger.debug(
          `[AgentWebviewProvider] Deleted conversation: ${conversationId}`
        );
      } else {
        logger.debug(
          `[AgentWebviewProvider] Failed to delete conversation: ${conversationId}`
        );
        this.postMessageToWebview({
          type: "error",
          message: `Failed to delete conversation: ${conversationId}`,
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.debug(
        "[AgentWebviewProvider] Failed to delete conversation:",
        error
      );
      this.postMessageToWebview({
        type: "error",
        message: `Failed to delete conversation: ${errorMessage}`,
      });
    }
  }

  /**
   * Get a preview of the conversation (first user message)
   */
  private getConversationPreview(messages: any[]): string {
    const firstUserMessage = messages.find((msg) => msg.role === "user");
    if (firstUserMessage) {
      const content =
        typeof firstUserMessage.content === "string"
          ? firstUserMessage.content
          : JSON.stringify(firstUserMessage.content);
      return content.length > 100 ? content.substring(0, 100) + "..." : content;
    }
    return "Empty conversation";
  }

  /**
   * Send message to webview
   * @deprecated Use postMessageToWebview instead
   */
  postMessage(message: string) {
    this.webview?.postMessage(message);
  }

  /**
   * Send structured message to webview
   */
  postMessageToWebview(message: WebviewMessage) {
    this.webview?.postMessage(message);
  }

  /**
   * Cancel and clear the current task if one is running
   */
  private cancelCurrentTask(): void {
    if (!this.currentTask) {
      return;
    }
    this.currentTask.cancel();
    this.currentTask = undefined;
  }

  /**
   * Get current task
   */
  getCurrentTask(): Task | undefined {
    return this.currentTask;
  }

  /**
   * Update API configuration
   */
  updateApiConfiguration(config: Partial<ApiConfiguration>) {
    this.apiConfiguration = { ...this.apiConfiguration, ...config };
  }

  /**
   * Get tool executor
   */
  getToolExecutor(): ToolExecutor {
    return this.toolExecutor;
  }

  /**
   * Get mode manager
   * Requirements: 7.5, 7.6
   */
  getModeManager(): ModeManager {
    return this.modeManager;
  }

  /**
   * Get prompt builder
   * Requirements: 6.1, 7.1
   */
  getPromptBuilder(): PromptBuilder {
    return this.promptBuilder;
  }

  /**
   * Get permission manager
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
   */
  getPermissionManager(): PermissionManager {
    return this.permissionManager;
  }

  /**
   * Get context collector
   * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
   */
  getContextCollector(): ContextCollector {
    return this.contextCollector;
  }

  /**
   * Get conversation history manager
   * Requirements: 4.3, 4.4, 4.5
   */
  getConversationHistoryManager(): ConversationHistoryManager {
    return this.conversationHistoryManager;
  }

  /**
   * Get error handler
   * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
   */
  getErrorHandler(): ErrorHandler {
    return this.errorHandler;
  }

  /**
   * Handle get configuration request
   */
  private async handleGetConfiguration(): Promise<void> {
    try {
      const config = await this.configurationManager.getConfiguration();

      this.postMessageToWebview({
        type: "configuration_loaded",
        config,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.postMessageToWebview({
        type: "validation_error",
        errors: { general: `Failed to load configuration: ${errorMessage}` },
      });
    }
  }

  /**
   * Handle save configuration request
   */
  private async handleSaveConfiguration(
    config: AgentConfiguration
  ): Promise<void> {
    try {
      const permissions = {
        ...config.permissions,
        alwaysConfirm:
          config.permissions.alwaysConfirm ??
          this.permissionManager.getSettings().alwaysConfirm,
      };

      await this.configurationManager.updateConfiguration({
        ...config,
        permissions,
      });

      this.postMessageToWebview({
        type: "configuration_saved",
        success: true,
      });

      vscode.window.showInformationMessage("Configuration saved successfully");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.postMessageToWebview({
        type: "configuration_saved",
        success: false,
        error: errorMessage,
      });

      vscode.window.showErrorMessage(
        `Failed to save configuration: ${errorMessage}`
      );
    }
  }

  /**
   * Handle test connection request
   */
  private async handleTestConnection(
    apiConfig: ApiConfiguration
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const validationResult =
        await this.configurationManager.validateApiConfiguration(apiConfig);

      if (!validationResult.valid) {
        this.postMessageToWebview({
          type: "connection_test_result",
          success: false,
          error: validationResult.error,
        });
        return;
      }

      const responseTime = Date.now() - startTime;

      this.postMessageToWebview({
        type: "connection_test_result",
        success: true,
        responseTime,
      });

      vscode.window.showInformationMessage(
        `API connection successful (${responseTime}ms)`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.postMessageToWebview({
        type: "connection_test_result",
        success: false,
        error: errorMessage,
      });

      vscode.window.showErrorMessage(
        `API connection test failed: ${errorMessage}`
      );
    }
  }

  /**
   * Set input value in webview
   */
  setInputValue(value: string): void {
    this.postMessageToWebview({
      type: "set_input_value",
      value,
    });
  }
}

