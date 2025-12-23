import React, { useEffect, useRef, useState } from "react";
import { History, MessageSquare, Plus, Trash2, X } from "lucide-react";
import type { ConversationSummary } from "code-sidecar-shared/types/messages";
import { logger } from "code-sidecar-shared/utils/logger";

interface ConversationListProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vscode: any;
  onConversationSwitch?: () => void;
  className?: string;
  variant?: "sidebar" | "toolbar";
}

/**
 * ConversationList component displays the list of conversation history
 */
export const ConversationList: React.FC<ConversationListProps> = ({
  vscode,
  onConversationSwitch,
  className,
  variant = "sidebar",
}) => {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const containerClassName = className ? `${className} ` : "";
  const isToolbarVariant = variant === "toolbar";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [panelTop, setPanelTop] = useState(64);

  useEffect(() => {
    // Listen for conversation list updates
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      logger.debug("ConversationList received message:", message.type);

      if (message.type === "conversation_list") {
        logger.debug(
          "Updating conversation list:",
          message.conversations.length
        );
        setConversations(message.conversations);
      } else if (message.type === "conversation_deleted") {
        logger.debug("Conversation deleted:", message.conversationId);
        // Remove deleted conversation from list
        setConversations((prev) =>
          prev.filter((c) => c.id !== message.conversationId)
        );
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    vscode.postMessage({ type: "get_conversation_list" });
  }, [vscode]);

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
    logger.debug("Delete conversation clicked:", conversationId);

    logger.debug("Sending delete_conversation message:", conversationId);
    vscode.postMessage({ type: "delete_conversation", conversationId });
  };

  const handleToggleList = () => {
    if (!isExpanded) {
      // Request conversation list when opening
      vscode.postMessage({ type: "get_conversation_list" });
      const rect = containerRef.current?.getBoundingClientRect();
      const offsetTop = (rect?.bottom ?? 56) + 8;
      setPanelTop(offsetTop);
    }
    setIsExpanded(!isExpanded);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!isExpanded || !containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isExpanded]);

  const formatDate = (timestamp: Date | string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "刚刚";
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 7) return `${diffDays} 天前`;
    return date.toLocaleDateString("zh-CN");
  };

  const listContent = (
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
                    className="bg-transparent text-[var(--vscode-foreground)] border-none cursor-pointer text-lg px-2 py-1 rounded hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
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
  );

  if (isToolbarVariant) {
    return (
      <div ref={containerRef} className={`${containerClassName}relative`}>
        <button
          type="button"
          className="h-9 w-9 inline-flex items-center justify-center rounded-md bg-transparent text-[var(--vscode-button-foreground)] transition-colors hover:bg-[var(--vscode-button-hoverBackground)]  cursor-pointer"
          onClick={handleToggleList}
          aria-label="查看历史会话"
          aria-expanded={isExpanded}
        >
          <History className="translate-y-[1px]" size={16} strokeWidth={2} />
        </button>

        {isExpanded && (
          <div
            className="fixed left-1/2 max-h-[60vh] -translate-x-1/2 rounded-md bg-[var(--vscode-sideBar-background)] shadow-[0_12px_32px_rgba(0,0,0,0.35)] flex flex-col overflow-hidden z-30"
            style={{
              top: panelTop,
              width: "calc(100vw - 32px)",
            }}
          >
            <div className="flex justify-between items-center px-3 py-2.5 bg-[var(--vscode-sideBarSectionHeader-background)]">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--vscode-foreground)]">
                <History
                  className="translate-y-[1px]"
                  size={19}
                  strokeWidth={2}
                />
                <span>会话历史</span>
              </span>
              <div className="flex gap-1.5">
                <button
                  className="bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] border-none px-2.5 py-1 rounded cursor-pointer text-xs transition-colors hover:bg-[var(--vscode-button-hoverBackground)]"
                  onClick={handleNewConversation}
                  title="新建会话"
                  type="button"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Plus size={14} strokeWidth={2.4} />
                    <span>新建</span>
                  </span>
                </button>
                <button
                  className="bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] border-none px-2 py-1 rounded cursor-pointer text-xs transition-colors hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
                  onClick={() => setIsExpanded(false)}
                  title="收起"
                  type="button"
                >
                  <X size={14} strokeWidth={2.2} />
                </button>
              </div>
            </div>
            {listContent}
          </div>
        )}
      </div>
    );
  }

  if (!isExpanded) {
    return (
      <div
        ref={containerRef}
        className={`${containerClassName}p-2 bg-[var(--vscode-sideBar-background)] rounded-sm`}
      >
        <button
          className="w-full bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] border-none px-3 py-2 rounded cursor-pointer text-sm transition-colors hover:bg-[var(--vscode-button-hoverBackground)]"
          onClick={handleToggleList}
          title="查看会话历史"
          type="button"
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
      ref={containerRef}
      className={`${containerClassName} bg-[var(--vscode-sideBar-background)] rounded-sm max-h-[36vh] flex flex-col border border-[var(--vscode-panel-border)]`}
    >
      <div className="flex justify-between items-center px-3 py-2.5 bg-[var(--vscode-sideBarSectionHeader-background)] border-b border-[var(--vscode-panel-border)]">
        <h3 className="m-0 text-sm font-semibold text-[var(--vscode-sideBarTitle-foreground)]">
          <span className="inline-flex items-center gap-2">
            <History className="translate-y-[1px]" size={16} strokeWidth={2} />
            <span>会话历史</span>
          </span>
        </h3>
        <div className="flex gap-2">
          <button
            className="bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] border-none px-2.5 py-1 rounded cursor-pointer text-xs transition-colors hover:bg-[var(--vscode-button-hoverBackground)]"
            onClick={handleNewConversation}
            title="新建会话"
            type="button"
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
            type="button"
          >
            <X size={14} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {listContent}
    </div>
  );
};

