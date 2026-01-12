import React, { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  Loader2,
} from "lucide-react";
import type { TodoList, TodoStatus } from "code-sidecar-shared/types/todo";

interface TodoListPanelProps {
  todoList: TodoList | null;
}

function getStatusLabel(status: TodoStatus): string {
  switch (status) {
    case "done":
      return "Done";
    case "in_progress":
      return "In progress";
    case "pending":
    default:
      return "Pending";
  }
}

function getStatusColor(status: TodoStatus): string {
  switch (status) {
    case "done":
      return "var(--vscode-testing-iconPassed)";
    case "in_progress":
      return "var(--vscode-notificationsWarningIcon-foreground)";
    case "pending":
    default:
      return "var(--vscode-descriptionForeground)";
  }
}

function getStatusIcon(status: TodoStatus): React.ReactNode {
  switch (status) {
    case "done":
      return <CheckCircle2 size={14} strokeWidth={2.2} />;
    case "in_progress":
      return <Loader2 size={14} strokeWidth={2.2} />;
    case "pending":
    default:
      return <Circle size={14} strokeWidth={2} />;
  }
}

export function TodoListPanel({
  todoList,
}: TodoListPanelProps): React.ReactElement | null {
  if (!todoList || todoList.items.length === 0) {
    return null;
  }

  const [isCollapsed, setIsCollapsed] = useState(false);
  const total = todoList.items.length;
  const completed = todoList.items.filter((item) => item.status === "done").length;
  const progress = Math.round((completed / total) * 100);
  const allDone = total > 0 && completed === total;
  const lastAllDoneRef = useRef(allDone);

  function toggleCollapsed(): void {
    setIsCollapsed((prev) => !prev);
  }

  useEffect(() => {
    const wasAllDone = lastAllDoneRef.current;
    if (allDone && !wasAllDone) {
      setIsCollapsed(true);
    }
    if (!allDone && wasAllDone) {
      setIsCollapsed(false);
    }
    lastAllDoneRef.current = allDone;
  }, [allDone]);

  return (
    <div className="px-3 pt-3 pb-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">
          Task progress
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[11px] text-[var(--vscode-descriptionForeground)]">
            {completed}/{total} done
          </div>
          <button
            className="rounded-sm p-0.5 text-[var(--vscode-descriptionForeground)] transition-colors hover:text-[var(--vscode-foreground)]"
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? "Expand task progress" : "Collapse task progress"}
            title={isCollapsed ? "Expand task progress" : "Collapse task progress"}
          >
            {isCollapsed ? (
              <ChevronRight size={14} strokeWidth={2} />
            ) : (
              <ChevronDown size={14} strokeWidth={2} />
            )}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div className="mt-2 h-1 rounded-full bg-[var(--vscode-sideBarSectionHeader-background)]">
            <div
              className="h-1 rounded-full bg-[var(--vscode-progressBar-background)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-2 flex flex-col gap-1.5">
            {todoList.items.map((item) => {
              const statusColor = getStatusColor(item.status);
              const statusLabel = getStatusLabel(item.status);

              return (
                <div key={item.id} className="flex items-start gap-2 text-[12px]">
                  <span
                    className="mt-0.5"
                    style={{ color: statusColor }}
                    aria-hidden="true"
                  >
                    {getStatusIcon(item.status)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[var(--vscode-foreground)] truncate">
                      {item.title}
                    </div>
                    {item.description && (
                      <div className="text-[11px] text-[var(--vscode-descriptionForeground)]">
                        {item.description}
                      </div>
                    )}
                  </div>
                  <span
                    className="text-[10px] uppercase tracking-wide"
                    style={{ color: statusColor }}
                  >
                    {statusLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
