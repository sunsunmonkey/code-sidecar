import * as vscode from "vscode";
import type {
  PermissionRequest,
  PermissionRequestWithId,
} from "coding-agent-shared/types/permissions";
import { logger } from "coding-agent-shared/utils/logger";

/**
 * Permission settings for tool operations
 */
export interface PermissionSettings {
  /**
   * Default allow read operations without confirmation
   */
  allowReadByDefault: boolean;

  /**
   * Default allow write operations without confirmation
   */
  allowWriteByDefault: boolean;

  /**
   * Default allow command execution without confirmation
   */
  allowExecuteByDefault: boolean;

  /**
   * Operations that always require confirmation regardless of defaults
   */
  alwaysConfirm: string[];
}

/**
 * PermissionManager handles user authorization for tool operations
 */
export class PermissionManager {
  private settings: PermissionSettings;

  private webviewProvider: any;
  private pendingRequests: Map<string, (approved: boolean) => void> = new Map();

  constructor(settings?: Partial<PermissionSettings>) {
    // Default settings
    this.settings = {
      allowReadByDefault: true, //  Allow reads by default
      allowWriteByDefault: false, // Require confirmation for writes
      allowExecuteByDefault: false,
      alwaysConfirm: ["delete", "execute"], // Always confirm dangerous operations
      ...settings,
    };
  }

  /**
   * Set webview provider for permission requests
   */
  setWebviewProvider(provider: any): void {
    this.webviewProvider = provider;
  }

  /**
   * Handle permission response from webview
   */
  handlePermissionResponse(requestId: string, approved: boolean): void {
    const resolver = this.pendingRequests.get(requestId);
    if (resolver) {
      resolver(approved);
      this.pendingRequests.delete(requestId);
    }
  }

  /**
   * Check if an operation is allowed
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
   *
   * @param request Permission request details
   * @returns Promise<boolean> True if operation is allowed
   */
  async checkPermission(request: PermissionRequest): Promise<boolean> {
    // Check if this operation always requires confirmation (Requirement 5.5)
    const requiresConfirmation = this.settings.alwaysConfirm.includes(
      request.operation
    );

    if (requiresConfirmation) {
      return await this.requestUserConfirmation(request);
    }

    // Check default permissions based on operation type
    switch (request.operation.toLowerCase()) {
      case "read":
        // Requirement 5.3: Auto-approve reads if allowed by default
        if (this.settings.allowReadByDefault) {
          logger.debug(
            `[PermissionManager] Auto-approved read operation: ${request.target}`
          );
          return true;
        }
        break;

      case "write":
      case "modify":
        // Requirement 5.4: Check write permission setting
        if (this.settings.allowWriteByDefault) {
          logger.debug(
            `[PermissionManager] Auto-approved write operation: ${request.target}`
          );
          return true;
        }
        break;

      case "execute":
        if (this.settings.allowExecuteByDefault) {
          logger.debug(
            `[PermissionManager] Auto-approved execute operation: ${request.target}`
          );
          return true;
        }
        break;
    }

    // If not auto-approved, request user confirmation
    return await this.requestUserConfirmation(request);
  }

  /**
   * Request user confirmation for an operation
   *
   * @param request Permission request details
   * @returns Promise<boolean> True if user approved
   */
  private async requestUserConfirmation(
    request: PermissionRequest
  ): Promise<boolean> {
    // If webview provider is available, use webview for confirmation
    if (this.webviewProvider) {
      return await this.requestWebviewConfirmation(request);
    }

    // Fallback to VSCode modal dialog
    const message = this.buildConfirmationMessage(request);
    const result = await vscode.window.showWarningMessage(
      message,
      { modal: true },
      "Allow",
      "Deny"
    );

    const approved = result === "Allow";

    if (approved) {
      logger.debug(
        `[PermissionManager] User approved: ${request.toolName} - ${request.operation} on ${request.target}`
      );
    } else {
      logger.debug(
        `[PermissionManager] User denied: ${request.toolName} - ${request.operation} on ${request.target}`
      );
    }

    return approved;
  }

  /**
   * Request confirmation through webview
   */
  private async requestWebviewConfirmation(
    request: PermissionRequest
  ): Promise<boolean> {
    const requestId = `perm-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const requestWithId: PermissionRequestWithId = {
      id: requestId,
      ...request,
    };

    // Send permission request to webview
    this.webviewProvider.postMessageToWebview({
      type: "permission_request",
      request: requestWithId,
    });

    // Wait for response
    return new Promise<boolean>((resolve) => {
      this.pendingRequests.set(requestId, resolve);

      // Timeout after 5 minutes
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          logger.debug(
            `[PermissionManager] Permission request ${requestId} timed out`
          );
          resolve(false);
        }
      }, 5 * 60 * 1000);
    });
  }

  /**
   * Build a user-friendly confirmation message
   *
   */
  private buildConfirmationMessage(request: PermissionRequest): string {
    let message = `AI Agent wants to ${request.operation}:\n\n`;
    message += `Tool: ${request.toolName}\n`;
    message += `Target: ${request.target}\n`;

    if (request.details) {
      message += `\nDetails:\n${request.details}`;
    }

    return message;
  }

  /**
   * Update permission settings
   * @param settings Partial settings to update
   */
  updateSettings(settings: Partial<PermissionSettings>): void {
    this.settings = {
      ...this.settings,
      ...settings,
    };
    logger.debug("[PermissionManager] Settings updated:", this.settings);
  }

  /**
   * Get current permission settings
   * @returns Current permission settings
   */
  getSettings(): PermissionSettings {
    return { ...this.settings };
  }

  /**
   * Reset settings to defaults
   */
  resetSettings(): void {
    this.settings = {
      allowReadByDefault: true,
      allowWriteByDefault: false,
      allowExecuteByDefault: false,
      alwaysConfirm: ["delete", "execute"],
    };
    logger.debug("[PermissionManager] Settings reset to defaults");
}
}
