import React, { useLayoutEffect, useRef } from "react";
import { Code2, FileSearch, GitBranch, Terminal } from "lucide-react";
import { Message } from "./Message";
import type { DisplayMessage, TaskDiff } from "code-sidecar-shared/types/messages";

const AUTO_SCROLL_THRESHOLD_PX = 32;
const SCROLL_UP_THRESHOLD_PX = 2;

interface MessageListProps {
  messages: DisplayMessage[];
  onPermissionResponse?: (requestId: string, approved: boolean) => void;
  onSelectDiffFile?: (diff: TaskDiff, filePath: string) => void;
}

const QUICK_ACTIONS = [
  { icon: Code2, label: "Review code", hint: "Analyze the current file" },
  { icon: FileSearch, label: "Find bugs", hint: "Check for common issues" },
  { icon: Terminal, label: "Run tests", hint: "Execute test suite" },
  { icon: GitBranch, label: "Git status", hint: "Check repository state" },
];

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  onPermissionResponse,
  onSelectDiffFile,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const autoScrollEnabledRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const hasStreamingToolCall = messages.some((message) =>
    message.toolCalls?.some((toolCall) => toolCall.partial)
  );

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
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <h3 className="m-0 mb-1.5 text-[var(--vscode-foreground)] text-base font-semibold">
              What can I help with?
            </h3>
            <p className="m-0 text-[12px] text-[var(--vscode-descriptionForeground)]">
              Describe a task, ask a question, or use <code className="bg-[var(--vscode-textCodeBlock-background)] px-1 py-0.5 rounded text-[11px]">@file</code> to reference files
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <div
                  key={action.label}
                  className="flex items-start gap-2.5 p-2.5 rounded-md bg-[var(--vscode-input-background)] opacity-60"
                >
                  <Icon size={14} strokeWidth={1.8} className="text-[var(--vscode-descriptionForeground)] mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium text-[var(--vscode-foreground)] leading-tight">{action.label}</div>
                    <div className="text-[10px] text-[var(--vscode-descriptionForeground)] leading-tight mt-0.5">{action.hint}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="m-0 mt-4 text-center text-[11px] text-[var(--vscode-descriptionForeground)] opacity-70">
            Use <code className="bg-[var(--vscode-textCodeBlock-background)] px-1 py-0.5 rounded text-[10px]">/init</code> to generate project guidance
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col"
    >
      {messages.map((message) => (
        <Message
          key={message.id}
          message={message}
          suppressCursor={hasStreamingToolCall}
          onPermissionResponse={onPermissionResponse}
          onSelectDiffFile={onSelectDiffFile}
        />
      ))}
    </div>
  );
};

