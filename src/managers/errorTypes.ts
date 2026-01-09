import { ErrorType } from "code-sidecar-shared/types/errors";

export type AppErrorOptions = {
  type: ErrorType;
  message: string;
  userMessage?: string;
  recoveryAction?: string;
  technicalDetails?: string;
  retryable?: boolean;
  cause?: unknown;
};

export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly userMessage?: string;
  public readonly recoveryAction?: string;
  public readonly technicalDetails?: string;
  public readonly retryable?: boolean;
  public readonly cause?: unknown;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = "AppError";
    this.type = options.type;
    this.userMessage = options.userMessage;
    this.recoveryAction = options.recoveryAction;
    this.technicalDetails = options.technicalDetails;
    this.retryable = options.retryable;
    this.cause = options.cause;
  }
}

export interface ErrorContext {
  type?: ErrorType;
  operation: string;
  timestamp: Date;
  userMessage?: string;
  stackTrace?: string;
  additionalInfo?: Record<string, any>;
}

export interface ErrorResponse {
  type: ErrorType;
  userMessage: string;
  shouldRetry: boolean;
  recoveryAction?: string;
  technicalDetails?: string;
}

export interface ErrorLogEntry {
  id: string;
  type: ErrorType;
  message: string;
  context: ErrorContext;
  timestamp: Date;
  resolved: boolean;
}
