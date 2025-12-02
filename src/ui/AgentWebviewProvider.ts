import * as vscode from "vscode";
import { Task, ToolUse, ToolResult } from "../core/task";
import { ApiConfiguration } from "../core/apiHandler";
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
import { ModeManager, WorkMode } from "../managers/ModeManager";
import { PromptBuilder } from "../managers/PromptBuilder";
import { PermissionManager } from "../managers/PermissionManager";
import { ContextCollector } from "../managers/ContextCollector";
import { ConfigurationManager } from "../config/ConfigurationManager";
import { ConversationHistoryManager } from "../managers/ConversationHistoryManager";
import {
  OperationHistoryManager,
  OperationRecord,
} from "../managers/OperationHistoryManager";
import { ErrorHandler } from "../managers/ErrorHandler";

/**
 * Permission request interface
 */
export interface PermissionRequest {
  id: string;
  toolName: string;
  operation: string;
  target: string;
  details: string;
}

/**
 * Message types sent to webview
 */
export type WebviewMessage =
  | { type: "stream_chunk"; content: string; isStreaming: boolean }
  | { type: "tool_call"; toolCall: ToolUse }
  | { type: "tool_result"; result: ToolResult }
  | { type: "error"; message: string }
  | { type: "task_complete" }
  | { type: "mode_changed"; mode: WorkMode }
  | { type: "conversation_cleared" }
  | { type: "operation_recorded"; operation: OperationRecord }
  | { type: "operation_history"; operations: OperationRecord[] }
  | { type: "conversation_history"; messages: any[] }
  | { type: "conversation_list"; conversations: any[] }
  | { type: "conversation_switched"; conversationId: string }
  | { type: "conversation_deleted"; conversationId: string }
  | { type: "navigate"; route: string }
  | { type: "configuration_loaded"; config: any; isFirstTime?: boolean }
  | { type: "configuration_saved"; success: boolean; error?: string }
  | {
      type: "connection_test_result";
      success: boolean;
      error?: string;
      responseTime?: number;
    }
  | { type: "configuration_exported"; data: string; filename: string }
  | { type: "configuration_imported"; success: boolean; error?: string }
  | { type: "validation_error"; errors: Record<string, string> }
  | { type: "permission_request"; request: PermissionRequest };

/**
 * Message types received from webview
 */
export type UserMessage =
  | { type: "user_message"; content: string }
  | { type: "mode_change"; mode: WorkMode }
  | { type: "clear_conversation" }
  | { type: "new_conversation" }
  | { type: "get_operation_history" }
  | { type: "clear_operation_history" }
  | { type: "get_conversation_history" }
  | { type: "get_conversation_list" }
  | { type: "switch_conversation"; conversationId: string }
  | { type: "delete_conversation"; conversationId: string }
  | { type: "get_configuration" }
  | { type: "save_configuration"; config: any }
  | { type: "test_connection"; apiConfig: any }
  | { type: "export_configuration" }
  | { type: "import_configuration"; data: string }
  | { type: "reset_to_defaults" }
  | { type: "permission_response"; requestId: string; approved: boolean };

/**
 * Agent Webview Provider manages the sidebar panel and task execution
 */
export class AgentWebviewProvider implements vscode.WebviewViewProvider {
  private webview: vscode.Webview | undefined;
  private currentTask: Task | undefined = undefined;
  private toolExecutor: ToolExecutor;
  private modeManager: ModeManager;
  private promptBuilder: PromptBuilder;
  private permissionManager: PermissionManager;
  private contextCollector: ContextCollector;
  private configurationManager: ConfigurationManager;
  private conversationHistoryManager: ConversationHistoryManager;
  private operationHistoryManager: OperationHistoryManager;
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

    // Initialize operation history manager
    this.operationHistoryManager = new OperationHistoryManager(context);

    // Initialize error handler
    this.errorHandler = new ErrorHandler();

    // Initialize tool executor and register default tools
    this.toolExecutor = new ToolExecutor();
    this.toolExecutor.setPermissionManager(this.permissionManager);
    this.toolExecutor.setOperationHistoryManager(this.operationHistoryManager);
    this.toolExecutor.setErrorHandler(this.errorHandler);
    this.registerDefaultTools();

    // Initialize mode manager and prompt builder
    this.modeManager = new ModeManager();
    this.promptBuilder = new PromptBuilder(
      this.modeManager,
      this.toolExecutor,
      this.context
    );

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

