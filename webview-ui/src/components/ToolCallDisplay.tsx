import React, { useState } from "react";
import {
  Activity,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  FileText,
  Folder,
  PenLine,
  PlusSquare,
  Search,
  Terminal,
  Wrench,
  X,
} from "lucide-react";
import type { ToolUse, ToolResult } from "../types/messages";

/**
 * ToolCallDisplay component shows a tool call with its parameters
 * Requirements: 14.1, 14.2, 14.4, 14.5
 */
interface ToolCallDisplayProps {
  toolCall: ToolUse;
  result?: ToolResult;
}

/**
 * Get icon for specific tool types
 */
const getToolIcon = (toolName: string): React.ReactNode => {
  const iconMap: Record<string, React.ReactNode> = {
    read_file: <BookOpen size={18} strokeWidth={1.9} />,
    write_file: <PenLine size={18} strokeWidth={1.9} />,
    list_directory: <Folder size={18} strokeWidth={1.9} />,
    search_files: <Search size={18} strokeWidth={1.9} />,
    execute_command: <Terminal size={18} strokeWidth={1.9} />,
    get_diagnostics: <Activity size={18} strokeWidth={1.9} />,
    apply_diff: <FileText size={18} strokeWidth={1.9} />,
    insert_content: <PlusSquare size={18} strokeWidth={1.9} />,
    list_code_definition_names: <Code2 size={18} strokeWidth={1.9} />,
    attempt_completion: <Check size={18} strokeWidth={2.2} />,
  };

  return iconMap[toolName] || <Wrench size={18} strokeWidth={1.9} />;
};

/**
 * Format parameter value for display
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const formatParamValue = (value: any): string => {
  if (typeof value === "string") {
    // Truncate long strings
    if (value.length > 100) {
      return value.substring(0, 100) + "...";
    }
    return value;
  }
  return JSON.stringify(value);
};

export const ToolCallDisplay: React.FC<ToolCallDisplayProps> = ({
  toolCall,
  result,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const icon = getToolIcon(toolCall.name);
  const isError = result?.is_error || false;
  const hasResult = !!result;

  return (
    <div className="rounded-md overflow-hidden bg-[var(--vscode-editor-background)] shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
      <div
        className={`flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer select-none ${
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
        <span className="text-lg leading-none flex-shrink-0" title="Tool">
          {icon}
        </span>
        <span className="flex-1 font-semibold text-[var(--vscode-foreground)] text-sm">
          {toolCall.name}
        </span>
        {hasResult && (
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
              isError
                ? "bg-[var(--vscode-inputValidation-errorBackground)] text-[var(--vscode-testing-iconFailed)]"
                : "bg-[var(--vscode-inputValidation-infoBackground)] text-[var(--vscode-testing-iconPassed)]"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              {isError ? (
                <X size={12} strokeWidth={2.4} />
              ) : (
                <Check size={12} strokeWidth={2.4} />
              )}
              <span>{isError ? "Error" : "Success"}</span>
            </span>
          </span>
        )}
        {isExpanded ? (
          <ChevronDown
            size={14}
            strokeWidth={2}
            className="text-[var(--vscode-descriptionForeground)] flex-shrink-0"
          />
        ) : (
          <ChevronRight
            size={14}
            strokeWidth={2}
            className="text-[var(--vscode-descriptionForeground)] flex-shrink-0"
          />
        )}
      </div>

      {isExpanded && (
        <div className="px-3.5 py-3.5 bg-[var(--vscode-editor-background)]">
          {/* Parameters */}
          <div className="mb-3">
            <div className="text-xs font-semibold text-[var(--vscode-descriptionForeground)] mb-2 uppercase tracking-wide">
              Parameters:
            </div>
            <div className="bg-[var(--vscode-textCodeBlock-background)] rounded p-2.5">
              {Object.keys(toolCall.params).length === 0 ? (
                <div className="text-[var(--vscode-descriptionForeground)] italic text-[13px]">
                  No parameters
                </div>
              ) : (
                <table className="w-full border-collapse text-[13px]">
                  <tbody>
                    {Object.entries(toolCall.params).map(([key, value]) => (
                      <tr
                        key={key}
                        className="last:border-b-0"
                      >
                        <td className="py-1.5 pr-2 font-semibold text-[var(--vscode-symbolIcon-variableForeground)] align-top w-[30%] min-w-[100px]">
                          {key}
                        </td>
                        <td className="py-1.5 pl-2 text-[var(--vscode-foreground)] break-words">
                          <code className="bg-transparent p-0 text-[var(--vscode-textPreformat-foreground)] whitespace-pre-wrap break-words">
                            {formatParamValue(value)}
                          </code>
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
              <div className="text-xs font-semibold text-[var(--vscode-descriptionForeground)] mb-2 uppercase tracking-wide">
                Result:
              </div>
              <div className="bg-[var(--vscode-textCodeBlock-background)] rounded p-2.5 max-h-[400px] overflow-y-auto">
                <pre className="m-0 text-[13px] whitespace-pre-wrap break-words text-[var(--vscode-foreground)] leading-normal">
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
