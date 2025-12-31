import { ConversationHistoryManager } from "../managers";
import { ToolExecutor } from "../tools";
import { logger } from "code-sidecar-shared/utils/logger";
import type { ToolResult, ToolUse } from "code-sidecar-shared/types/tools";

type ToolCallHandlerOptions = {
  taskId: string;
  toolExecutor: ToolExecutor;
  conversationHistoryManager: ConversationHistoryManager;
  publishToolCall: (toolCall: ToolUse) => void;
  isCancelled: () => boolean;
};

export const formatToolResult = (result: ToolResult): string => {
  if (result.is_error) {
    return `[TOOL ERROR: ${result.tool_name}]\n${result.content}`;
  }
  return `[TOOL RESULT: ${result.tool_name}]\n${result.content}`;
};

export const hasAttemptCompletion = (toolCalls: ToolUse[]): boolean =>
  toolCalls.some((toolCall) => toolCall.name === "attempt_completion");

export class ToolCallHandler {
  constructor(private options: ToolCallHandlerOptions) {}

  async executeToolCalls(toolCalls: ToolUse[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const toolCall of toolCalls) {
      if (this.options.isCancelled()) {
        break;
      }
      logger.debug(
        `[Task ${this.options.taskId}] Executing tool: ${toolCall.name}`
      );

      this.options.publishToolCall(toolCall);

      this.options.conversationHistoryManager.addMessage({
        role: "system",
        content: "",
        toolCalls: [toolCall],
      });

      const result = await this.options.toolExecutor.executeTool(toolCall);
      if (toolCall.id) {
        result.tool_call_id = toolCall.id;
      }

      results.push(result);
    }

    return results;
  }
}
