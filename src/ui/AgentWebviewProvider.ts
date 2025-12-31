import * as vscode from "vscode";
import { Task } from "../core/task";
import { buildInitPrompt, parseInitCommand } from "../core/initCommand";

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
import { ConversationController } from "./ConversationController";
import { DiffWebviewPanel } from "./DiffWebviewPanel";
import { MessageHandlerRegistry } from "./MessageHandlerRegistry";
import type {
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
  private conversationController: ConversationController;
  private messageHandlerRegistry: MessageHandlerRegistry;
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

    this.conversationController = new ConversationController({
      conversationHistoryManager: this.conversationHistoryManager,
      postMessage: (message) => this.postMessageToWebview(message),
      cancelCurrentTask: () => this.cancelCurrentTask(),
    });

    this.messageHandlerRegistry = new MessageHandlerRegistry();
    this.registerMessageHandlers();

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

  private registerMessageHandlers(): void {
    this.messageHandlerRegistry.register("mode_change", (message) =>
      this.handleModeChange(message.mode)
    );
    this.messageHandlerRegistry.register("clear_conversation", () =>
      this.conversationController.handleClearConversation()
    );
    this.messageHandlerRegistry.register("clear_conversation_history", () =>
      this.conversationController.handleClearConversationHistory()
    );
    this.messageHandlerRegistry.register("get_conversation_history", () =>
      this.conversationController.handleGetConversationHistory()
    );
    this.messageHandlerRegistry.register("new_conversation", () =>
      this.conversationController.handleNewConversation()
    );
    this.messageHandlerRegistry.register("get_conversation_list", () =>
      this.conversationController.handleGetConversationList()
    );
    this.messageHandlerRegistry.register("switch_conversation", (message) =>
      this.conversationController.handleSwitchConversation(
        message.conversationId
      )
    );
    this.messageHandlerRegistry.register("delete_conversation", (message) =>
      this.conversationController.handleDeleteConversation(
        message.conversationId
      )
    );
    this.messageHandlerRegistry.register("get_configuration", () =>
      this.handleGetConfiguration()
    );
    this.messageHandlerRegistry.register("open_diff_panel", (message) =>
      this.handleOpenDiffPanel(message.diff, message.filePath)
    );
    this.messageHandlerRegistry.register("save_configuration", (message) =>
      this.handleSaveConfiguration(message.config)
    );
    this.messageHandlerRegistry.register("test_connection", (message) =>
      this.handleTestConnection(message.apiConfig)
    );
    this.messageHandlerRegistry.register("permission_response", (message) =>
      this.permissionManager.handlePermissionResponse(
        message.requestId,
        message.approved
      )
    );
    this.messageHandlerRegistry.register("cancel_task", () =>
      this.cancelCurrentTask()
    );
    this.messageHandlerRegistry.register("user_message", (message) =>
      this.handleUserMessage(message)
    );
  }

  private async handleMessage(message: UserMessage): Promise<void> {
    await this.messageHandlerRegistry.handle(message);
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

    const initCommand = parseInitCommand(message.content);
    const taskMessage = initCommand
      ? buildInitPrompt(initCommand.guidance)
      : message.content;
    const displayMessage = initCommand ? initCommand.raw : message.content;

    this.currentTask = new Task(
      this,
      this.apiConfiguration,
      taskMessage,
      advanced.maxLoopCount,
      this.toolExecutor,
      this.promptBuilder,
      this.contextCollector,
      this.conversationHistoryManager,
      this.errorHandler,
      advanced.contextWindowSize,
      displayMessage
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

  private handleOpenDiffPanel(
    diff: Extract<UserMessage, { type: "open_diff_panel" }>["diff"],
    filePath?: string
  ): void {
    DiffWebviewPanel.show(diff, filePath);
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

