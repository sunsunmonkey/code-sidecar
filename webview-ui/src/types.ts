/**
 * Message types for the webview UI
 * These match the types defined in AgentWebviewProvider.ts
 */

export type WorkMode = 'architect' | 'code' | 'ask' | 'debug';

export interface ToolUse {
  type: 'tool_use';
  name: string;
  params: Record<string, any>;
}

export interface ToolResult {
  type: 'tool_result';
  tool_name: string;
  content: string;
  is_error: boolean;
}

/**
 * Operation types that can be recorded
 */
export type OperationType = 
  | 'file_write'
  | 'file_edit'
  | 'file_insert'
  | 'file_delete'
  | 'command_execute';

/**
 * Operation record data model
 */
export interface OperationRecord {
  id: string;
  type: OperationType;
  target: string;
  timestamp: string | Date;
  toolName: string;
  description: string;
  details?: {
    linesAdded?: number;
    linesRemoved?: number;
    contentPreview?: string;
    command?: string;
  };
}

/**
 * Messages sent from extension to webview
 */
export type WebviewMessage =
  | { type: 'stream_chunk'; content: string }
  | { type: 'tool_call'; toolCall: ToolUse }
  | { type: 'tool_result'; result: ToolResult }
  | { type: 'error'; message: string }
  | { type: 'task_complete' }
  | { type: 'mode_changed'; mode: WorkMode }
  | { type: 'conversation_cleared' }
  | { type: 'operation_recorded'; operation: OperationRecord }
  | { type: 'operation_history'; operations: OperationRecord[] }
  | { type: 'navigate'; route: string };

/**
 * Messages sent from webview to extension
 */
export type UserMessage = 
  | { type: 'user_message'; content: string }
  | { type: 'mode_change'; mode: WorkMode }
  | { type: 'clear_conversation' }
  | { type: 'get_operation_history' }
  | { type: 'clear_operation_history' };

/**
 * Display message types for UI
 */
export type MessageRole = 'user' | 'assistant' | 'system';

export interface DisplayMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  toolCalls?: ToolUse[];
  toolResults?: ToolResult[];
  isStreaming?: boolean;
  isError?: boolean;
}
