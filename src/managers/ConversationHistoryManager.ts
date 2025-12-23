import * as vscode from "vscode";
import { HistoryItem } from "../core/apiHandler";
import { logger } from "code-sidecar-shared/utils/logger";

/**
 * Conversation history entry for persistence
 */
export interface ConversationEntry {
  id: string;
  timestamp: Date;
  messages: HistoryItem[];
}

/**
 * Configuration for history management
 */
export interface HistoryConfig {
  maxTokens: number;
  maxMessages: number;
  estimatedCharsPerToken: number;
}

/**
 * Conversation History Manager
 * Handles persistence, loading, and intelligent truncation of conversation history
 */
export class ConversationHistoryManager {
  private static readonly HISTORY_KEY = "codeSidecar.conversationHistory";

  private currentConversation: ConversationEntry | null = null;

  constructor(private context: vscode.ExtensionContext) {
    // start new conversation
    this.startNewConversation();
  }

  /**
   * Start a new conversation
   */
  startNewConversation(): void {
    this.currentConversation = {
      id: this.generateConversationId(),
      timestamp: new Date(),
      messages: [],
    };

    this.saveCurrentConversation();
  }

  /**
   * Add a message to the current conversation
   */
  addMessage(message: HistoryItem): void {
    if (!this.currentConversation) {
      this.startNewConversation();
    }

    this.currentConversation!.messages.push(message);
    this.saveCurrentConversation();
  }

  /**
   * Add multiple messages to the current conversation
   */
  updateMessages(messages: HistoryItem[]): void {
    if (!this.currentConversation) {
      this.startNewConversation();
    }

    this.currentConversation!.messages = messages;
    this.saveCurrentConversation();
  }

  /**
   * Get current conversation messages
   */
  getMessages(): HistoryItem[] {
    if (!this.currentConversation) {
      this.startNewConversation();
    }

    return this.currentConversation!.messages;
  }

  /**
   * Clear current conversation
   */
  clearConversation(): void {
    if (
      this.currentConversation &&
      this.currentConversation.messages.length > 0
    ) {
      // Archive current conversation before clearing only if it has messages
      this.archiveConversation(this.currentConversation);
    }

    this.startNewConversation();
    logger.debug("[ConversationHistoryManager] Conversation cleared");
  }

  /**
   * Delete a conversation from history
   */
  deleteConversation(conversationId: string): boolean {
    const history = this.context.workspaceState.get<ConversationEntry[]>(
      ConversationHistoryManager.HISTORY_KEY,
      []
    );

    const filteredHistory = history.filter((c) => c.id !== conversationId);

    if (filteredHistory.length === history.length) {
      logger.debug(
        `[ConversationHistoryManager] Conversation not found: ${conversationId}`
      );
      return false;
    }

    this.context.workspaceState.update(
      ConversationHistoryManager.HISTORY_KEY,
      filteredHistory
    );

    logger.debug(
      `[ConversationHistoryManager] Deleted conversation: ${conversationId}`
    );
    return true;
  }

  /**
   * Save current conversation to storage
   */
  private saveCurrentConversation(): void {
    if (!this.currentConversation) {
      return;
    }

    if (this.currentConversation.messages.length === 0) {
      return;
    }

    const history = this.context.workspaceState.get<ConversationEntry[]>(
      ConversationHistoryManager.HISTORY_KEY,
      []
    );

    const historyIndex = history.findIndex(
      (item) => item.id === this.currentConversation?.id
    );
    if (historyIndex >= 0) {
      history[historyIndex] = this.currentConversation;
    } else {
      history.push(this.currentConversation);
    }

    this.context.workspaceState.update(
      ConversationHistoryManager.HISTORY_KEY,
      history
    );
  }

  /**
   * Archive a conversation to history
   */
  private archiveConversation(conversation: ConversationEntry): void {
    try {
      // Don't archive empty conversations
      if (!conversation.messages || conversation.messages.length === 0) {
        return;
      }

      const history = this.context.workspaceState.get<ConversationEntry[]>(
        ConversationHistoryManager.HISTORY_KEY,
        []
      );

      // Check if conversation already exists in history
      const existingIndex = history.findIndex((c) => c.id === conversation.id);
      if (existingIndex >= 0) {
        // Update existing conversation
        history[existingIndex] = conversation;
      } else {
        // Add to history
        history.push(conversation);
      }

      // Keep only recent conversations (limit to 50)
      const recentHistory = history.slice(-50);

      this.context.workspaceState.update(
        ConversationHistoryManager.HISTORY_KEY,
        recentHistory
      );

      logger.debug(
        `[ConversationHistoryManager] Archived conversation: ${conversation.id} with ${conversation.messages.length} messages`
      );
    } catch (error) {
      logger.debug(
        "[ConversationHistoryManager] Failed to archive conversation:",
        error
      );
    }
  }

  /**
   * Generate a unique conversation ID
   */
  private generateConversationId(): string {
    return `conv-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Get conversation history (archived conversations)
   * Requirement 4.3: Load and restore conversation history
   */
  getConversationHistory(): ConversationEntry[] {
    try {
      const history = this.context.workspaceState.get<ConversationEntry[]>(
        ConversationHistoryManager.HISTORY_KEY,
        []
      );

      // Restore Date objects
      return history.map((entry) => ({
        ...entry,
        timestamp: new Date(entry.timestamp),
      }));
    } catch (error) {
      logger.debug(
        "[ConversationHistoryManager] Failed to get conversation history:",
        error
      );
      return [];
    }
  }

  /**
   * Restore a conversation from history
   * Requirement 4.3: Load and restore conversation history
   */
  restoreConversation(conversationId: string): boolean {
    try {
      const history = this.getConversationHistory();
      const conversation = history.find((c) => c.id === conversationId);

      if (conversation) {
        // Archive current conversation if it exists
        if (this.currentConversation) {
          this.archiveConversation(this.currentConversation);
        }

        // Restore the selected conversation
        this.currentConversation = conversation;
        this.saveCurrentConversation();

        logger.debug(
          `[ConversationHistoryManager] Restored conversation: ${conversationId}`
        );
        return true;
      }

      logger.debug(
        `[ConversationHistoryManager] Conversation not found: ${conversationId}`
      );
      return false;
    } catch (error) {
      logger.debug(
        "[ConversationHistoryManager] Failed to restore conversation:",
        error
      );
      return false;
    }
  }

  /**
   * Get current conversation ID
   */
  getCurrentConversationId(): string | null {
    return this.currentConversation?.id ?? null;
  }

  /**
   * Get message count in current conversation
   */
  getMessageCount(): number {
    return this.currentConversation?.messages.length ?? 0;
  }
}

