import type { ApiConfiguration } from "./api";
import type { ConversationSummary, DisplayMessage } from "./conversation";
import type { AgentConfiguration, ValidationErrors } from "./config";
import type { WorkMode } from "./modes";
import type { OperationRecord } from "./operations";
import type { PermissionRequestWithId } from "./permissions";
import type { TaskDiff } from "./diff";
import type { ToolResult, ToolUse } from "./tools";
import type { MCPServerConfig, MCPServerState, MCPMarketItem } from "./mcp";

export type { ApiConfiguration } from "./api";
export type {
  ConversationSummary,
  DisplayMessage,
  MessageRole,
} from "./conversation";
export type { AgentConfiguration, ValidationErrors } from "./config";
export type { TaskDiff } from "./diff";
export type { WorkMode } from "./modes";
export type { OperationRecord, OperationType } from "./operations";
export type { PermissionRequest, PermissionRequestWithId } from "./permissions";
export type { ToolResult, ToolUse } from "./tools";
export type {
  MCPServerConfig,
  MCPServerState,
  MCPMarketItem,
  MCPToolDefinition,
  MCPConnectionStatus,
  MCPCategory,
  MCPConfiguration,
  MCPMessage,
  MCPResponse,
} from "./mcp";

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
  | { type: "task_diff"; diff: TaskDiff }
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
  | { type: "set_input_value"; value: string }
  | {
      type: "mcp_servers_list";
      servers: MCPServerConfig[];
      states: MCPServerState[];
    }
  | { type: "mcp_server_added"; server: MCPServerConfig }
  | { type: "mcp_server_updated"; server: MCPServerConfig }
  | { type: "mcp_server_removed"; serverId: string }
  | { type: "mcp_server_state_changed"; state: MCPServerState }
  | { type: "mcp_market_list"; items: MCPMarketItem[] }
  | { type: "mcp_error"; message: string };

export type UserMessage =
  | { type: "user_message"; content: string }
  | { type: "mode_change"; mode: WorkMode }
  | { type: "clear_conversation" }
  | { type: "clear_conversation_history" }
  | { type: "new_conversation" }
  | { type: "cancel_task" }
  | { type: "get_operation_history" }
  | { type: "clear_operation_history" }
  | { type: "get_conversation_history" }
  | { type: "get_conversation_list" }
  | { type: "switch_conversation"; conversationId: string }
  | { type: "delete_conversation"; conversationId: string }
  | { type: "open_diff_panel"; diff: TaskDiff; filePath?: string }
  | { type: "get_configuration" }
  | { type: "save_configuration"; config: AgentConfiguration }
  | { type: "test_connection"; apiConfig: ApiConfiguration }
  | { type: "permission_response"; requestId: string; approved: boolean }
  | { type: "mcp_get_servers" }
  | { type: "mcp_add_server"; server: Omit<MCPServerConfig, "id"> }
  | { type: "mcp_update_server"; server: MCPServerConfig }
  | { type: "mcp_remove_server"; serverId: string }
  | { type: "mcp_connect_server"; serverId: string }
  | { type: "mcp_disconnect_server"; serverId: string }
  | { type: "mcp_get_market" }
  | { type: "mcp_install_from_market"; itemId: string };
