import { useState, useCallback } from "react";
import { MessageList } from "../components/MessageList";
import { InputBox } from "../components/InputBox";
import { ModeSelector } from "../components/ModeSelector";
import { ConversationList } from "../components/ConversationList";
import { Settings2, Motorbike } from "lucide-react";
import type {
  DisplayMessage,
  WebviewMessage,
  ToolUse,
  ToolResult,
  WorkMode,
  TokenUsageSnapshot,
  PermissionRequestWithId,
  TaskDiff,
} from "code-sidecar-shared/types/messages";
import { vscode } from "../utils/vscode";
import { logger } from "code-sidecar-shared/utils/logger";
import { useEvent } from "react-use";
import { ContextPanel } from "../components/ContextPanel";

interface ChatPageProps {
  isActive: boolean;
  onOpenConfig: () => void;
}

export const ChatPage = ({ isActive, onOpenConfig }: ChatPageProps) => {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentMode, setCurrentMode] = useState<WorkMode>("code");
  const [inputValue, setInputValue] = useState<string>("");
  const [tokenUsage, setTokenUsage] = useState<TokenUsageSnapshot | null>(null);

  /**
   * Handle messages from the extension
   */
  const handleExtensionMessage = useCallback((event: MessageEvent) => {
    const message: WebviewMessage = event.data;
    switch (message.type) {
      case "stream_chunk":
        handleStreamChunk(message.content, message.isStreaming);
        break;

      case "tool_call":
        handleToolCall(message.toolCall);
        break;

      case "tool_result":
        handleToolResult(message.content);
        break;

      case "error":
        handleError(message.message);
        break;

      case "task_complete":
        handleTaskComplete();
        break;

      case "task_diff":
        handleTaskDiff(message.diff);
        break;

      case "mode_changed":
        // Update current mode when extension confirms the change
        setCurrentMode(message.mode);
        logger.debug("Mode changed to:", message.mode);
        break;

      case "conversation_cleared":
        // Handle conversation cleared confirmation from extension
        handleConversationCleared();
        break;

      case "conversation_history":
        // Handle conversation history loaded from extension
        handleConversationHistoryLoaded(message.messages);
        break;

      case "navigate":
        // Handle navigation request from extension
        window.location.hash = `#${message.route}`;
        break;

      case "permission_request":
        // Handle permission request from extension - add as message
        handlePermissionRequest(message.request);
        break;

      case "set_input_value":
        // Handle setting input text from extension
        setInputValue((prev) => prev + message.value);
        break;

      case "token_usage":
        setTokenUsage(message.usage);
        break;
    }
  }, []);

  const handleStreamChunk = (content: string, isStreaming: boolean) => {
    setIsProcessing(isStreaming);

    setMessages((prev) => {
      let lastStreamingIndex = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        const message = prev[i];
        if (message.role === "assistant" && message.isStreaming) {
          lastStreamingIndex = i;
          break;
        }
      }

      if (lastStreamingIndex >= 0) {
        const lastMessage = prev[lastStreamingIndex];
        let nextContent = lastMessage.content;
        if (content) {
          if (
            content.startsWith(lastMessage.content) ||
            lastMessage.content.startsWith(content)
          ) {
            nextContent = content;
          } else {
            nextContent = lastMessage.content + content;
          }
        }
        const updatedMessage = {
          ...lastMessage,
          content: nextContent,
          isStreaming,
        };
        return prev.map((msg, index) =>
          index === lastStreamingIndex ? updatedMessage : msg
        );
      }

      if (!content) {
        return prev;
      }

      return [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: content,
          timestamp: new Date(),
          isStreaming,
        },
      ];
    });
  };

  /**
   * Handle tool call from assistant
   */
  const handleToolCall = (toolCall: ToolUse) => {
    // Add or update tool call to messages, will be updated with result later
    setMessages((prev) => {
      const toolCallId = toolCall.id;
      let existingIndex = -1;

      if (toolCallId) {
        existingIndex = prev.findIndex(
          (msg) =>
            msg.toolCalls && msg.toolCalls.some((tc) => tc.id === toolCallId)
        );
      } else {
        for (let i = prev.length - 1; i >= 0; i--) {
          const msg = prev[i];
          if (
            msg.toolCalls &&
            msg.toolCalls.some((tc) => tc.name === toolCall.name) &&
            !msg.toolResults
          ) {
            existingIndex = i;
            break;
          }
        }
      }

      if (existingIndex >= 0) {
        const updatedMessages = [...prev];
        const existingMessage = updatedMessages[existingIndex];
        updatedMessages[existingIndex] = {
          ...existingMessage,
          toolCalls: [toolCall],
        };
        return updatedMessages;
      }

      const toolCallMessage: DisplayMessage = {
        id: toolCallId || `tool-${Date.now()}`,
        role: "system",
        content: "",
        timestamp: new Date(),
        toolCalls: [toolCall],
      };

      return [...prev, toolCallMessage];
    });
  };

  /**
   * Handle tool result
   */
  const handleToolResult = (result: ToolResult) => {
    // Find the last tool call message and add the result to it
    setMessages((prev) => {
      let lastToolCallIndex = -1;

      if (result.tool_call_id) {
        lastToolCallIndex = prev.findIndex(
          (msg) =>
            msg.toolCalls &&
            msg.toolCalls.some((tc) => tc.id === result.tool_call_id)
        );
      }

      if (lastToolCallIndex < 0) {
        lastToolCallIndex = prev.findIndex(
          (msg) =>
            msg.toolCalls &&
            msg.toolCalls.some((tc) => tc.name === result.tool_name) &&
            !msg.toolResults
        );
      }

      if (lastToolCallIndex >= 0) {
        const newMessages = [...prev];
        newMessages[lastToolCallIndex] = {
          ...newMessages[lastToolCallIndex],
          toolResults: [result],
        };
        return newMessages;
      }

      // Fallback: create new message if no matching tool call found
      return [
        ...prev,
        {
          id: `result-${Date.now()}`,
          role: "system",
          content: "",
          timestamp: new Date(),
          toolResults: [result],
        },
      ];
    });
  };

  /**
   * Handle error messages
   */
  const handleError = (errorMessage: string) => {
    const errorMsg: DisplayMessage = {
      id: `msg-${Date.now()}`,
      role: "system",
      content: errorMessage,
      timestamp: new Date(),
      isError: true,
    };

    setMessages((prev) => [...prev, errorMsg]);
    setIsProcessing(false);
  };

  /**
   * Handle task completion
   */
  const handleTaskComplete = () => {
    setIsProcessing(false);
  };

  const handleTaskDiff = (diff: TaskDiff) => {
    const diffMessage: DisplayMessage = {
      id: `diff-${diff.taskId}-${Date.now()}`,
      role: "system",
      content: "",
      timestamp: new Date(),
      diffPreview: diff,
    };

    setMessages((prev) => [...prev, diffMessage]);
  };

  /**
   * Send user message to extension
   */
  const sendMessage = (content: string) => {
    if (!content.trim()) return;

    // Add user message to display
    const userMessage: DisplayMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsProcessing(true);

    // Send to extension
    vscode.postMessage({
      type: "user_message",
      content: content,
    });
  };

  /**
   * Clear conversation (same as new conversation)
   */
  const clearConversation = () => {
    // Send new conversation message to extension
    vscode.postMessage({
      type: "new_conversation",
    });
  };

  /**
   * Cancel the current task
   */
  const cancelTask = () => {
    vscode.postMessage({ type: "cancel_task" });
    setIsProcessing(false);
  };

  /**
   * Handle conversation cleared confirmation from extension
   */
  const handleConversationCleared = () => {
    setMessages([]);
    setIsProcessing(false);
    logger.debug("Conversation cleared");
  };

  /**
   * Handle conversation history loaded from extension
   */
  const handleConversationHistoryLoaded = (
    historyMessages: DisplayMessage[]
  ) => {
    // Convert timestamp strings to Date objects
    const convertedMessages = historyMessages.map((msg) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }));

    setMessages(convertedMessages);
    setIsProcessing(false);
  };

  /**
   * Handle mode change
   */
  const handleModeChange = (mode: WorkMode) => {
    // Send mode change message to extension
    vscode.postMessage({
      type: "mode_change",
      mode: mode,
    });

    // Optimistically update UI
    setCurrentMode(mode);
  };

  /**
   * Handle permission request - add as message
   */
  const handlePermissionRequest = (request: PermissionRequestWithId) => {
    const permissionMessage: DisplayMessage = {
      id: request.id,
      role: "permission",
      content: "",
      timestamp: new Date(),
      permissionRequest: request,
    };

    setMessages((prev) => [...prev, permissionMessage]);
  };

  /**
   * Handle permission response
   */
  const handlePermissionResponse = (requestId: string, approved: boolean) => {
    vscode.postMessage({
      type: "permission_response",
      requestId: requestId,
      approved: approved,
    });

    // Update the message to show it's been responded to
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === requestId
          ? {
              ...msg,
              content: approved ? "Approved" : "Denied",
            }
          : msg
      )
    );
  };

  const handleDiffFileSelect = useCallback(
    (diff: TaskDiff, filePath: string) => {
      vscode.postMessage({
        type: "open_diff_panel",
        diff,
        filePath,
      });
    },
    []
  );

  /**
   * Set up message listener and load conversation history
   */
  useEvent("message", handleExtensionMessage);

  return (
    <div style={{ display: isActive ? "block" : "none" }}>
      <div className="flex flex-col h-screen w-full bg-[var(--vscode-sideBar-background)]">
        <header className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[var(--vscode-sideBarSectionHeader-background)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-md bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
              <Motorbike size={18} strokeWidth={2} />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-[var(--vscode-foreground)] uppercase tracking-wide">
                CodeSidecar
              </span>
              <span className="text-[12px] text-[var(--vscode-descriptionForeground)]">
                Chat
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ContextPanel usage={tokenUsage} />
            <ConversationList
              vscode={vscode}
              variant="toolbar"
              onConversationSwitch={() => {
                setIsProcessing(false);
                setTokenUsage(null);
              }}
            />
            <button
              className="bg-transparent text-[var(--vscode-button-foreground)] px-2.5 py-1.5 cursor-pointer rounded-sm text-sm transition-colors hover:bg-[var(--vscode-button-hoverBackground)]"
              onClick={onOpenConfig}
              title="Open Configuration"
              aria-label="Open configuration"
            >
              <Settings2 size={16} strokeWidth={2} />
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col gap-2 p-2 md:p-3 overflow-hidden min-h-0">
          <div className="flex-1 overflow-hidden rounded-lg bg-[var(--vscode-editor-background)] shadow-[0_8px_22px_rgba(0,0,0,0.18)] flex flex-col min-h-0">
            <MessageList
              messages={messages}
              onPermissionResponse={handlePermissionResponse}
              onSelectDiffFile={handleDiffFileSelect}
            />
          </div>

          <div className="rounded-lg bg-[var(--vscode-editor-background)] p-2 md:p-3 shadow-[0_6px_16px_rgba(0,0,0,0.16)]">
            <InputBox
              onSend={sendMessage}
              onCancel={cancelTask}
              onClear={clearConversation}
              isProcessing={isProcessing}
              inputValue={inputValue}
              setInputValue={setInputValue}
              className="flex-1 min-w-[260px]"
              modeSelector={
                <ModeSelector
                  currentMode={currentMode}
                  onModeChange={handleModeChange}
                />
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};
