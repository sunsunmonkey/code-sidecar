import React, { useState } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  PenLine,
  Terminal,
  Wrench,
  X,
} from "lucide-react";
import type { ToolUse, ToolResult } from "code-sidecar-shared/types/tools";

interface ToolCallDisplayProps {
  toolCall: ToolUse;
  result?: ToolResult;
}

const getToolIcon = (toolName: string): React.ReactNode => {
  const iconMap: Record<string, React.ReactNode> = {
    read_file: <BookOpen size={14} strokeWidth={1.9} />,
    write_file: <PenLine size={14} strokeWidth={1.9} />,
    edit: <FileText size={14} strokeWidth={1.9} />,
    execute_command: <Terminal size={14} strokeWidth={1.9} />,
    attempt_completion: <Check size={14} strokeWidth={2.2} />,
  };

  return iconMap[toolName] || <Wrench size={14} strokeWidth={1.9} />;
};

/**
 * Format parameter value for display
 */
const formatParamValue = (value: unknown, maxLength?: number): string => {
  let output = "";
  if (typeof value === "string") {
    output = value;
  } else {
    const jsonValue = JSON.stringify(
      value,
      null,
      maxLength === undefined ? 2 : 0
    );
    output = jsonValue ?? String(value);
  }

  if (maxLength !== undefined && output.length > maxLength) {
    return output.slice(0, maxLength) + "...";
  }

  return output;
};

const formatParamSummary = (params: Record<string, unknown>): string => {
  const entries = Object.entries(params);
  if (entries.length === 0) {
    return "No parameters";
  }

  const preview = entries.slice(0, 2).map(([key, value]) => {
    return `${key}: ${formatParamValue(value, 80)}`;
  });
  const suffix = entries.length > 2 ? " ..." : "";

  return `${preview.join(" · ")}${suffix}`;
};

const AUTO_SCROLL_THRESHOLD_PX = 32;
const SCROLL_UP_THRESHOLD_PX = 2;

interface ToolParamValueProps {
  value: string;
  isStreaming: boolean;
  autoScroll: boolean;
  showCursor: boolean;
}

