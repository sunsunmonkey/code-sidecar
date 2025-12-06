/**
 * Error Handler for managing and recovering from various error types
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

/**
 * Error types that can occur in the system
 */
export enum ErrorType {
  API_ERROR = 'api_error',
  TOOL_ERROR = 'tool_error',
  PARSING_ERROR = 'parsing_error',
  NETWORK_ERROR = 'network_error',
  PERMISSION_ERROR = 'permission_error',
  CONFIGURATION_ERROR = 'configuration_error',
  SYSTEM_ERROR = 'system_error',
  UNKNOWN_ERROR = 'unknown_error',
}

/**
 * Error context information
 */
export interface ErrorContext {
  operation: string;
  timestamp: Date;
  userMessage?: string;
  stackTrace?: string;
  additionalInfo?: Record<string, any>;
}

/**
 * Error response with user-friendly message and recovery options
 */
export interface ErrorResponse {
  userMessage: string;
  shouldRetry: boolean;
  recoveryAction?: string;
  technicalDetails?: string;
}

/**
 * Error log entry
 */
export interface ErrorLogEntry {
  id: string;
  type: ErrorType;
  message: string;
  context: ErrorContext;
  timestamp: Date;
  resolved: boolean;
}

/**
 * ErrorHandler class manages error handling, logging, and recovery
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */
export class ErrorHandler {
  private errorLog: ErrorLogEntry[] = [];
  private readonly MAX_LOG_SIZE = 100;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private retryAttempts: Map<string, number> = new Map();

  /**
   * Handle an error and return appropriate response
   * Requirements: 12.1, 12.2, 12.3
   * @param error The error to handle
   * @param context Error context information
   * @returns ErrorResponse with user-friendly message and recovery options
   */
  handleError(error: Error | unknown, context: ErrorContext): ErrorResponse {
    const errorType = this.classifyError(error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stackTrace = error instanceof Error ? error.stack : undefined;

    // Log the error (Requirement 12.4)
    this.logError(errorType, errorMessage, {
      ...context,
      stackTrace,
    });

    // Generate user-friendly response based on error type
    return this.generateErrorResponse(errorType, errorMessage, context);
  }

  /**
   * Classify error into specific error type
   * Requirement 12.1, 12.2
   */
  private classifyError(error: Error | unknown): ErrorType {
    if (!(error instanceof Error)) {
      return ErrorType.UNKNOWN_ERROR;
    }

    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // API errors (Requirement 12.1)
    if (
      message.includes('api') ||
      message.includes('authentication') ||
      message.includes('unauthorized') ||
      message.includes('rate limit') ||
      name.includes('apierror')
    ) {
      return ErrorType.API_ERROR;
    }

    // Network errors (Requirement 12.4)
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('fetch failed') ||
      name.includes('networkerror')
    ) {
      return ErrorType.NETWORK_ERROR;
    }

    // Tool execution errors (Requirement 12.2)
    if (
      message.includes('tool') ||
      message.includes('file not found') ||
      message.includes('enoent') ||
      message.includes('permission denied') ||
      message.includes('eacces')
    ) {
      return ErrorType.TOOL_ERROR;
    }

    // Permission errors (Requirement 12.3)
    if (
      message.includes('permission') ||
      message.includes('access denied') ||
      message.includes('unauthorized')
    ) {
      return ErrorType.PERMISSION_ERROR;
    }

    // Parsing errors (Requirement 12.2)
    if (
      message.includes('parse') ||
      message.includes('xml') ||
      message.includes('json') ||
      message.includes('syntax') ||
      name.includes('syntaxerror')
    ) {
      return ErrorType.PARSING_ERROR;
    }

    // Configuration errors (Requirement 12.1)
    if (
      message.includes('configuration') ||
      message.includes('config') ||
      message.includes('not configured')
    ) {
      return ErrorType.CONFIGURATION_ERROR;
    }

    // System errors (Requirement 12.5)
    if (
      message.includes('memory') ||
      message.includes('disk') ||
      message.includes('system')
    ) {
      return ErrorType.SYSTEM_ERROR;
    }

    return ErrorType.UNKNOWN_ERROR;
  }

  /**
   * Generate user-friendly error response
   * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
   */
  private generateErrorResponse(
    errorType: ErrorType,
    errorMessage: string,
    context: ErrorContext
  ): ErrorResponse {
    switch (errorType) {
      case ErrorType.API_ERROR:
        return this.handleApiError(errorMessage, context);

      case ErrorType.NETWORK_ERROR:
        return this.handleNetworkError(errorMessage, context);

      case ErrorType.TOOL_ERROR:
        return this.handleToolError(errorMessage, context);

      case ErrorType.PERMISSION_ERROR:
        return this.handlePermissionError(errorMessage, context);

      case ErrorType.PARSING_ERROR:
        return this.handleParsingError(errorMessage, context);

      case ErrorType.CONFIGURATION_ERROR:
        return this.handleConfigurationError(errorMessage, context);

      case ErrorType.SYSTEM_ERROR:
        return this.handleSystemError(errorMessage, context);

      case ErrorType.UNKNOWN_ERROR:
      default:
        return this.handleUnknownError(errorMessage, context);
    }
  }

