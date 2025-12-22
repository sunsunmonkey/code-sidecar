import type { ApiConfiguration } from "./api";
import type { ConversationSummary, DisplayMessage } from "./conversation";
import type { AgentConfiguration, ValidationErrors } from "./config";
import type { WorkMode } from "./modes";
import type { OperationRecord } from "./operations";
import type { PermissionRequestWithId } from "./permissions";
import type { ToolResult, ToolUse } from "./tools";

export type { ApiConfiguration } from "./api";
export type { ConversationSummary, DisplayMessage, MessageRole } from "./conversation";
export type { AgentConfiguration, ValidationErrors } from "./config";
export type { WorkMode } from "./modes";
export type { OperationRecord, OperationType } from "./operations";
export type { PermissionRequest, PermissionRequestWithId } from "./permissions";
export type { ToolResult, ToolUse } from "./tools";

export interface TokenUsageSnapshot {
  totalTokens: number;
  availableTokens: number;
}

export type ConfigMessage =
  | { type: "get_configuration" }
  | { type: "save_configuration"; config: AgentConfiguration }
  | { type: "test_connection"; apiConfig: ApiConfiguration };

export type ConfigResponse =
  | {
      type: "configuration_loaded";
      config: AgentConfiguration;
    }
  | { type: "configuration_saved"; success: boolean; error?: string }
  | {
      type: "connection_test_result";
      success: boolean;
      error?: string;
      responseTime?: number;
    }
  | { type: "validation_error"; errors: ValidationErrors };

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
  | { type: "configuration_loaded"; config: AgentConfiguration }
  | { type: "configuration_saved"; success: boolean; error?: string }
  | {
      type: "connection_test_result";
      success: boolean;
      error?: string;
      responseTime?: number;
    }
  | { type: "configuration_exported"; data: string; filename: string }
  | { type: "configuration_imported"; success: boolean; error?: string }
  | { type: "validation_error"; errors: ValidationErrors }
  | { type: "token_usage"; usage: TokenUsageSnapshot }
  | { type: "permission_request"; request: PermissionRequestWithId }
  | { type: "set_input_value"; value: string };

export type UserMessage =
  | { type: "user_message"; content: string }
  | { type: "mode_change"; mode: WorkMode }
  | { type: "clear_conversation" }
  | { type: "new_conversation" }
  | { type: "cancel_task" }
  | { type: "get_operation_history" }
  | { type: "clear_operation_history" }
  | { type: "get_conversation_history" }
  | { type: "get_conversation_list" }
  | { type: "switch_conversation"; conversationId: string }
  | { type: "delete_conversation"; conversationId: string }
  | { type: "get_configuration" }
  | { type: "save_configuration"; config: AgentConfiguration }
  | { type: "test_connection"; apiConfig: ApiConfiguration }
  | { type: "permission_response"; requestId: string; approved: boolean };