const ToolParamValue: React.FC<ToolParamValueProps> = ({
  value,
  isStreaming,
  autoScroll,
  showCursor,
}) => {
  const scrollRef = React.useRef<HTMLPreElement | null>(null);
  const autoScrollEnabledRef = React.useRef(true);
  const lastScrollTopRef = React.useRef(0);

  React.useEffect(() => {
    if (autoScroll && isStreaming) {
      autoScrollEnabledRef.current = true;
    }
  }, [autoScroll, isStreaming]);

  React.useLayoutEffect(() => {
    if (!autoScroll || !isStreaming || !autoScrollEnabledRef.current) {
      return;
    }
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
    lastScrollTopRef.current = container.scrollTop;
  }, [value, isStreaming, autoScroll]);

  const handleScroll = () => {
    if (!autoScroll) {
      return;
    }
    const container = scrollRef.current;
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

  return (
    <pre
      ref={scrollRef}
      onScroll={handleScroll}
      className="m-0 w-full text-[11px] text-[var(--vscode-textPreformat-foreground)] whitespace-pre max-h-[220px] max-w-full overflow-x-auto overflow-y-auto"
    >
      {value}
      {showCursor && (
        <span className="inline-block animate-[blink_1s_infinite] text-[var(--vscode-editorCursor-foreground)] ml-0.5">
          |
        </span>
      )}
    </pre>
  );
};

export const ToolCallDisplay: React.FC<ToolCallDisplayProps> = ({
  toolCall,
  result,
}) => {
  const [isExpanded, setIsExpanded] = useState(!!toolCall.partial);
  const icon = getToolIcon(toolCall.name);
  const isError = result?.is_error || false;
  const hasResult = !!result;
  const isStreaming = !!toolCall.partial;
  const paramEntries = Object.entries(toolCall.params);
  const streamingParamKey =
    isStreaming && paramEntries.length > 0
      ? paramEntries[paramEntries.length - 1][0]
      : undefined;

  React.useEffect(() => {
    if (hasResult || !isStreaming) {
      setIsExpanded(false);
    }
  }, [hasResult, isStreaming]);

  return (
    <div className="rounded-md overflow-hidden bg-[var(--vscode-editor-background)] shadow-[0_3px_10px_rgba(0,0,0,0.1)]">
      <div
        className={`flex items-center gap-2 px-2.5 py-1.5 cursor-pointer select-none ${
          hasResult
            ? isError
              ? "bg-[var(--vscode-inputValidation-errorBackground)]"
              : "bg-[var(--vscode-inputValidation-infoBackground)]"
            : "bg-[var(--vscode-editor-background)]"
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
      >
        <span className="leading-none flex-shrink-0" title="Tool">
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[12px] text-[var(--vscode-foreground)] flex items-center gap-1">
            <span>{toolCall.name}</span>
            {isStreaming && (
              <span className="text-[10px] uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">
                Streaming
              </span>
            )}
          </div>
          <div className="text-[11px] text-[var(--vscode-descriptionForeground)] truncate">
            {formatParamSummary(toolCall.params)}
          </div>
        </div>
        {hasResult && (
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              isError
                ? "bg-[var(--vscode-inputValidation-errorBackground)] text-[var(--vscode-testing-iconFailed)]"
                : "bg-[var(--vscode-inputValidation-infoBackground)] text-[var(--vscode-testing-iconPassed)]"
            }`}
          >
            <span className="inline-flex items-center gap-1">
              {isError ? (
                <X size={11} strokeWidth={2.2} />
              ) : (
                <Check size={11} strokeWidth={2.2} />
              )}
              <span>{isError ? "Error" : "Success"}</span>
            </span>
          </span>
        )}
        {isExpanded ? (
          <ChevronDown
            size={12}
            strokeWidth={2}
            className="text-[var(--vscode-descriptionForeground)] flex-shrink-0"
          />
        ) : (
          <ChevronRight
            size={12}
            strokeWidth={2}
            className="text-[var(--vscode-descriptionForeground)] flex-shrink-0"
          />
        )}
      </div>

      {isExpanded && (
        <div className="px-2.5 py-2 bg-[var(--vscode-editor-background)]">
          {/* Parameters */}
          <div className="mb-2.5">
            <div className="text-[11px] font-semibold text-[var(--vscode-descriptionForeground)] mb-1 uppercase tracking-wide">
              Parameters:
            </div>
            <div className="bg-[var(--vscode-textCodeBlock-background)] rounded p-2">
              {Object.keys(toolCall.params).length === 0 ? (
                <div className="text-[var(--vscode-descriptionForeground)] italic text-[12px]">
                  No parameters
                </div>
              ) : (
                <table className="w-full table-fixed border-collapse text-[12px]">
                  <tbody>
                    {paramEntries.map(([key, value]) => (
                      <tr key={key} className="last:border-b-0">
                        <td className="py-1 pr-2 font-semibold text-[var(--vscode-symbolIcon-variableForeground)] align-top w-[30%] min-w-[90px]">
                          {key}
                        </td>
                        <td className="py-1 pl-2 text-[var(--vscode-foreground)] align-top min-w-0">
                          <ToolParamValue
                            value={formatParamValue(value)}
                            isStreaming={isStreaming && key === streamingParamKey}
                            autoScroll={isStreaming && key === streamingParamKey}
                            showCursor={isStreaming && key === streamingParamKey}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Result (if available) */}
          {result && (
            <div>
                <div className="text-[11px] font-semibold text-[var(--vscode-descriptionForeground)] mb-1 uppercase tracking-wide">
                  Result:
                </div>
              <div className="bg-[var(--vscode-textCodeBlock-background)] rounded p-2 max-h-[260px] overflow-y-auto">
                <pre className="m-0 text-[12px] whitespace-pre text-[var(--vscode-foreground)] leading-normal max-w-full overflow-x-auto">
                  {result.content}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
