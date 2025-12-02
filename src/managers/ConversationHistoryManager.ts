import * as vscode from "vscode";
import { HistoryItem } from "../core/apiHandler";

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
 * Requirements: 4.3, 4.4, 4.5
 */
export class ConversationHistoryManager {
  private static readonly HISTORY_KEY = "codingAgent.conversationHistory";
  private static readonly CURRENT_CONVERSATION_KEY = "codingAgent.currentConversation";
  
  private currentConversation: ConversationEntry | null = null;
  private config: HistoryConfig;

  constructor(
    private context: vscode.ExtensionContext,
    config?: Partial<HistoryConfig>
  ) {
    // Default configuration
    this.config = {
      maxTokens: config?.maxTokens ?? 100000,
      maxMessages: config?.maxMessages ?? 100,
      estimatedCharsPerToken: config?.estimatedCharsPerToken ?? 4,
    };
    
    // Load current conversation on initialization
    this.loadCurrentConversation();
  }

  /**
   * Start a new conversation
   * Requirement 4.5: Support clearing conversation
   */
  startNewConversation(): void {
    this.currentConversation = {
      id: this.generateConversationId(),
      timestamp: new Date(),
      messages: [],
    };
    
    this.saveCurrentConversation();
    console.log(`[ConversationHistoryManager] Started new conversation: ${this.currentConversation.id}`);
  }

  /**
   * Add a message to the current conversation
   * Requirement 4.3: Preserve conversation history as context
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
   * Requirement 4.3: Preserve conversation history as context
   */
  addMessages(messages: HistoryItem[]): void {
    if (!this.currentConversation) {
      this.startNewConversation();
    }

    this.currentConversation!.messages.push(...messages);
    this.saveCurrentConversation();
  }

  /**
   * Get current conversation messages
   * Requirement 4.3: Preserve conversation history as context
   */
  getMessages(): HistoryItem[] {
    if (!this.currentConversation) {
      this.startNewConversation();
    }
    
    return this.currentConversation!.messages;
  }

  /**
   * Get truncated messages based on token limit
   * Requirement 4.4: Intelligently truncate or summarize early conversation
   */
  getTruncatedMessages(): HistoryItem[] {
    const messages = this.getMessages();
    
    if (messages.length === 0) {
      return [];
    }

    // Calculate total estimated tokens
    const totalTokens = this.estimateTokens(messages);
    
    if (totalTokens <= this.config.maxTokens) {
      return messages;
    }

    console.log(`[ConversationHistoryManager] Truncating history: ${totalTokens} tokens > ${this.config.maxTokens} limit`);
    
    // Truncate from the beginning, keeping recent messages
    return this.truncateMessages(messages);
  }

  /**
   * Clear current conversation
   * Requirement 4.5: Support clearing conversation
   */
  clearConversation(): void {
    if (this.currentConversation && this.currentConversation.messages.length > 0) {
      // Archive current conversation before clearing only if it has messages
      this.archiveConversation(this.currentConversation);
    }
    
    this.startNewConversation();
    console.log('[ConversationHistoryManager] Conversation cleared');
  }

  /**
   * Delete a conversation from history
   */
  deleteConversation(conversationId: string): boolean {
    try {
      const history = this.context.workspaceState.get<ConversationEntry[]>(
        ConversationHistoryManager.HISTORY_KEY,
        []
      );
      
      const filteredHistory = history.filter(c => c.id !== conversationId);
      
      if (filteredHistory.length === history.length) {
        console.warn(`[ConversationHistoryManager] Conversation not found: ${conversationId}`);
        return false;
      }
      
      this.context.workspaceState.update(
        ConversationHistoryManager.HISTORY_KEY,
        filteredHistory
      );
      
      console.log(`[ConversationHistoryManager] Deleted conversation: ${conversationId}`);
      return true;
    } catch (error) {
      console.error('[ConversationHistoryManager] Failed to delete conversation:', error);
      return false;
    }
  }

