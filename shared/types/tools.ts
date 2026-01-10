export interface ToolUse {
  type: "tool_use";
  name: string;
  params: Record<string, unknown>;
  id?: string;
  partial?: boolean;
}

export interface ToolResult {
  type: "tool_result";
  tool_name: string;
  content: string;
  is_error: boolean;
  tool_call_id?: string;
}
