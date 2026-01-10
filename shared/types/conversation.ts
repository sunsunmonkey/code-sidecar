import type { PermissionRequestWithId } from "./permissions";
import type { TaskDiff } from "./diff";
import type { ToolResult, ToolUse } from "./tools";

export interface ConversationSummary {
  id: string;
  timestamp: Date | string;
  messageCount: number;
  preview: string;
  isCurrent: boolean;
}

export type MessageRole = "user" | "assistant" | "system" | "permission";
export type HistoryRole = "user" | "assistant" | "system" | "tool_result";

export interface MessageBase<TRole extends string, TContent> {
  role: TRole;
  content: TContent;
  toolCalls?: ToolUse[];
  toolResults?: ToolResult[];
}

export interface DisplayMessage
  extends MessageBase<MessageRole, string> {
  id: string;
  timestamp: Date;
  isStreaming?: boolean;
  isError?: boolean;
  permissionRequest?: PermissionRequestWithId;
  diffPreview?: TaskDiff;
}

export interface HistoryItem
  extends MessageBase<HistoryRole, string | ToolResult> {}