  /**
   * Load current conversation from storage
   * Requirement 4.3: Load and restore conversation history
   */
  private loadCurrentConversation(): void {
    try {
      const stored = this.context.workspaceState.get<ConversationEntry>(
        ConversationHistoryManager.CURRENT_CONVERSATION_KEY
      );
      
      if (stored && stored.messages && stored.messages.length > 0) {
        // Archive the old conversation if it has messages
        this.archiveConversation({
          ...stored,
          timestamp: new Date(stored.timestamp),
        });
      }
      
      // Always start a new conversation on load
      this.startNewConversation();
      console.log('[ConversationHistoryManager] Started new conversation on initialization');
    } catch (error) {
      console.error('[ConversationHistoryManager] Failed to load conversation:', error);
      this.startNewConversation();
    }
  }

  /**
   * Save current conversation to storage
   * Requirement 4.3: Persist conversation history
   */
  private saveCurrentConversation(): void {
    if (!this.currentConversation) {
      return;
    }

    try {
      this.context.workspaceState.update(
        ConversationHistoryManager.CURRENT_CONVERSATION_KEY,
        this.currentConversation
      );
    } catch (error) {
      console.error('[ConversationHistoryManager] Failed to save conversation:', error);
    }
  }

  /**
   * Archive a conversation to history
   * Requirement 4.3: Persist conversation history
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
      const existingIndex = history.findIndex(c => c.id === conversation.id);
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
      
      console.log(`[ConversationHistoryManager] Archived conversation: ${conversation.id} with ${conversation.messages.length} messages`);
    } catch (error) {
      console.error('[ConversationHistoryManager] Failed to archive conversation:', error);
    }
  }

  /**
   * Estimate token count for messages
   * Requirement 4.4: Intelligently truncate based on token count
   */
  private estimateTokens(messages: HistoryItem[]): number {
    let totalChars = 0;
    
    for (const message of messages) {
      if (typeof message.content === 'string') {
        totalChars += message.content.length;
      } else if (Array.isArray(message.content)) {
        // Handle content arrays (e.g., with images)
        for (const part of message.content) {
          if (typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
            totalChars += part.text.length;
          }
        }
      }
    }
    
    // Estimate tokens (roughly 4 characters per token)
    return Math.ceil(totalChars / this.config.estimatedCharsPerToken);
  }

  /**
   * Truncate messages to fit within token limit
   * Requirement 4.4: Intelligently truncate or summarize early conversation
   */
  private truncateMessages(messages: HistoryItem[]): HistoryItem[] {
    const result: HistoryItem[] = [];
    let currentTokens = 0;
    
    // Start from the end (most recent messages)
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const messageTokens = this.estimateTokens([message]);
      
      if (currentTokens + messageTokens <= this.config.maxTokens) {
        result.unshift(message);
        currentTokens += messageTokens;
      } else {
        // Stop if we've exceeded the limit
        break;
      }
    }
    
    // If we truncated, add a system message to indicate this
    if (result.length < messages.length) {
      const truncatedCount = messages.length - result.length;
      result.unshift({
        role: 'system',
        content: `[Note: ${truncatedCount} earlier messages were truncated to fit within context limits]`,
      });
    }
    
    return result;
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
      return history.map(entry => ({
        ...entry,
        timestamp: new Date(entry.timestamp),
      }));
    } catch (error) {
      console.error('[ConversationHistoryManager] Failed to get conversation history:', error);
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
      const conversation = history.find(c => c.id === conversationId);
      
      if (conversation) {
        // Archive current conversation if it exists
        if (this.currentConversation) {
          this.archiveConversation(this.currentConversation);
        }
        
        // Restore the selected conversation
        this.currentConversation = conversation;
        this.saveCurrentConversation();
        
        console.log(`[ConversationHistoryManager] Restored conversation: ${conversationId}`);
        return true;
      }
      
      console.warn(`[ConversationHistoryManager] Conversation not found: ${conversationId}`);
      return false;
    } catch (error) {
      console.error('[ConversationHistoryManager] Failed to restore conversation:', error);
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

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HistoryConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
    console.log('[ConversationHistoryManager] Configuration updated:', this.config);
  }
}