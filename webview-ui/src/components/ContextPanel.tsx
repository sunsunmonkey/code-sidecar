import React from "react";
import type { ContextSnapshot, ContextItemView } from "../types/messages";

interface ContextPanelProps {
  snapshot: ContextSnapshot | null;
}

const formatStatus = (item: ContextItemView): string | undefined => {
  if (item.status === "included" && !item.note) {
    return undefined;
  }
  const statusParts = [];
  if (item.status !== "included") {
    statusParts.push(item.status);
  }
  if (item.note) {
    statusParts.push(item.note);
  }
  return statusParts.join(" - ");
};

export const ContextPanel: React.FC<ContextPanelProps> = ({ snapshot }) => {
  const [isCollapsed, setIsCollapsed] = React.useState(true);
  const hasSnapshot = Boolean(snapshot);

  const used = snapshot?.totalTokens ?? 0;
  const budget = Math.max(snapshot?.inputBudget ?? 0, 1);
  const percent = Math.min(100, Math.round((used / budget) * 100));
  const reservedOut = snapshot?.reservedOutputTokens ?? 0;
  const sortedItems = (snapshot?.items ?? [])
    .slice()
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 8);

  const barColor =
    percent >= 90
      ? "var(--vscode-errorForeground)"
      : percent >= 75
      ? "var(--vscode-editorWarning-foreground)"
      : "var(--vscode-editorInfo-foreground)";

  return (
    <div className="bg-(--vscode-sideBar-background) rounded-md p-2.5 shadow-sm text-xs space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            className="bg-transparent text-(--vscode-button-foreground) px-2 py-1 cursor-pointer rounded-sm text-[11px] leading-tight transition-colors hover:bg-(--vscode-button-hoverBackground)"
            onClick={() => setIsCollapsed((prev) => !prev)}
            type="button"
            title={isCollapsed ? "展开上下文" : "折叠上下文"}
          >
            {isCollapsed ? "▼" : "▲"}
          </button>
          <div className="flex flex-col leading-tight">
            <span className="text-(--vscode-foreground) font-semibold text-sm">
              上下文
            </span>
            {hasSnapshot && (
              <span className="text-(--vscode-descriptionForeground) text-[11px]">
                {sortedItems.length} 项 · {percent}%
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end leading-tight text-[11px] text-(--vscode-descriptionForeground)">
          {hasSnapshot ? (
            <>
              <span className="text-(--vscode-foreground) whitespace-nowrap text-sm font-semibold">
                {used} / {budget}
              </span>
              <span className="whitespace-nowrap">预留: {reservedOut}</span>
            </>
          ) : (
            <span>暂无上下文</span>
          )}
        </div>
      </div>

      {!isCollapsed && hasSnapshot && (
        <div className="space-y-3 pt-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[12px] text-(--vscode-descriptionForeground)">
              <span>Token 用量</span>
              <span className="text-(--vscode-foreground)">{percent}%</span>
            </div>
            <div
              className="h-2 rounded-sm overflow-hidden"
              style={{
                background:
                  "var(--vscode-input-border, rgba(255,255,255,0.08))",
              }}
            >
              <div
                className="h-full transition-[width]"
                style={{
                  width: `${percent}%`,
                  background: barColor,
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] text-(--vscode-descriptionForeground)">
              <span>System: {snapshot?.systemPromptTokens ?? 0}</span>
              <span className="text-right">
                User: {snapshot?.userMessageTokens ?? 0}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[12px] text-(--vscode-descriptionForeground)">
              <span className="font-semibold text-(--vscode-foreground)">
                当前上下文
              </span>
              <span>最近 8 条</span>
            </div>
            <div className="text-xs text-(--vscode-descriptionForeground) space-y-2 max-h-56 overflow-y-auto pr-1">
              {sortedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-2 rounded-sm p-2 bg-(--vscode-sideBarSectionHeader-background)"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span
                      className="text-(--vscode-foreground) text-sm truncate"
                      title={item.title}
                    >
                      {item.title}
                    </span>
                    <span className="text-(--vscode-descriptionForeground) text-[11px] truncate">
                      {item.kind}
                      {formatStatus(item) ? ` · ${formatStatus(item)}` : ""}
                    </span>
                  </div>
                  <span className="whitespace-nowrap text-(--vscode-foreground) text-[11px]">
                    {item.tokens} tks
                  </span>
                </div>
              ))}
              {sortedItems.length === 0 && (
                <div className="text-(--vscode-descriptionForeground)">
                  No context items selected.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!isCollapsed && !hasSnapshot && (
        <div className="text-(--vscode-descriptionForeground)">
          No context available yet.
        </div>
      )}
    </div>
  );
};