      // Set default mode
      this.modeManager.switchMode(config.defaultMode);

      console.log("[AgentWebviewProvider] Configuration initialized");

      // Listen for configuration changes
      this.context.subscriptions.push(
        this.configurationManager.onConfigurationChanged((newConfig) => {
          this.apiConfiguration = newConfig.api;
          this.permissionManager.updateSettings(newConfig.permissions);
          console.log("[AgentWebviewProvider] Configuration updated");
        })
      );
    } catch (error) {
      console.error(
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

    console.log(`Registered ${this.toolExecutor.getToolCount()} tools`);
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
    <script>
      // Set initial route to main page (default)
      window.location.hash = '#/';
    </script>
  </body>
</html>
`;

    webviewView.webview.onDidReceiveMessage(async (message: any) => {
      await this.handleMessage(message);
    });
  }

  /**
   * Handle messages from webview
   * Requirements: 7.5, 7.6, 8.1, 8.2, 8.3, 8.4, 8.5, 10.5, 4.5, 11.2, 11.3, 11.5
   */
  private async handleMessage(message: any): Promise<void> {
    // Handle mode change messages
    if (message.type === "mode_change") {
      this.handleModeChange(message.mode);
      return;
    }

    // Handle clear conversation messages (Requirement 4.5)
    if (message.type === "clear_conversation") {
      this.handleClearConversation();
      return;
    }

    // Handle get operation history messages (Requirements: 11.2, 11.3)
    if (message.type === "get_operation_history") {
      this.handleGetOperationHistory();
      return;
    }

    // Handle clear operation history messages (Requirement 11.5)
    if (message.type === "clear_operation_history") {
      this.handleClearOperationHistory();
      return;
    }

    // Handle get conversation history messages
    if (message.type === "get_conversation_history") {
      this.handleGetConversationHistory();
      return;
    }

    // Handle new conversation
    if (message.type === "new_conversation") {
      this.handleNewConversation();
      return;
    }

    // Handle get conversation list
    if (message.type === "get_conversation_list") {
      this.handleGetConversationList();
      return;
    }

    // Handle switch conversation
    if (message.type === "switch_conversation") {
      this.handleSwitchConversation(message.conversationId);
      return;
    }

    // Handle delete conversation
    if (message.type === "delete_conversation") {
      this.handleDeleteConversation(message.conversationId);
      return;
    }

    // Handle configuration messages
    if (message.type === "get_configuration") {
      await this.handleGetConfiguration();
      return;
    }

    if (message.type === "save_configuration") {
      await this.handleSaveConfiguration(message.config);
      return;
    }

    if (message.type === "test_connection") {
      await this.handleTestConnection(message.apiConfig);
      return;
    }

    if (message.type === "export_configuration") {
      await this.handleExportConfiguration();
      return;
    }

    if (message.type === "import_configuration") {
      await this.handleImportConfiguration(message.data);
      return;
    }

    if (message.type === "reset_to_defaults") {
      await this.handleResetToDefaults();
      return;
    }

    // Handle permission response messages
    if (message.type === "permission_response") {
      this.permissionManager.handlePermissionResponse(
        message.requestId,
        message.approved
      );
      return;
    }

    // Check if API is configured before starting task (Requirement 10.5)
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

    // Handle user messages
    if (typeof message === "string") {
      vscode.window.showInformationMessage(message);
      this.currentTask = new Task(
        this,
        this.apiConfiguration,
        message,
        this.toolExecutor,
        this.promptBuilder,
        this.contextCollector,
        this.conversationHistoryManager,
        this.errorHandler
      );
      await this.currentTask.start();
    } else if (message.type === "user_message") {
      this.currentTask = new Task(
        this,
        this.apiConfiguration,
        message.content,
        this.toolExecutor,
        this.promptBuilder,
        this.contextCollector,
        this.conversationHistoryManager,
        this.errorHandler
      );
      await this.currentTask.start();
    }
  }

  /**
   * Handle mode change request
   * Requirements: 7.5, 7.6
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

      console.log(`[AgentWebviewProvider] Mode changed to: ${mode}`);
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
   * Requirement 4.5: Support clearing conversation
   */
  private handleClearConversation(): void {
    try {
      this.conversationHistoryManager.clearConversation();

      // Notify webview that conversation was cleared
      this.postMessageToWebview({
        type: "conversation_cleared",
      });

      console.log("[AgentWebviewProvider] Conversation cleared");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
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
   * Handle get operation history request
   * Requirements: 11.2, 11.3
   */
  private handleGetOperationHistory(): void {
    try {
      const operations = this.operationHistoryManager.getAllOperations();

      // Send operation history to webview
      this.postMessageToWebview({
        type: "operation_history",
        operations,
      });

      console.log(
        `[AgentWebviewProvider] Sent ${operations.length} operations to webview`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        "[AgentWebviewProvider] Failed to get operation history:",
        error
      );
      this.postMessageToWebview({
        type: "error",
        message: `Failed to get operation history: ${errorMessage}`,
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
      const displayMessages = messages.map((msg: any, index: number) => {
        let content = '';
        
        // Handle different content types
        if (typeof msg.content === 'string') {
          content = msg.content;
        } else if (Array.isArray(msg.content)) {
          // Handle content arrays (e.g., with images or tool results)
          content = msg.content
            .map((part: any) => {
              if (typeof part === 'string') return part;
              if (part.type === 'text') return part.text;
              if (part.type === 'tool_result') return `[Tool Result: ${part.tool_name}]`;
              return JSON.stringify(part);
            })
            .join('\n');
        } else {
          content = JSON.stringify(msg.content);
        }

        return {
          id: `msg-${Date.now()}-${index}`,
          role: msg.role,
          content: content,
          timestamp: new Date(),
        };
      });

      // Send conversation history to webview
      this.postMessageToWebview({
        type: "conversation_history",
        messages: displayMessages,
      });

      console.log(`[AgentWebviewProvider] Sent ${displayMessages.length} messages to webview`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
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
      this.conversationHistoryManager.clearConversation();
      
      // Send empty conversation history to webview
      this.postMessageToWebview({
        type: "conversation_history",
        messages: [],
      });

      this.postMessageToWebview({
        type: "conversation_cleared",
      });

      console.log('[AgentWebviewProvider] New conversation started');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
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
      const conversations = this.conversationHistoryManager.getConversationHistory();
      const currentId = this.conversationHistoryManager.getCurrentConversationId();
      
      // Format conversations for display
      const formattedConversations = conversations.map(conv => ({
        id: conv.id,
        timestamp: conv.timestamp,
        messageCount: conv.messages.length,
        preview: this.getConversationPreview(conv.messages),
        isCurrent: conv.id === currentId,
      }));

      // Sort by timestamp, newest first
      formattedConversations.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      this.postMessageToWebview({
        type: "conversation_list",
        conversations: formattedConversations,
      });

      console.log(`[AgentWebviewProvider] Sent ${formattedConversations.length} conversations to webview`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
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
      const success = this.conversationHistoryManager.restoreConversation(conversationId);
      
      if (success) {
        // Send the conversation messages to webview
        this.handleGetConversationHistory();
        
        this.postMessageToWebview({
          type: "conversation_switched",
          conversationId: conversationId,
        });

        console.log(`[AgentWebviewProvider] Switched to conversation: ${conversationId}`);
      } else {
        this.postMessageToWebview({
          type: "error",
          message: `Failed to switch to conversation: ${conversationId}`,
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
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
    console.log(`[AgentWebviewProvider] Received delete request for: ${conversationId}`);
    try {
      const success = this.conversationHistoryManager.deleteConversation(conversationId);
      
      console.log(`[AgentWebviewProvider] Delete result: ${success}`);
      
      if (success) {
        this.postMessageToWebview({
          type: "conversation_deleted",
          conversationId: conversationId,
        });

        // Refresh conversation list
        this.handleGetConversationList();

        console.log(`[AgentWebviewProvider] Deleted conversation: ${conversationId}`);
      } else {
        console.warn(`[AgentWebviewProvider] Failed to delete conversation: ${conversationId}`);
        this.postMessageToWebview({
          type: "error",
          message: `Failed to delete conversation: ${conversationId}`,
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
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
    const firstUserMessage = messages.find(msg => msg.role === 'user');
    if (firstUserMessage) {
      const content = typeof firstUserMessage.content === 'string' 
        ? firstUserMessage.content 
        : JSON.stringify(firstUserMessage.content);
      return content.length > 100 ? content.substring(0, 100) + '...' : content;
    }
    return 'Empty conversation';
  }

  /**
   * Handle clear operation history request
   * Requirement 11.5
   */
  private handleClearOperationHistory(): void {
    try {
      this.operationHistoryManager.clearHistory();

      // Send empty operation history to webview
      this.postMessageToWebview({
        type: "operation_history",
        operations: [],
      });

      vscode.window.showInformationMessage("Operation history cleared");
      console.log("[AgentWebviewProvider] Operation history cleared");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        "[AgentWebviewProvider] Failed to clear operation history:",
        error
      );
      this.postMessageToWebview({
        type: "error",
        message: `Failed to clear operation history: ${errorMessage}`,
      });
    }
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
   * Get configuration manager
   * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
   */
  getConfigurationManager(): ConfigurationManager {
    return this.configurationManager;
  }

  /**
   * Get conversation history manager
   * Requirements: 4.3, 4.4, 4.5
   */
  getConversationHistoryManager(): ConversationHistoryManager {
    return this.conversationHistoryManager;
  }

  /**
   * Get operation history manager
   * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
   */
  getOperationHistoryManager(): OperationHistoryManager {
    return this.operationHistoryManager;
  }

  /**
   * Get error handler
   * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
   */
  getErrorHandler(): ErrorHandler {
    return this.errorHandler;
  }

  /**
   * Navigate to config page
   */
  navigateToConfig(): void {
    this.postMessageToWebview({
      type: "navigate",
      route: "/config",
    });
  }

  /**
   * Handle get configuration request
   */
  private async handleGetConfiguration(): Promise<void> {
    try {
      const config = await this.configurationManager.getConfigurationForUI();
      const isFirstTime = !(await this.configurationManager.isApiConfigured());

      this.postMessageToWebview({
        type: "configuration_loaded",
        config,
        isFirstTime,
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
  private async handleSaveConfiguration(config: any): Promise<void> {
    try {
      await this.configurationManager.updateConfiguration({
        api: config.api,
        permissions: config.permissions,
        defaultMode: config.advanced.defaultMode,
        maxLoopCount: config.advanced.maxLoopCount,
        contextWindowSize: config.advanced.contextWindowSize,
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
  private async handleTestConnection(apiConfig: any): Promise<void> {
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
   * Handle export configuration request
   */
  private async handleExportConfiguration(): Promise<void> {
    try {
      const exportedConfig =
        await this.configurationManager.exportConfiguration();
      const configJson = JSON.stringify(exportedConfig, null, 2);
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, -5);
      const filename = `coding-agent-config-${timestamp}.json`;

      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(filename),
        filters: {
          "JSON Files": ["json"],
          "All Files": ["*"],
        },
      });

      if (uri) {
        await vscode.workspace.fs.writeFile(
          uri,
          Buffer.from(configJson, "utf8")
        );

        this.postMessageToWebview({
          type: "configuration_exported",
          data: configJson,
          filename: filename,
        });

        vscode.window.showInformationMessage(
          `Configuration exported to ${uri.fsPath}`
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(
        `Failed to export configuration: ${errorMessage}`
      );
    }
  }

  /**
   * Handle import configuration request
   */
  private async handleImportConfiguration(data: string): Promise<void> {
    try {
      const exportedConfig = JSON.parse(data);
      await this.configurationManager.importConfiguration(exportedConfig);

      this.postMessageToWebview({
        type: "configuration_imported",
        success: true,
      });

      await this.handleGetConfiguration();

      vscode.window.showInformationMessage(
        "Configuration imported successfully. Please set your API key."
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.postMessageToWebview({
        type: "configuration_imported",
        success: false,
        error: errorMessage,
      });

      vscode.window.showErrorMessage(
        `Failed to import configuration: ${errorMessage}`
      );
    }
  }

  /**
   * Handle reset to defaults request
   */
  private async handleResetToDefaults(): Promise<void> {
    try {
      const result = await vscode.window.showWarningMessage(
        "Are you sure you want to reset all configuration to default values? This cannot be undone.",
        { modal: true },
        "Reset"
      );

      if (result !== "Reset") {
        return;
      }

      await this.configurationManager.resetToDefaults();
      await this.handleGetConfiguration();

      vscode.window.showInformationMessage("Configuration reset to defaults");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(
        `Failed to reset configuration: ${errorMessage}`
      );
    }
  }
}
