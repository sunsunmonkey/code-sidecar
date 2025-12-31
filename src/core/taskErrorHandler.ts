import { ErrorContext, ErrorHandler } from "../managers";
import { logger } from "code-sidecar-shared/utils/logger";
import type { WebviewMessage } from "code-sidecar-shared/types/messages";

type TaskErrorHandlerOptions = {
  errorHandler: ErrorHandler;
  postMessage: (message: WebviewMessage) => void;
  getContext: () => {
    taskId: string;
    loopCount: number;
    displayMessage: string;
  };
  retry: () => Promise<void>;
  completeTask: () => void;
};

export class TaskErrorHandler {
  constructor(private options: TaskErrorHandlerOptions) {}

  async handle(error: unknown, operation: string): Promise<void> {
    const { taskId, loopCount, displayMessage } = this.options.getContext();
    const errorContext: ErrorContext = {
      operation,
      timestamp: new Date(),
      userMessage: displayMessage,
      additionalInfo: {
        taskId,
        loopCount,
      },
    };

    const errorResponse = this.options.errorHandler.handleError(
      error,
      errorContext
    );

    this.options.postMessage({
      type: "error",
      message: errorResponse.userMessage,
    });

    if (errorResponse.shouldRetry) {
      const canRecover = await this.options.errorHandler.attemptRecovery(
        error,
        errorContext
      );

      if (canRecover) {
        logger.debug(`[Task ${taskId}] Attempting recovery for ${operation}`);

        if (this.options.errorHandler.isRetryable(error)) {
          await new Promise((resolve) => setTimeout(resolve, 1000));

          try {
            await this.options.retry();
            this.options.errorHandler.resetRetryAttempts(operation);
            return;
          } catch (retryError) {
            await this.handle(retryError, operation);
            return;
          }
        }
      }
    }

    logger.debug(`[Task ${taskId}] Task failed due to error in ${operation}`);
    this.options.completeTask();
  }
}
