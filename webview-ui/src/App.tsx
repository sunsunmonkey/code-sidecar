import { useEffect, useState, useCallback } from "react";
import { MessageList } from "./components/MessageList";
import { InputBox } from "./components/InputBox";
import { ModeSelector } from "./components/ModeSelector";
import { ConversationList } from "./components/ConversationList";
import { ConfigPanel } from "./components/config/ConfigPanel";
import type {
  DisplayMessage,
  WebviewMessage,
  ToolUse,
  ToolResult,
  WorkMode,
} from "./types/messages";
import { vscode } from "./utils/vscode";
import { useEvent } from "react-use";

type Tab = "chat" | "config";

/**
 * Main App component for the AI Coding Assistant webview
 * Requirements: 4.1, 4.2, 4.3, 9.3, 14.1, 14.2
 */
function App() {
  const [tab, setTab] = useState<Tab>("chat");
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [currentAssistantMessage, setCurrentAssistantMessage] =
    useState<DisplayMessage | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentMode, setCurrentMode] = useState<WorkMode>("code");
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
        handleToolResult(message.result);
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

      case "conversation_switched":
        // Conversation switched successfully
        console.log("Switched to conversation:", message.conversationId);
        break;

      case "navigate":
        // Handle navigation request from extension
        window.location.hash = `#${message.route}`;
        break;

      case "permission_request":
        // Handle permission request from extension - add as message
        handlePermissionRequest(message.request);
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStreamChunk = (content: string, isStreaming: boolean) => {
    setIsProcessing(true);

    setCurrentAssistantMessage((prev) => {
      if (prev && prev.isStreaming) {
        // Append to existing message
        return {
          ...prev,
          content: prev.content + content,
          isStreaming,
        };
      } else {
        // Create new assistant message
        return {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: content,
          timestamp: new Date(),
          isStreaming,
        };
      }
    });
  };

  /**
   * Handle tool call from assistant
   */
  const handleToolCall = (toolCall: ToolUse) => {
    // Finalize current assistant message if it has content (reasoning)
    if (currentAssistantMessage && currentAssistantMessage.content) {
      setMessages((prev) => [
        ...prev,
        { ...currentAssistantMessage, isStreaming: false },
      ]);
      setCurrentAssistantMessage(null);
    }

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
    // Finalize current assistant message if exists
    if (currentAssistantMessage) {
      setMessages((prev) => [
        ...prev,
        { ...currentAssistantMessage, isStreaming: false },
      ]);
      setCurrentAssistantMessage(null);
    }

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
   * Handle conversation cleared confirmation from extension
   */
  const handleConversationCleared = () => {
    setMessages([]);
    setCurrentAssistantMessage(null);
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
    console.log(`Loaded ${convertedMessages.length} messages from history`);
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
  const handlePermissionRequest = (
    request: import("./types/messages").PermissionRequest
  ) => {
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
              content: approved ? "✅ Approved" : "❌ Denied",
            }
          : msg
      )
    );
  };

  /**
   * Set up message listener and load conversation history
   */
  useEvent("message", handleExtensionMessage);

  /**
   * Update messages when current assistant message changes
   */
  useEffect(() => {
    if (currentAssistantMessage) {
      setMessages((prev) => {
        // Check if this message is already in the list
        const existingIndex = prev.findIndex(
          (msg) => msg.id === currentAssistantMessage.id
        );

        if (existingIndex >= 0) {
          // Update existing message
          const newMessages = [...prev];
          newMessages[existingIndex] = currentAssistantMessage;
          return newMessages;
        } else {
          // Add new message
          return [...prev, currentAssistantMessage];
        }
      });
    }
  }, [currentAssistantMessage]);

  return (
    <>
      <div style={{ display: tab === "chat" ? "block" : "none" }}>
        <div className="flex flex-col h-screen w-full">
          <div className="flex items-center justify-between gap-2 p-3 bg-(--vscode-sideBar-background) border-b border-(--vscode-panel-border) shrink-0">
            <ModeSelector
              currentMode={currentMode}
              onModeChange={handleModeChange}
            />
            <button
              className="bg-transparent border border-(--vscode-button-border,transparent) text-(--vscode-button-foreground) px-2 py-1 cursor-pointer rounded-sm text-base transition-colors hover:bg-(--vscode-button-hoverBackground)"
              onClick={() => setTab("config")}
              title="Open Configuration"
            >
              ⚙️
            </button>
          </div>
          <ConversationList vscode={vscode} />
          <MessageList
            messages={messages}
            onPermissionResponse={handlePermissionResponse}
          />
          <InputBox
            onSend={sendMessage}
            onClear={clearConversation}
            disabled={isProcessing}
          />
        </div>
      </div>

      <div style={{ display: tab === "config" ? "block" : "none" }}>
        <div className="flex flex-col h-screen w-full">
          <div className="flex items-center gap-3 p-3 bg-(--vscode-sideBar-background) border-b border-(--vscode-panel-border) shrink-0">
            <button
              className="bg-transparent border border-(--vscode-button-border,transparent) text-(--vscode-button-foreground) px-3 py-1 cursor-pointer rounded-sm text-sm transition-colors hover:bg-(--vscode-button-hoverBackground)"
              onClick={() => setTab("chat")}
              title="Back to Chat"
            >
              ← Back
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
