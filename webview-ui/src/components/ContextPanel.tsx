import React from "react";
import type { TokenUsageSnapshot } from "coding-agent-shared/types/messages";

interface ContextPanelProps {
  usage: TokenUsageSnapshot | null;
}

export const ContextPanel: React.FC<ContextPanelProps> = ({ usage }) => {
  if (!usage) {
    return null;
  }

  const usedTokens = usage?.totalTokens ?? 0;
  const limitTokens = usage?.availableTokens ?? 0;
  const displayTotal = limitTokens > 0 ? limitTokens : usedTokens || 1;
  const progress = Math.min(usedTokens / displayTotal, 1);
  const size = 36;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  const formatTokensToK = (value: number) => {
    const scaled = value / 1000;
    if (value === 0) {
      return "0k";
    }
    if (scaled < 10) {
      return `${scaled.toFixed(1)}k`;
    }
    return `${scaled.toFixed(0)}k`;
  };

  const usageLabel =
    limitTokens > 0
      ? `${formatTokensToK(usedTokens)} / ${formatTokensToK(limitTokens)}`
      : `${formatTokensToK(usedTokens)}`;
  const tooltipLabel =
    limitTokens > 0
      ? `${usedTokens.toLocaleString()} / ${limitTokens.toLocaleString()} tokens`
      : `${usedTokens.toLocaleString()} tokens used`;

  return (
    <div className="relative group">
      <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-(--vscode-sideBar-background) text-(--vscode-foreground) cursor-default">
        <div className="relative" style={{ width: size, height: size }} aria-hidden>
          <svg
            className="transform -rotate-90"
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="var(--vscode-editorWidget-border)"
              strokeWidth={strokeWidth}
              fill="none"
              strokeOpacity="0.45"
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="var(--vscode-badge-background)"
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold">
            {Math.round(progress * 100)}%
          </span>
        </div>
        <span className="sr-only">{tooltipLabel}</span>
      </div>
      <div className="pointer-events-none absolute right-0 top-full z-10 hidden max-w-[200px] translate-y-2 rounded-md bg-(--vscode-editorWidget-background) px-3 py-2 text-(--vscode-foreground) shadow-[0_10px_30px_rgba(0,0,0,0.35)] ring-1 ring-(--vscode-panel-border) whitespace-nowrap group-hover:block">
        <div className="text-[11px] text-(--vscode-descriptionForeground)">
          Context Tokens
        </div>
        <div className="text-xs font-semibold">{usageLabel}</div>
        <div className="mt-1 text-[11px] text-(--vscode-descriptionForeground)">
          {tooltipLabel}
        </div>
      </div>
    </div>
  );
};
