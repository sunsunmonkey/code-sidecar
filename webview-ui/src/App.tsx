import { useState, useCallback } from "react";
import { MessageList } from "./components/MessageList";
import { InputBox } from "./components/InputBox";
import { ModeSelector } from "./components/ModeSelector";
import { ConversationList } from "./components/ConversationList";
import { ConfigPanel } from "./components/config/ConfigPanel";
import { Settings2, Sparkles } from "lucide-react";
import type {
  DisplayMessage,
  WebviewMessage,
  ToolUse,
  ToolResult,
  WorkMode,
  TokenUsageSnapshot,
  PermissionRequestWithId,
} from "coding-agent-shared/types/messages";
import { vscode } from "./utils/vscode";
import { useEvent } from "react-use";
import { ContextPanel } from "./components/ContextPanel";

type Tab = "chat" | "config";

/**
 * Main App component for the AI Coding Assistant webview
 */
function App() {
  const [tab, setTab] = useState<Tab>("chat");
  const [messages, setMessage] = useState<DisplayMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentMode, setCurrentMode] = useState<WorkMode>("code");
  const [inputValue, setInputValue] = useState<string>("");
  const [tokenUsage, setTokenUsage] = useState<TokenUsageSnapshot | null>(null);

  const setMessages = (msg: React.SetStateAction<DisplayMessage[]>) => {
    setMessage(msg);
  };
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

      case "mode_changed":
        // Update current mode when extension confirms the change
        setCurrentMode(message.mode);
        console.log("Mode changed to:", message.mode);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStreamChunk = (content: string, isStreaming: boolean) => {
    setIsProcessing(isStreaming);

    setMessages((prev) => {
      let lastMessage = prev[prev.length - 1];
      if (lastMessage && lastMessage.isStreaming) {
        // remove last
        prev.pop();
        // Append to existing message
        lastMessage = {
          ...lastMessage,
          content: lastMessage.content + content,
          isStreaming,
        };
      } else {
        // Create new assistant message
        lastMessage = {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: content,
          timestamp: new Date(),
          isStreaming,
        };
      }

      return [...prev, lastMessage];
    });
  };

  /**
   * Handle tool call from assistant
   */
  const handleToolCall = (toolCall: ToolUse) => {
    // Add tool call to messages, will be updated with result later
    const toolCallMessage: DisplayMessage = {
      id: `tool-${Date.now()}`,
      role: "system",
      content: "",
      timestamp: new Date(),
      toolCalls: [toolCall],
    };

    setMessages((prev) => [...prev, toolCallMessage]);
  };

  /**
   * Handle tool result
   */
  const handleToolResult = (result: ToolResult) => {
    // Find the last tool call message and add the result to it
    setMessages((prev) => {
      const lastToolCallIndex = prev.findIndex(
        (msg) =>
          msg.toolCalls &&
          msg.toolCalls.some((tc) => tc.name === result.tool_name) &&
          !msg.toolResults
      );

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
    console.log("Conversation cleared");
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

  /**
   * Set up message listener and load conversation history
   */
  useEvent("message", handleExtensionMessage);

  return (
    <>
      <div style={{ display: tab === "chat" ? "block" : "none" }}>
        <div className="flex flex-col h-screen w-full bg-[var(--vscode-sideBar-background)]">
          <header className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[var(--vscode-sideBarSectionHeader-background)] shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
                <Sparkles size={18} strokeWidth={2} />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-semibold text-[var(--vscode-foreground)] uppercase tracking-wide">
                  Coding Agent
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
                onClick={() => setTab("config")}
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

      <div style={{ display: tab === "config" ? "block" : "none" }}>
        <div className="flex flex-col h-screen w-full">
          <div className="flex items-center gap-3 p-5 bg-[var(--vscode-sideBar-background)] shrink-0">
            <button
              type="button"
              className="m-0 inline-flex items-center rounded-md bg-transparent px-2 py-1 text-base font-semibold text-[var(--vscode-button-foreground)] transition-colors cursor-pointer border-none hover:bg-[var(--vscode-button-hoverBackground)]"
              onClick={() => setTab("chat")}
            >
              {"< Back"}
            </button>
            <h2 className="m-0 text-base font-semibold">Configuration</h2>
          </div>
          <ConfigPanel />
        </div>
      </div>
    </>
  );
}

export default App;
