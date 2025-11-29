import * as vscode from 'vscode';

/**
 * Operation types that can be recorded
 * Requirements: 11.1
 */
export type OperationType = 
  | 'file_write'
  | 'file_edit'
  | 'file_insert'
  | 'file_delete'
  | 'command_execute';

/**
 * Operation record data model
 * Requirements: 11.1, 11.2
 */
export interface OperationRecord {
  /** Unique identifier for the operation */
  id: string;
  
  /** Type of operation performed */
  type: OperationType;
  
  /** Target file or resource */
  target: string;
  
  /** Timestamp when operation was performed */
  timestamp: Date;
  
  /** Tool name that performed the operation */
  toolName: string;
  
  /** Brief description of the operation */
  description: string;
  
  /** Additional details about the operation */
  details?: {
    linesAdded?: number;
    linesRemoved?: number;
    contentPreview?: string;
    command?: string;
  };
}

/**
 * OperationHistoryManager - manages recording and retrieval of file operations
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 * 
 * This manager records all file operations performed by the AI agent,
 * allowing users to review what changes were made. It provides a history
 * of operations that can be displayed in the UI.
 */
export class OperationHistoryManager {
  private operations: OperationRecord[] = [];
  private readonly MAX_HISTORY_SIZE = 100;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadHistory();
  }

  /**
   * Record a new operation
   * Requirements: 11.1, 11.2
   */
  recordOperation(operation: Omit<OperationRecord, 'id' | 'timestamp'>): OperationRecord {
    const record: OperationRecord = {
      ...operation,
      id: this.generateId(),
      timestamp: new Date(),
    };

    this.operations.push(record);

    // Limit history size
    if (this.operations.length > this.MAX_HISTORY_SIZE) {
      this.operations = this.operations.slice(-this.MAX_HISTORY_SIZE);
    }

    // Persist to storage
    this.saveHistory();

    console.log(`[OperationHistory] Recorded ${operation.type}: ${operation.target}`);

    return record;
  }

  /**
   * Get all operation records
   * Requirements: 11.2, 11.3
   */
  getAllOperations(): OperationRecord[] {
    return [...this.operations];
  }

  /**
   * Get recent operations (last N)
   * Requirements: 11.2, 11.3
   */
  getRecentOperations(count: number = 10): OperationRecord[] {
    return this.operations.slice(-count);
  }

  /**
   * Get operations for a specific file
   * Requirements: 11.3
   */
  getOperationsForFile(filePath: string): OperationRecord[] {
    return this.operations.filter(op => op.target === filePath);
  }

  /**
   * Clear all operation history
   * Requirements: 11.5
   */
  clearHistory(): void {
    this.operations = [];
    this.saveHistory();
    console.log('[OperationHistory] History cleared');
  }

  /**
   * Get operation by ID
   * Requirements: 11.3
   */
  getOperationById(id: string): OperationRecord | undefined {
    return this.operations.find(op => op.id === id);
  }

  /**
   * Generate unique ID for operation
   */
  private generateId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Save history to persistent storage
   */
  private saveHistory(): void {
    try {
      // Convert dates to ISO strings for serialization
      const serializable = this.operations.map(op => ({
        ...op,
        timestamp: op.timestamp.toISOString(),
      }));

      this.context.workspaceState.update('operationHistory', serializable);
    } catch (error) {
      console.error('[OperationHistory] Failed to save history:', error);
    }
  }

  /**
   * Load history from persistent storage
   */
  private loadHistory(): void {
    try {
      const stored = this.context.workspaceState.get<any[]>('operationHistory');
      
      if (stored && Array.isArray(stored)) {
        // Convert ISO strings back to Date objects
        this.operations = stored.map(op => ({
          ...op,
          timestamp: new Date(op.timestamp),
        }));
        
        console.log(`[OperationHistory] Loaded ${this.operations.length} operations from storage`);
      }
    } catch (error) {
      console.error('[OperationHistory] Failed to load history:', error);
      this.operations = [];
    }
  }

  /**
   * Get statistics about operations
   */
  getStatistics(): {
    totalOperations: number;
    operationsByType: Record<OperationType, number>;
    filesModified: number;
  } {
    const operationsByType: Record<string, number> = {};
    const uniqueFiles = new Set<string>();

    for (const op of this.operations) {
      operationsByType[op.type] = (operationsByType[op.type] || 0) + 1;
      uniqueFiles.add(op.target);
    }

    return {
      totalOperations: this.operations.length,
      operationsByType: operationsByType as Record<OperationType, number>,
      filesModified: uniqueFiles.size,
    };
  }
}
