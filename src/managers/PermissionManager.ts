import * as vscode from 'vscode';

/**
 * Permission settings for tool operations
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
export interface PermissionSettings {
  /**
   * Default allow read operations without confirmation
   * Requirement: 5.3
   */
  allowReadByDefault: boolean;

  /**
   * Default allow write operations without confirmation
   * Requirement: 5.4
   */
  allowWriteByDefault: boolean;

  /**
   * Default allow command execution without confirmation
   */
  allowExecuteByDefault: boolean;

  /**
   * Operations that always require confirmation regardless of defaults
   * Requirement: 5.5
   */
  alwaysConfirm: string[];
}

/**
 * Permission request details
 * Requirements: 5.1, 5.2
 */
export interface PermissionRequest {
  /**
   * Name of the tool requesting permission
   */
  toolName: string;

  /**
   * Type of operation (read, write, execute, delete)
   */
  operation: string;

  /**
   * Target of the operation (file path, command, etc.)
   */
  target: string;

  /**
   * Additional details about the operation
   * Requirement: 5.2
   */
  details: string;
}

/**
 * PermissionManager handles user authorization for tool operations
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
export class PermissionManager {
  private settings: PermissionSettings;

  constructor(settings?: Partial<PermissionSettings>) {
    // Default settings
    this.settings = {
      allowReadByDefault: true,  // Requirement 5.3: Allow reads by default
      allowWriteByDefault: false, // Requirement 5.4: Require confirmation for writes
      allowExecuteByDefault: false,
      alwaysConfirm: ['delete', 'execute'], // Requirement 5.5: Always confirm dangerous operations
      ...settings,
    };
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
    const requiresConfirmation = this.settings.alwaysConfirm.includes(request.operation);

    if (requiresConfirmation) {
      return await this.requestUserConfirmation(request);
    }

    // Check default permissions based on operation type
    switch (request.operation.toLowerCase()) {
      case 'read':
        // Requirement 5.3: Auto-approve reads if allowed by default
        if (this.settings.allowReadByDefault) {
          console.log(`[PermissionManager] Auto-approved read operation: ${request.target}`);
          return true;
        }
        break;

      case 'write':
      case 'modify':
        // Requirement 5.4: Check write permission setting
        if (this.settings.allowWriteByDefault) {
          console.log(`[PermissionManager] Auto-approved write operation: ${request.target}`);
          return true;
        }
        break;

      case 'execute':
        if (this.settings.allowExecuteByDefault) {
          console.log(`[PermissionManager] Auto-approved execute operation: ${request.target}`);
          return true;
        }
        break;
    }

    // If not auto-approved, request user confirmation
    return await this.requestUserConfirmation(request);
  }

  /**
   * Request user confirmation for an operation
   * Requirements: 5.2, 5.5
   * 
   * @param request Permission request details
   * @returns Promise<boolean> True if user approved
   */
  private async requestUserConfirmation(request: PermissionRequest): Promise<boolean> {
    // Build confirmation message (Requirement 5.2: Include details)
    const message = this.buildConfirmationMessage(request);

    // Show warning message with options (Requirement 5.2)
    const result = await vscode.window.showWarningMessage(
      message,
      { modal: true },
      'Allow',
      'Deny'
    );

    const approved = result === 'Allow';
    
    if (approved) {
      console.log(`[PermissionManager] User approved: ${request.toolName} - ${request.operation} on ${request.target}`);
    } else {
      console.log(`[PermissionManager] User denied: ${request.toolName} - ${request.operation} on ${request.target}`);
    }

    return approved;
  }

  /**
   * Build a user-friendly confirmation message
   * Requirement: 5.2
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
    console.log('[PermissionManager] Settings updated:', this.settings);
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
      alwaysConfirm: ['delete', 'execute'],
    };
    console.log('[PermissionManager] Settings reset to defaults');
  }
}
