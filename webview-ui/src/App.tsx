import { useEffect, useState, useCallback } from "react";
import "./App.css";
import { MessageList } from "./components/MessageList";
import { InputBox } from "./components/InputBox";
import { ModeSelector } from "./components/ModeSelector";
import { OperationHistory } from "./components/OperationHistory";
import type {
  DisplayMessage,
  WebviewMessage,
  ToolUse,
  ToolResult,
  WorkMode,
} from "./types";
import { useNavigate } from "react-router-dom";
import { useVSCodeApi } from "./hooks";

/**
 * Main App component for the AI Coding Assistant webview
 * Requirements: 4.1, 4.2, 4.3, 9.3, 14.1, 14.2
 */
function App() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [currentAssistantMessage, setCurrentAssistantMessage] =
    useState<DisplayMessage | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentMode, setCurrentMode] = useState<WorkMode>("code");
  const { vscode } = useVSCodeApi();
  /**
   * Handle messages from the extension
   * Requirements: 4.1, 4.2, 14.1, 14.2, 4.5
   */
  const handleExtensionMessage = useCallback((event: MessageEvent) => {
    const message: WebviewMessage = event.data;

    switch (message.type) {
      case "stream_chunk":
        handleStreamChunk(message.content);
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
        // Requirement 7.6: Display current mode
        setCurrentMode(message.mode);
        console.log("Mode changed to:", message.mode);
        break;

      case "conversation_cleared":
        // Handle conversation cleared confirmation from extension
        // Requirement 4.5: Support clearing conversation
        handleConversationCleared();
        break;

      case "navigate":
        // Handle navigation request from extension
        window.location.hash = `#${message.route}`;
        break;
    }
  }, []);

  /**
   * Handle streaming text chunks from LLM
   * Requirement 4.1: Display streaming output in real-time
   */
  const handleStreamChunk = (content: string) => {
    setIsProcessing(true);

    setCurrentAssistantMessage((prev) => {
      if (prev) {
        // Append to existing message
        return {
          ...prev,
          content: prev.content + content,
          isStreaming: true,
        };
      } else {
        // Create new assistant message
        return {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: content,
          timestamp: new Date(),
          isStreaming: true,
        };
      }
    });
  };

  /**
   * Handle tool call from assistant
   * Requirements: 14.1, 14.2
   */
  const handleToolCall = (toolCall: ToolUse) => {
    setCurrentAssistantMessage((prev) => {
      if (prev) {
        // Add tool call to current message
        return {
          ...prev,
          toolCalls: [...(prev.toolCalls || []), toolCall],
          isStreaming: false,
        };
      }
      return prev;
    });
  };

  /**
   * Handle tool result
   * Requirements: 14.1, 14.3
   */
  const handleToolResult = (result: ToolResult) => {
    // Create a system message for the tool result
    const resultMessage: DisplayMessage = {
      id: `msg-${Date.now()}`,
      role: "system",
      content: "",
      timestamp: new Date(),
      toolResults: [result],
    };

    setMessages((prev) => [...prev, resultMessage]);
  };

  /**
   * Handle error messages
   * Requirement 12.1: Display friendly error messages
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
   * Requirement 6.6: End ReAct loop when task is complete
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
   * Requirement 4.1: Support user input
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
   * Clear conversation
   * Requirement 4.5: Support clearing conversation
   */
  const clearConversation = () => {
    // Send clear conversation message to extension
    vscode.postMessage({
      type: "clear_conversation",
    });
  };

  /**
   * Handle conversation cleared confirmation from extension
   * Requirement 4.5: Support clearing conversation
   */
  const handleConversationCleared = () => {
    setMessages([]);
    setCurrentAssistantMessage(null);
    setIsProcessing(false);
    console.log("Conversation cleared");
  };

  /**
   * Handle mode change
   * Requirements: 7.5, 7.6
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
   * Set up message listener
   */
  useEffect(() => {
    window.addEventListener("message", handleExtensionMessage);

    return () => {
      window.removeEventListener("message", handleExtensionMessage);
    };
  }, [handleExtensionMessage]);

  /**
   * Update messages when current assistant message changes
   * Requirement 4.2: Keep interface updated with streaming content
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

  /**
   * Navigate to config page
   */
  const navigate = useNavigate();

  const navigateToConfig = () => {
    console.log(111);
    navigate("/config");
  };

  return (
    <div className="app-container">
      <div className="app-header">
        <ModeSelector
          currentMode={currentMode}
          onModeChange={handleModeChange}
        />
        <button
          className="config-button"
          onClick={navigateToConfig}
          title="Open Configuration"
        >
          ⚙️
        </button>
      </div>
      <OperationHistory vscode={vscode} />
      <MessageList messages={messages} />
      <InputBox
        onSend={sendMessage}
        onClear={clearConversation}
        disabled={isProcessing}
      />
    </div>
  );
}

export default App;