  /**
   * Handle API errors
   */
  private handleApiError(message: string, context: ErrorContext): ErrorResponse {
    if (message.includes('authentication') || message.includes('unauthorized')) {
      return {
        userMessage: '❌ API authentication failed. Please check your API key in settings.',
        shouldRetry: false,
        recoveryAction: 'Update your API key in the extension settings.',
        technicalDetails: message,
      };
    }

    if (message.includes('rate limit')) {
      return {
        userMessage: '⏱️ API rate limit exceeded. Please wait a moment before trying again.',
        shouldRetry: true,
        recoveryAction: 'Wait a few minutes and retry your request.',
        technicalDetails: message,
      };
    }

    return {
      userMessage: `❌ API error occurred: ${this.sanitizeErrorMessage(message)}`,
      shouldRetry: false,
      recoveryAction: 'Check your API configuration and try again.',
      technicalDetails: message,
    };
  }

  /**
   * Handle network errors with automatic retry
   * Requirement 12.4
   */
  private handleNetworkError(message: string, context: ErrorContext): ErrorResponse {
    const operationKey = context.operation;
    const attempts = this.retryAttempts.get(operationKey) || 0;

    if (attempts < this.MAX_RETRY_ATTEMPTS) {
      this.retryAttempts.set(operationKey, attempts + 1);
      return {
        userMessage: `🔄 Network error occurred. Retrying... (Attempt ${attempts + 1}/${this.MAX_RETRY_ATTEMPTS})`,
        shouldRetry: true,
        recoveryAction: 'Automatic retry in progress.',
        technicalDetails: message,
      };
    }

    // Max retries reached
    this.retryAttempts.delete(operationKey);
    return {
      userMessage: '❌ Network connection failed after multiple attempts. Please check your internet connection.',
      shouldRetry: false,
      recoveryAction: 'Check your network connection and try again.',
      technicalDetails: message,
    };
  }

  /**
   * Handle tool execution errors
   * Requirement 12.2
   */
  private handleToolError(message: string, context: ErrorContext): ErrorResponse {
    if (message.includes('file not found') || message.includes('enoent')) {
      return {
        userMessage: '📁 File not found. The specified file does not exist.',
        shouldRetry: false,
        recoveryAction: 'Verify the file path and try again.',
        technicalDetails: message,
      };
    }

    if (message.includes('permission denied') || message.includes('eacces')) {
      return {
        userMessage: '🔒 Permission denied. Insufficient permissions to access the file or directory.',
        shouldRetry: false,
        recoveryAction: 'Check file permissions or run with appropriate access rights.',
        technicalDetails: message,
      };
    }

    return {
      userMessage: `⚠️ Tool execution failed: ${this.sanitizeErrorMessage(message)}`,
      shouldRetry: false,
      recoveryAction: 'Review the error details and adjust your request.',
      technicalDetails: message,
    };
  }

  /**
   * Handle permission errors
   * Requirement 12.3
   */
  private handlePermissionError(message: string, context: ErrorContext): ErrorResponse {
    return {
      userMessage: '🔒 Permission denied. You need to grant permission for this operation.',
      shouldRetry: false,
      recoveryAction: 'Update your permission settings or approve the operation when prompted.',
      technicalDetails: message,
    };
  }

  /**
   * Handle parsing errors
   * Requirement 12.2
   */
  private handleParsingError(message: string, context: ErrorContext): ErrorResponse {
    return {
      userMessage: '⚠️ Failed to parse response. The AI response format was invalid.',
      shouldRetry: true,
      recoveryAction: 'The system will retry the request with corrected formatting.',
      technicalDetails: message,
    };
  }

  /**
   * Handle configuration errors
   * Requirement 12.1
   */
  private handleConfigurationError(message: string, context: ErrorContext): ErrorResponse {
    return {
      userMessage: '⚙️ Configuration error. Please check your extension settings.',
      shouldRetry: false,
      recoveryAction: 'Review and update your configuration in the extension settings.',
      technicalDetails: message,
    };
  }

