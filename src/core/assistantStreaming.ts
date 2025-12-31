import {
  AssistantMessageContent,
  AssistantMessageParser,
  TextContent,
} from "./assistantMessage";
import type { ChatStreamEvent, TokenUsage } from "./apiHandler";
import type { ToolExecutor } from "../tools";
import type { ToolUse } from "code-sidecar-shared/types/tools";

export type StreamAssistantCallbacks = {
  onStreamChunk: (content: string, isStreaming: boolean) => void;
  onToolCall: (toolCall: ToolUse) => void;
};

export type StreamAssistantOptions = {
  stream: AsyncIterable<ChatStreamEvent>;
  parser: AssistantMessageParser;
  isCancelled: () => boolean;
  taskId: string;
  loopCount: number;
  callbacks: StreamAssistantCallbacks;
};

export type StreamAssistantResult = {
  assistantMessage: string;
  contentBlocks: AssistantMessageContent[];
  finalDisplayText: string;
  usage?: TokenUsage;
};

const getAllToolParameterNames = (
  toolExecutor: ToolExecutor,
  toolNames: string[]
): string[] => {
  const paramNames = new Set<string>();

  for (const toolName of toolNames) {
    const tool = toolExecutor.getTool(toolName);
    if (tool?.parameters) {
      for (const param of tool.parameters) {
        paramNames.add(param.name);
      }
    }
  }

  return Array.from(paramNames);
};

export const createAssistantMessageParser = (
  toolExecutor: ToolExecutor
): AssistantMessageParser => {
  const toolNames = toolExecutor.getToolNames();
  const paramNames = getAllToolParameterNames(toolExecutor, toolNames);
  return new AssistantMessageParser(toolNames, paramNames);
};

export const buildAssistantContent = (
  parsedBlocks: AssistantMessageContent[],
  assistantMessage: string
): AssistantMessageContent[] => {
  if (parsedBlocks.length > 0) {
    return parsedBlocks;
  }

  return [
    {
      type: "text",
      content: assistantMessage.trim(),
      partial: false,
    },
  ];
};

export const getAssistantDisplayText = (
  contentBlocks: AssistantMessageContent[]
): string => {
  const textBlocks = contentBlocks.filter(
    (block): block is TextContent => block.type === "text"
  );

  if (textBlocks.length === 0) {
    return "";
  }

  return textBlocks
    .map((block) => block.content)
    .filter((content) => content.trim().length > 0)
    .join("\n\n")
    .trim();
};

export async function streamAssistantResponse(
  options: StreamAssistantOptions
): Promise<StreamAssistantResult> {
  const { stream, parser, isCancelled, taskId, loopCount, callbacks } = options;
  let assistantMessage = "";
  let lastPublishedText = "";
  let usage: TokenUsage | undefined;
  let toolCallSequence = 0;

  type ToolCallSnapshot = {
    name: string;
    partial: boolean;
    paramKeys: string[];
    paramSizes: Record<string, number>;
  };

  const toolCallSnapshots = new Map<string, ToolCallSnapshot>();

  const getParamSize = (value: unknown): number => {
    if (typeof value === "string") {
      return value.length;
    }
    if (value === null || value === undefined) {
      return 0;
    }
    return JSON.stringify(value)?.length ?? 0;
  };

  const buildToolCallSnapshot = (toolCall: ToolUse): ToolCallSnapshot => {
    const paramEntries = Object.entries(toolCall.params);
    const paramSizes: Record<string, number> = {};
    for (const [key, value] of paramEntries) {
      paramSizes[key] = getParamSize(value);
    }

    return {
      name: toolCall.name,
      partial: !!toolCall.partial,
      paramKeys: paramEntries.map(([key]) => key),
      paramSizes,
    };
  };

  const hasToolCallChanged = (
    previous: ToolCallSnapshot | undefined,
    next: ToolCallSnapshot
  ): boolean => {
    if (!previous) {
      return true;
    }
    if (previous.name !== next.name || previous.partial !== next.partial) {
      return true;
    }
    if (previous.paramKeys.length !== next.paramKeys.length) {
      return true;
    }
    for (const key of next.paramKeys) {
      if (previous.paramSizes[key] !== next.paramSizes[key]) {
        return true;
      }
    }
    return false;
  };

  const getToolCallId = (toolCall: ToolUse): string => {
    if (!toolCall.id) {
      toolCall.id = `tool-${taskId}-${loopCount}-${toolCallSequence++}`;
    }
    return toolCall.id;
  };

  const publishToolCallUpdates = (
    contentBlocks: AssistantMessageContent[]
  ): void => {
    const toolCalls = contentBlocks.filter(
      (block): block is ToolUse => block.type === "tool_use"
    );

    if (toolCalls.length === 0) {
      return;
    }

    for (const toolCall of toolCalls) {
      const toolCallId = getToolCallId(toolCall);
      const snapshot = buildToolCallSnapshot(toolCall);
      const previousSnapshot = toolCallSnapshots.get(toolCallId);

      if (!hasToolCallChanged(previousSnapshot, snapshot)) {
        continue;
      }

      toolCallSnapshots.set(toolCallId, snapshot);
      callbacks.onToolCall(toolCall);
    }
  };

  for await (const chunk of stream) {
    if (isCancelled()) {
      break;
    }
    if (chunk.type === "content") {
      assistantMessage += chunk.content;
      const contentBlocks = parser.processChunk(chunk.content);
      publishToolCallUpdates(contentBlocks);
      const displayText = getAssistantDisplayText(contentBlocks);
      if (displayText !== lastPublishedText) {
        lastPublishedText = displayText;
        callbacks.onStreamChunk(displayText, true);
      }
    } else if (chunk.type === "usage") {
      usage = chunk.usage;
    }
  }

  parser.finalizeContentBlocks();

  const finalizedBlocks = parser.getContentBlocks();
  const finalizedText = getAssistantDisplayText(finalizedBlocks);
  const finalDisplayText = finalizedText || lastPublishedText;

  callbacks.onStreamChunk(finalDisplayText, false);

  return {
    assistantMessage,
    contentBlocks: finalizedBlocks,
    finalDisplayText,
    usage,
  };
}
