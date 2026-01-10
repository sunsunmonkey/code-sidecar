import { ConversationHistoryManager } from "../managers/ConversationHistoryManager";
import { AppError, ErrorHandler } from "../managers";
import { logger } from "code-sidecar-shared/utils/logger";
import type {
  DisplayMessage,
  HistoryItem,
  WebviewMessage,
} from "code-sidecar-shared/types/messages";
import { ErrorType } from "code-sidecar-shared/types/errors";

type ConversationControllerOptions = {
  conversationHistoryManager: ConversationHistoryManager;
  errorHandler: ErrorHandler;
  postMessage: (message: WebviewMessage) => void;
  cancelCurrentTask: () => void;
};

export class ConversationController {
  constructor(private options: ConversationControllerOptions) {}

  private postError(
    error: unknown,
    operation: string,
    userMessage: string,
    recoveryAction = "Try again."
  ): void {
    const technicalDetails =
      error instanceof Error ? error.message : String(error);
    const appError = new AppError({
      type: ErrorType.SYSTEM_ERROR,
      message: technicalDetails,
      userMessage,
      recoveryAction,
      technicalDetails,
      retryable: false,
      cause: error,
    });
    const errorPayload = this.options.errorHandler.createErrorPayload(appError, {
      operation,
      timestamp: new Date(),
      userMessage,
    });

    this.options.postMessage({
      type: "error",
      error: errorPayload,
    });
  }

  handleClearConversation(): void {
    try {
      this.options.cancelCurrentTask();
      this.options.conversationHistoryManager.clearConversation();

      this.options.postMessage({
        type: "conversation_cleared",
      });

      logger.debug("[ConversationController] Conversation cleared");
    } catch (error) {
      logger.debug(
        "[ConversationController] Failed to clear conversation:",
        error
      );
      this.postError(error, "clear_conversation", "Failed to clear conversation.");
    }
  }

  handleClearConversationHistory(): void {
    try {
      this.options.cancelCurrentTask();
      this.options.conversationHistoryManager.clearAllConversations();

      this.options.postMessage({
        type: "conversation_history",
        messages: [],
      });

      this.options.postMessage({
        type: "conversation_cleared",
      });

      this.handleGetConversationList();

      logger.debug("[ConversationController] Conversation history cleared");
    } catch (error) {
      logger.debug(
        "[ConversationController] Failed to clear conversation history:",
        error
      );
      this.postError(
        error,
        "clear_conversation_history",
        "Failed to clear conversation history."
      );
    }
  }

  handleGetConversationHistory(): void {
    try {
      const messages = this.options.conversationHistoryManager.getMessages();

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

      this.options.postMessage({
        type: "conversation_history",
        messages: displayMessages,
      });

      logger.debug(
        `[ConversationController] Sent ${displayMessages.length} messages to webview`
      );
    } catch (error) {
      logger.debug(
        "[ConversationController] Failed to get conversation history:",
        error
      );
      this.postError(
        error,
        "get_conversation_history",
        "Failed to load conversation history."
      );
    }
  }

  handleNewConversation(): void {
    try {
      this.options.cancelCurrentTask();
      this.options.conversationHistoryManager.clearConversation();

      this.options.postMessage({
        type: "conversation_history",
        messages: [],
      });

      this.options.postMessage({
        type: "conversation_cleared",
      });

      logger.debug("[ConversationController] New conversation started");
    } catch (error) {
      logger.debug(
        "[ConversationController] Failed to start new conversation:",
        error
      );
      this.postError(
        error,
        "new_conversation",
        "Failed to start a new conversation."
      );
    }
  }

  handleGetConversationList(): void {
    try {
      const conversations =
        this.options.conversationHistoryManager.getConversationHistory();
      const currentId =
        this.options.conversationHistoryManager.getCurrentConversationId();
      logger.debug(conversations);

      const formattedConversations = conversations.map((conv) => ({
        id: conv.id,
        timestamp: conv.timestamp,
        messageCount: conv.messages.length,
        preview: this.getConversationPreview(conv.messages),
        isCurrent: conv.id === currentId,
      }));

      logger.debug(
        "ConversationController handleGetConversationList formattedConversations:",
        formattedConversations
      );

      formattedConversations.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      this.options.postMessage({
        type: "conversation_list",
        conversations: formattedConversations,
      });

      logger.debug(
        `[ConversationController] Sent ${formattedConversations.length} conversations to webview`
      );
    } catch (error) {
      logger.debug(
        "[ConversationController] Failed to get conversation list:",
        error
      );
      this.postError(
        error,
        "get_conversation_list",
        "Failed to load conversation list."
      );
    }
  }

  handleSwitchConversation(conversationId: string): void {
    try {
      this.options.cancelCurrentTask();
      const success =
        this.options.conversationHistoryManager.restoreConversation(
          conversationId
        );

      if (success) {
        this.handleGetConversationHistory();

        logger.debug(
          `[ConversationController] Switched to conversation: ${conversationId}`
        );
      } else {
        const missingConversationError = new Error(
          `Conversation not found: ${conversationId}`
        );
        this.postError(
          missingConversationError,
          "switch_conversation",
          "Failed to switch conversation."
        );
      }
    } catch (error) {
      logger.debug(
        "[ConversationController] Failed to switch conversation:",
        error
      );
      this.postError(
        error,
        "switch_conversation",
        "Failed to switch conversation."
      );
    }
  }

  handleDeleteConversation(conversationId: string): void {
    logger.debug(
      `[ConversationController] Received delete request for: ${conversationId}`
    );
    try {
      const currentConversationId =
        this.options.conversationHistoryManager.getCurrentConversationId();
      const isCurrentConversation = currentConversationId === conversationId;

      if (isCurrentConversation) {
        this.options.cancelCurrentTask();
      }
      const success =
        this.options.conversationHistoryManager.deleteConversation(
          conversationId
        );

      logger.debug(`[ConversationController] Delete result: ${success}`);

      if (success) {
        if (isCurrentConversation) {
          this.options.conversationHistoryManager.startNewConversation();
          this.options.postMessage({ type: "conversation_cleared" });
        }

        this.options.postMessage({
          type: "conversation_deleted",
          conversationId: conversationId,
        });

        this.handleGetConversationList();

        logger.debug(
          `[ConversationController] Deleted conversation: ${conversationId}`
        );
      } else {
        logger.debug(
          `[ConversationController] Failed to delete conversation: ${conversationId}`
        );
        const missingConversationError = new Error(
          `Conversation not found: ${conversationId}`
        );
        this.postError(
          missingConversationError,
          "delete_conversation",
          "Failed to delete conversation."
        );
      }
    } catch (error) {
      logger.debug(
        "[ConversationController] Failed to delete conversation:",
        error
      );
      this.postError(
        error,
        "delete_conversation",
        "Failed to delete conversation."
      );
    }
  }

  private getConversationPreview(messages: HistoryItem[]): string {
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
}
