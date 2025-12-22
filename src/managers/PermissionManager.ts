import * as vscode from "vscode";
import type {
  PermissionRequest,
  PermissionRequestWithId,
} from "coding-agent-shared/types/permissions";
import {
  DEFAULT_PERMISSION_SETTINGS,
  type PermissionSettings,
} from "coding-agent-shared/types/config";
import { logger } from "coding-agent-shared/utils/logger";

type PermissionSettingsWithDefaults = Required<PermissionSettings>;

const OPERATION_DEFAULTS: Record<
  string,
  keyof PermissionSettingsWithDefaults
> = {
  read: "allowReadByDefault",
  write: "allowWriteByDefault",
  modify: "allowWriteByDefault",
  execute: "allowExecuteByDefault",
};

const normalizeOperation = (operation: string): string =>
  operation.trim().toLowerCase();

/**
 * PermissionManager handles user authorization for tool operations
 */
export class PermissionManager {
  private settings: PermissionSettingsWithDefaults;

  private webviewProvider: any;
  private pendingRequests: Map<string, (approved: boolean) => void> = new Map();

  private static mergeSettings(
    base: PermissionSettingsWithDefaults,
    updates?: Partial<PermissionSettings>
  ): PermissionSettingsWithDefaults {
    const alwaysConfirm = (updates?.alwaysConfirm ?? base.alwaysConfirm).map(
      (operation) => operation.trim().toLowerCase()
    );

    return {
      allowReadByDefault:
        updates?.allowReadByDefault ?? base.allowReadByDefault,
      allowWriteByDefault:
        updates?.allowWriteByDefault ?? base.allowWriteByDefault,
      allowExecuteByDefault:
        updates?.allowExecuteByDefault ?? base.allowExecuteByDefault,
      alwaysConfirm,
    };
  }

  constructor(settings?: Partial<PermissionSettings>) {
    this.settings = PermissionManager.mergeSettings(
      DEFAULT_PERMISSION_SETTINGS,
      settings
    );
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
    const operation = normalizeOperation(request.operation);
    const defaultSetting = OPERATION_DEFAULTS[operation];

    // Check if this operation always requires confirmation (Requirement 5.5)
    if (this.settings.alwaysConfirm.includes(operation)) {
      return await this.requestUserConfirmation(request);
    }

    // Check default permissions based on operation type
    if (defaultSetting && this.settings[defaultSetting]) {
      logger.debug(
        `[PermissionManager] Auto-approved ${operation} operation: ${request.target}`
      );
      return true;
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
    const decision = approved ? "approved" : "denied";
    logger.debug(
      `[PermissionManager] User ${decision}: ${request.toolName} - ${request.operation} on ${request.target}`
    );

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
      .slice(2, 11)}`;

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
    this.settings = PermissionManager.mergeSettings(this.settings, settings);
    logger.debug("[PermissionManager] Settings updated:", this.settings);
  }

  /**
   * Get current permission settings
   * @returns Current permission settings
   */
  getSettings(): PermissionSettings {
    return {
      ...this.settings,
      alwaysConfirm: [...this.settings.alwaysConfirm],
    };
  }
}
