import React, { useEffect, useState } from "react";
import { History, MessageSquare, Plus, Trash2, X } from "lucide-react";
import type { ConversationSummary } from "../types/messages";

interface ConversationListProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vscode: any;
  onConversationSwitch?: () => void;
  className?: string;
}

/**
 * ConversationList component displays the list of conversation history
 */
export const ConversationList: React.FC<ConversationListProps> = ({
  vscode,
  onConversationSwitch,
  className,
}) => {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const containerClassName = className ? `${className} ` : "";

  useEffect(() => {
    // Listen for conversation list updates
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      console.log("ConversationList received message:", message.type);

      if (message.type === "conversation_list") {
        console.log(
          "Updating conversation list:",
          message.conversations.length
        );
        setConversations(message.conversations);
      } else if (message.type === "conversation_deleted") {
        console.log("Conversation deleted:", message.conversationId);
        // Remove deleted conversation from list
        setConversations((prev) =>
          prev.filter((c) => c.id !== message.conversationId)
        );
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleNewConversation = () => {
    vscode.postMessage({ type: "new_conversation" });
    setIsExpanded(false);
    onConversationSwitch?.();
  };

  const handleSwitchConversation = (conversationId: string) => {
    vscode.postMessage({ type: "switch_conversation", conversationId });
    setIsExpanded(false);
    onConversationSwitch?.();
  };

  const handleDeleteConversation = (conversationId: string) => {
    console.log("Delete conversation clicked:", conversationId);

    console.log("Sending delete_conversation message:", conversationId);
    vscode.postMessage({ type: "delete_conversation", conversationId });
  };

  const handleToggleList = () => {
    if (!isExpanded) {
      // Request conversation list when opening
      vscode.postMessage({ type: "get_conversation_list" });
    }
    setIsExpanded(!isExpanded);
  };

  useEffect(() => {
    vscode.postMessage({ type: "get_conversation_list" });
  }, [vscode]);

  const formatDate = (timestamp: Date | string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "刚刚";
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString("zh-CN");
  };

  if (!isExpanded) {
    return (
      <div
        className={`${containerClassName}p-2 bg-[var(--vscode-sideBar-background)] rounded-sm`}
      >
        <button
          className="w-full bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] border-none px-3 py-2 rounded cursor-pointer text-sm transition-colors hover:bg-[var(--vscode-button-hoverBackground)]"
          onClick={handleToggleList}
          title="查看会话历史"
        >
          <span className="inline-flex items-center justify-center gap-2">
            <MessageSquare size={16} strokeWidth={2} />
            <span>会话历史 ({conversations.length})</span>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`${containerClassName} bg-[var(--vscode-sideBar-background)] rounded-sm max-h-[36vh] flex flex-col`}
    >
      <div className="flex justify-between items-center px-3 py-2.5 bg-[var(--vscode-sideBarSectionHeader-background)]">
        <h3 className="m-0 text-sm font-semibold text-[var(--vscode-sideBarTitle-foreground)]">
          <span className="inline-flex items-center gap-2">
            <History size={16} strokeWidth={2} />
            <span>会话历史</span>
          </span>
        </h3>
        <div className="flex gap-2">
          <button
            className="bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] border-none px-2.5 py-1 rounded cursor-pointer text-xs transition-colors hover:bg-[var(--vscode-button-hoverBackground)]"
            onClick={handleNewConversation}
            title="新建会话"
          >
            <span className="inline-flex items-center gap-1.5">
              <Plus size={14} strokeWidth={2.4} />
              <span>新建</span>
            </span>
          </button>
          <button
            className="bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] border-none px-2.5 py-1 rounded cursor-pointer text-xs transition-colors hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
            onClick={() => setIsExpanded(false)}
            title="收起"
          >
            <X size={14} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto flex-1">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-[var(--vscode-descriptionForeground)] text-sm">
            暂无历史会话
          </div>
        ) : (
          <div className="p-2">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`mb-2 rounded transition-colors ${
                  conv.isCurrent
                    ? "bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]"
                    : "bg-[var(--vscode-list-inactiveSelectionBackground)] hover:bg-[var(--vscode-list-hoverBackground)]"
                }`}
              >
                <div className="flex">
                  <div
                    className="flex-1 p-3 cursor-pointer"
                    onClick={() => handleSwitchConversation(conv.id)}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs text-[var(--vscode-descriptionForeground)]">
                        {formatDate(conv.timestamp)}
                      </span>
                    </div>
                    <div className="text-sm mb-1 line-clamp-2">
                      {conv.preview}
                    </div>
                    <div className="text-xs text-[var(--vscode-descriptionForeground)]">
                      {conv.messageCount} 条消息
                    </div>
                  </div>
                  <div className="flex items-center pr-2">
                    <button
                      className="bg-transparent text-[var(--vscode-errorForeground)] border-none cursor-pointer text-lg px-2 py-1 rounded hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
                      onClick={() => {
                        handleDeleteConversation(conv.id);
                      }}
                      title="删除会话"
                      type="button"
                    >
                      <Trash2 size={16} strokeWidth={2.2} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
