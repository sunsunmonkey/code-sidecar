/**
 * Message type definitions for configuration-related communication
 * These types define the messages exchanged between the webview and extension backend
 */

import type { UIConfiguration, ValidationErrors } from "./config";
/**
 * Message types for the webview UI
 * These match the types defined in AgentWebviewProvider.ts
 */

export type WorkMode = "architect" | "code" | "ask" | "debug";

export interface ToolUse {
  type: "tool_use";
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: Record<string, any>;
}

export interface ToolResult {
  type: "tool_result";
  tool_name: string;
  content: string;
  is_error: boolean;
}

export interface TokenUsageSnapshot {
  totalTokens: number;
  availableTokens: number;
}

/**
 * Operation types that can be recorded
 */
export type OperationType =
  | "file_write"
  | "file_edit"
  | "file_insert"
  | "file_delete"
  | "command_execute";

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
 * API Configuration subset for connection testing
 */
export interface ApiConfiguration {
  baseUrl: string;
  model: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
}

/**
 * Messages sent from webview to extension backend
 */
export type ConfigMessage =
  | { type: "get_configuration" }
  | { type: "save_configuration"; config: UIConfiguration }
  | { type: "test_connection"; apiConfig: ApiConfiguration };

/**
 * Responses sent from extension backend to webview
 */
export type ConfigResponse =
  | {
      type: "configuration_loaded";
      config: UIConfiguration;
    }
  | { type: "configuration_saved"; success: boolean; error?: string }
  | {
      type: "connection_test_result";
      success: boolean;
      error?: string;
      responseTime?: number;
    }
  | { type: "validation_error"; errors: ValidationErrors };

/**
 * Permission request data
 */
export interface PermissionRequest {
  id: string;
  toolName: string;
  operation: string;
  target: string;
  details: string;
}

/**
 * Conversation summary for list display
 */
export interface ConversationSummary {
  id: string;
  timestamp: Date | string;
  messageCount: number;
  preview: string;
  isCurrent: boolean;
}

/**
 * Messages sent from extension to webview
 */
export type WebviewMessage =
  | { type: "stream_chunk"; content: string; isStreaming: boolean }
  | { type: "tool_call"; toolCall: ToolUse }
  | { type: "tool_result"; content: ToolResult }
  | { type: "error"; message: string }
  | { type: "task_complete" }
  | { type: "mode_changed"; mode: WorkMode }
  | { type: "conversation_cleared" }
  | { type: "operation_recorded"; operation: OperationRecord }
  | { type: "operation_history"; operations: OperationRecord[] }
  | { type: "conversation_history"; messages: DisplayMessage[] }
  | { type: "conversation_list"; conversations: ConversationSummary[] }
  | { type: "conversation_deleted"; conversationId: string }
  | { type: "navigate"; route: string }
  | { type: "token_usage"; usage: TokenUsageSnapshot }
  | { type: "permission_request"; request: PermissionRequest }
  | { type: "set_input_value"; value: string };

/**
 * Messages sent from webview to extension
 */
export type UserMessage =
  | { type: "user_message"; content: string }
  | { type: "mode_change"; mode: WorkMode }
  | { type: "clear_conversation" }
  | { type: "new_conversation" }
  | { type: "get_operation_history" }
  | { type: "clear_operation_history" }
  | { type: "get_conversation_history" }
  | { type: "get_conversation_list" }
  | { type: "switch_conversation"; conversationId: string }
  | { type: "delete_conversation"; conversationId: string }
  | { type: "permission_response"; requestId: string; approved: boolean };

/**
 * Display message types for UI
 */
export type MessageRole = "user" | "assistant" | "system" | "permission";

export interface DisplayMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  toolCalls?: ToolUse[];
  toolResults?: ToolResult[];
  isStreaming?: boolean;
  isError?: boolean;
  permissionRequest?: PermissionRequest;
}
