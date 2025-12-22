import React, { useLayoutEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";
import { Message } from "./Message";
import type { DisplayMessage } from "coding-agent-shared/types/messages";
import { logger } from "coding-agent-shared/utils/logger";

const AUTO_SCROLL_THRESHOLD_PX = 32;
const SCROLL_UP_THRESHOLD_PX = 2;

interface MessageListProps {
  messages: DisplayMessage[];
  onPermissionResponse?: (requestId: string, approved: boolean) => void;
}

/**
 * MessageList component displays all messages and auto-scrolls to the latest
 * Requirements: 4.1, 4.2, 9.3
 */
export const MessageList: React.FC<MessageListProps> = ({
  messages,
  onPermissionResponse,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const autoScrollEnabledRef = useRef(true);
  const lastScrollTopRef = useRef(0);

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !autoScrollEnabledRef.current) {
      return;
    }

    container.scrollTop = container.scrollHeight;
    lastScrollTopRef.current = container.scrollTop;
  }, [messages]);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    const isScrollingUp =
      scrollTop < lastScrollTopRef.current - SCROLL_UP_THRESHOLD_PX;

    if (isScrollingUp) {
      autoScrollEnabledRef.current = false;
    } else if (distanceFromBottom <= AUTO_SCROLL_THRESHOLD_PX) {
      autoScrollEnabledRef.current = true;
    }

    lastScrollTopRef.current = scrollTop;
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center text-[var(--vscode-descriptionForeground)]">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] mb-3">
            <MessageSquare size={28} strokeWidth={1.75} />
          </div>
          <h3 className="m-0 mb-2 text-[var(--vscode-foreground)] text-lg font-semibold">
            No messages yet
          </h3>
          <p className="m-0 text-sm">
            Start a conversation by typing a message below
          </p>
        </div>
      </div>
    );
  }
  logger.debug(messages);
  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col"
    >
      {messages.map((message) => (
        <Message
          key={message.id}
          message={message}
          onPermissionResponse={onPermissionResponse}
        />
      ))}
    </div>
  );
};