  /**
   * Handle system errors
   * Requirement 12.5
   */
  private handleSystemError(message: string, context: ErrorContext): ErrorResponse {
    return {
      userMessage: '💥 System error occurred. This may be due to resource constraints.',
      shouldRetry: false,
      recoveryAction: 'Try closing other applications or restarting VS Code.',
      technicalDetails: message,
    };
  }

  /**
   * Handle unknown errors
   * Requirement 12.5
   */
  private handleUnknownError(message: string, context: ErrorContext): ErrorResponse {
    return {
      userMessage: `❌ An unexpected error occurred: ${this.sanitizeErrorMessage(message)}`,
      shouldRetry: false,
      recoveryAction: 'Please try again or report this issue if it persists.',
      technicalDetails: message,
    };
  }

  /**
   * Attempt to recover from an error
   * Requirement 12.5
   * @param error The error to recover from
   * @param context Error context
   * @returns Promise<boolean> indicating if recovery was successful
   */
  async attemptRecovery(error: Error | unknown, context: ErrorContext): Promise<boolean> {
    const errorType = this.classifyError(error);

    // Only attempt automatic recovery for network errors
    if (errorType === ErrorType.NETWORK_ERROR) {
      const operationKey = context.operation;
      const attempts = this.retryAttempts.get(operationKey) || 0;

      if (attempts < this.MAX_RETRY_ATTEMPTS) {
        console.log(`[ErrorHandler] Attempting recovery for ${operationKey}, attempt ${attempts + 1}`);
        return true; // Signal that retry should be attempted
      }
    }

    return false; // No automatic recovery available
  }

  /**
   * Log an error
   * Requirement 12.4
   * @param type Error type
   * @param message Error message
   * @param context Error context
   */
  logError(type: ErrorType, message: string, context: ErrorContext): void {
    const entry: ErrorLogEntry = {
      id: `error-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      type,
      message,
      context,
      timestamp: new Date(),
      resolved: false,
    };

    this.errorLog.push(entry);

    // Maintain log size limit
    if (this.errorLog.length > this.MAX_LOG_SIZE) {
      this.errorLog.shift();
    }

    // Console logging for debugging
    console.error(`[ErrorHandler] ${type}: ${message}`, context);
  }

  /**
   * Mark an error as resolved
   * @param errorId Error ID to mark as resolved
   */
  markErrorResolved(errorId: string): void {
    const entry = this.errorLog.find(e => e.id === errorId);
    if (entry) {
      entry.resolved = true;
    }
  }

  /**
   * Get error log
   * @returns Array of error log entries
   */
  getErrorLog(): ErrorLogEntry[] {
    return [...this.errorLog];
  }

  /**
   * Get unresolved errors
   * @returns Array of unresolved error log entries
   */
  getUnresolvedErrors(): ErrorLogEntry[] {
    return this.errorLog.filter(e => !e.resolved);
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
    this.retryAttempts.clear();
    console.log('[ErrorHandler] Error log cleared');
  }

  /**
   * Reset retry attempts for an operation
   * @param operation Operation key
   */
  resetRetryAttempts(operation: string): void {
    this.retryAttempts.delete(operation);
  }

  /**
   * Get retry attempts for an operation
   * @param operation Operation key
   * @returns Number of retry attempts
   */
  getRetryAttempts(operation: string): number {
    return this.retryAttempts.get(operation) || 0;
  }

  /**
   * Sanitize error message for user display
   * Removes technical details and stack traces
   */
  private sanitizeErrorMessage(message: string): string {
    // Remove stack traces
    const lines = message.split('\n');
    const firstLine = lines[0];

    // Truncate long messages
    if (firstLine.length > 200) {
      return firstLine.substring(0, 200) + '...';
    }

    return firstLine;
  }

  /**
   * Check if an error is retryable
   * @param error The error to check
   * @returns boolean indicating if error is retryable
   */
  isRetryable(error: Error | unknown): boolean {
    const errorType = this.classifyError(error);
    return errorType === ErrorType.NETWORK_ERROR || errorType === ErrorType.PARSING_ERROR;
  }

  /**
   * Get error statistics
   * @returns Object with error statistics
   */
  getErrorStatistics(): {
    total: number;
    byType: Record<ErrorType, number>;
    resolved: number;
    unresolved: number;
  } {
    const stats = {
      total: this.errorLog.length,
      byType: {} as Record<ErrorType, number>,
      resolved: 0,
      unresolved: 0,
    };

    // Initialize all error types to 0
    Object.values(ErrorType).forEach(type => {
      stats.byType[type] = 0;
    });

    // Count errors by type and resolution status
    this.errorLog.forEach(entry => {
      stats.byType[entry.type]++;
      if (entry.resolved) {
        stats.resolved++;
      } else {
        stats.unresolved++;
      }
    });

    return stats;
  }
}
