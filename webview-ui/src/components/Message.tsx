import React from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  vscDarkPlus,
  vs,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  PenLine,
  Settings2,
  ShieldAlert,
  Sparkles,
  Trash2,
  User,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import type { DisplayMessage, TaskDiff } from "code-sidecar-shared/types/messages";
import { ToolCallDisplay } from "./ToolCallDisplay";
import { useTheme } from "../hooks/useTheme";
import { DiffPreviewCard } from "./DiffPreviewCard";

interface MessageProps {
  message: DisplayMessage;
  onPermissionResponse?: (requestId: string, approved: boolean) => void;
  suppressCursor?: boolean;
  onSelectDiffFile?: (diff: TaskDiff, filePath: string) => void;
}

const TOOL_TAG_NAMES = [
  "attempt_completion",
  "read_file",
  "write_file",
  "list_files",
  "apply_diff",
  "insert_content",
  "search_files",
  "execute_command",
  "get_diagnostics",
  "list_code_definition_names",
  "git_operations",
  "update_todo_list",
];

const stripTrailingPartialToolTag = (input: string): string => {
  const lastLtIndex = input.lastIndexOf("<");
  if (lastLtIndex === -1) {
    return input;
  }

  const tail = input.slice(lastLtIndex);
  if (tail.includes(">")) {
    return input;
  }

  const trimmedTail = tail.trimEnd();
  const isPartialToolTag = TOOL_TAG_NAMES.some((tagName) => {
    const openTag = `<${tagName}>`;
    const closeTag = `</${tagName}>`;
    return openTag.startsWith(trimmedTail) || closeTag.startsWith(trimmedTail);
  });

  if (!isPartialToolTag) {
    return input;
  }

  return input.slice(0, lastLtIndex).trimEnd();
};

const stripToolTags = (input: string): string => {
  let output = input;
  for (const tagName of TOOL_TAG_NAMES) {
    const openTag = `<${tagName}>`;
    const closeTag = `</${tagName}>`;
    while (true) {
      const startIndex = output.indexOf(openTag);
      if (startIndex === -1) {
        break;
      }
      const endIndex = output.indexOf(closeTag, startIndex + openTag.length);
      if (endIndex === -1) {
        output = output.slice(0, startIndex).trimEnd();
        break;
      }
      output = `${output.slice(0, startIndex)}${output.slice(
        endIndex + closeTag.length
      )}`.trim();
    }
  }
  return stripTrailingPartialToolTag(output).trim();
};

/**
 * Message component displays a single message with support for:
 * - Text content with Markdown rendering
 * - Code blocks with syntax highlighting (theme-aware)
 * - Tool calls and results
 * - Permission requests
 * Requirements: 3.5, 4.1, 4.2, 9.3, 14.1, 14.2, 14.4, 14.5
 */
export const Message: React.FC<MessageProps> = ({
  message,
  onPermissionResponse,
  suppressCursor,
  onSelectDiffFile,
}) => {
  const themeKind = useTheme();
  const [isPermissionExpanded, setIsPermissionExpanded] = React.useState(false);
  const [isReasoningExpanded, setIsReasoningExpanded] = React.useState(
    message.isStreaming ?? false
  );
  const {
    role,
    content,
    toolCalls,
    toolResults,
    isError,
    isStreaming,
    permissionRequest,
  } = message;
  const hasToolCalls = !!(toolCalls && toolCalls.length > 0);
  const hasToolResults = !!(toolResults && toolResults.length > 0);
  const isPermissionMessage = role === "permission" && !!permissionRequest;
  const isPermissionResponded = isPermissionMessage && content !== "";
  const completionToolCall = toolCalls?.find(
    (toolCall) => toolCall.name === "attempt_completion"
  );
  const completionContent =
    completionToolCall && typeof completionToolCall.params?.result === "string"
      ? completionToolCall.params.result
      : "";
  const cleanedContent = role === "assistant" ? stripToolTags(content) : content;
  const isReasoning =
    role === "assistant" &&
    cleanedContent &&
    !isError &&
    !completionToolCall;
  const baseMessageClasses =
    "mb-3 p-2 rounded-md bg-[var(--vscode-editor-background)] shadow-[0_3px_10px_rgba(0,0,0,0.12)] w-full";

  // Select syntax highlighter theme based on VSCode theme
  const syntaxTheme = themeKind === "light" ? vs : vscDarkPlus;

  React.useEffect(() => {
    if (isPermissionResponded) {
      setIsPermissionExpanded(false);
    }
  }, [isPermissionResponded]);

  React.useEffect(() => {
    if (!isReasoning) {
      return;
    }
    if (isStreaming) {
      setIsReasoningExpanded(true);
    } else {
      setIsReasoningExpanded(false);
    }
  }, [isReasoning, isStreaming]);

  // Handle permission request messages
  if (role === "permission" && permissionRequest) {
    const getOperationIcon = (operation: string) => {
      switch (operation.toLowerCase()) {
        case "read":
          return <BookOpen size={14} strokeWidth={2} />;
        case "write":
        case "modify":
          return <PenLine size={14} strokeWidth={2} />;
        case "delete":
          return <Trash2 size={14} strokeWidth={2} />;
        case "execute":
          return <Zap size={14} strokeWidth={2} />;
        default:
          return <Wrench size={14} strokeWidth={2} />;
      }
    };

    const getOperationColor = (operation: string) => {
      switch (operation.toLowerCase()) {
        case "delete":
        case "execute":
          return "var(--vscode-errorForeground)";
        case "write":
        case "modify":
          return "var(--vscode-notificationsWarningIcon-foreground)";
        default:
          return "var(--vscode-notificationsInfoIcon-foreground)";
      }
    };

    const isResponded = isPermissionResponded;
    const isApproved = content.toLowerCase().includes("approved");
    const showPermissionDetails =
      !isResponded || isPermissionExpanded || (isResponded && !isApproved);

    if (isResponded && isApproved) {
      return null;
    }

    return (
      <div className="mb-3 p-2 rounded-md bg-[var(--vscode-editor-background)] shadow-[0_3px_10px_rgba(0,0,0,0.12)] w-full">
        <div className="flex items-center justify-between gap-2 text-xs text-[var(--vscode-descriptionForeground)]">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="font-semibold text-[var(--vscode-foreground)] inline-flex items-center gap-1.5 shrink-0">
              <ShieldAlert size={14} strokeWidth={2} />
              <span>Permission</span>
            </span>
            <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-[var(--vscode-sideBarSectionHeader-background)] text-[var(--vscode-foreground)] shrink-0">
              {getOperationIcon(permissionRequest.operation)}
            </span>
            <span
              className="shrink-0"
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: getOperationColor(permissionRequest.operation),
              }}
            >
              {permissionRequest.operation.toUpperCase()}
            </span>
            {!showPermissionDetails && (
              <span
                className="min-w-0 flex-1 truncate"
                style={{
                  color: "var(--vscode-foreground)",
                  fontFamily: "var(--vscode-editor-font-family)",
                  fontSize: "12px",
                }}
                title={permissionRequest.target}
              >
                {permissionRequest.target}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
            {isResponded && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-semibold"
                style={{
                  color: isApproved
                    ? "var(--vscode-testing-iconPassed)"
                    : "var(--vscode-testing-iconFailed)",
                }}
              >
                {isApproved ? (
                  <Check
                    size={14}
                    strokeWidth={2.4}
                    className="text-[var(--vscode-testing-iconPassed,#73bf69)]"
                  />
                ) : (
                  <X
                    size={14}
                    strokeWidth={2.4}
                    className="text-[var(--vscode-testing-iconFailed)]"
                  />
                )}
                <span>{isApproved ? "Approved" : "Denied"}</span>
              </span>
            )}
            {isResponded && !isApproved && (
              <button
                onClick={() => setIsPermissionExpanded((prev) => !prev)}
                type="button"
                className="text-[11px] text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]"
              >
                {showPermissionDetails ? "Hide" : "Details"}
              </button>
            )}
            <span className="opacity-70">
              {message.timestamp.toLocaleTimeString()}
            </span>
          </div>
        </div>

        {showPermissionDetails && (
          <div
            className="bg-[var(--vscode-textCodeBlock-background)] rounded p-2 mt-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
            style={{ fontSize: "12px" }}
          >
            <div className="mb-1">
              <span
                style={{
                  fontSize: "10px",
                  color: "var(--vscode-descriptionForeground)",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                Tool
              </span>
              <div
                style={{
                  color: "var(--vscode-foreground)",
                  fontFamily: "var(--vscode-editor-font-family)",
                  marginTop: "2px",
                }}
              >
                {permissionRequest.toolName}
              </div>
            </div>

            <div className="mb-1">
              <span
                style={{
                  fontSize: "10px",
                  color: "var(--vscode-descriptionForeground)",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                Target
              </span>
              <div
                style={{
                  color: "var(--vscode-foreground)",
                  fontFamily: "var(--vscode-editor-font-family)",
                  wordBreak: "break-all",
                  marginTop: "2px",
                }}
              >
                {permissionRequest.target}
              </div>
            </div>

            {permissionRequest.details && (
              <div>
                <span
                  style={{
                    fontSize: "10px",
                    color: "var(--vscode-descriptionForeground)",
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  Details
                </span>
                <div
                  style={{
                    color: "var(--vscode-foreground)",
                    whiteSpace: "pre-wrap",
                    maxHeight: "180px",
                    overflowY: "auto",
                    marginTop: "2px",
                  }}
                >
                  {permissionRequest.details}
                </div>
              </div>
            )}
          </div>
        )}

        {!isResponded && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={() =>
                onPermissionResponse?.(permissionRequest.id, false)
              }
              style={{
                backgroundColor: "transparent",
                border: "none",
                color: "var(--vscode-button-foreground)",
                padding: "4px 10px",
                cursor: "pointer",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: 500,
              }}
            >
              <span className="inline-flex items-center gap-1">
                <X size={13} strokeWidth={2.4} />
                <span>Deny</span>
              </span>
            </button>
            <button
              onClick={() =>
                onPermissionResponse?.(permissionRequest.id, true)
              }
              style={{
                backgroundColor: "var(--vscode-button-background)",
                border: "none",
                color: "var(--vscode-button-foreground)",
                padding: "4px 10px",
                cursor: "pointer",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: 500,
              }}
            >
              <span className="inline-flex items-center gap-1">
                <Check size={13} strokeWidth={2.4} />
                <span>Allow</span>
              </span>
            </button>
          </div>
        )}
      </div>
    );
  }

  if (message.diffPreview) {
    const diffPreview = message.diffPreview;
    return (
      <div className={baseMessageClasses}>
        <DiffPreviewCard
          diff={diffPreview}
          onSelectFile={(filePath) =>
            onSelectDiffFile?.(diffPreview, filePath)
          }
        />
      </div>
    );
  }

  if (!cleanedContent && !hasToolCalls && !hasToolResults && !isError) {
    return null;
  }
  const roleMeta = {
    user: { label: "User", icon: <User size={14} strokeWidth={2.2} /> },
    assistant: {
      label: "Reasoning",
      icon: <Sparkles size={14} strokeWidth={2.2} />,
    },
    system: { label: "System", icon: <Settings2 size={14} strokeWidth={2.2} /> },
  };
  const header = roleMeta[role as keyof typeof roleMeta];

  // Don't show header for tool-only messages
  const showHeader = role === "user" || cleanedContent || isError;
  const messageClasses = `${baseMessageClasses} ${
    role === "user" ? "bg-[var(--vscode-input-background)]" : ""
  } ${
    isReasoning
      ? "bg-[var(--vscode-textBlockQuote-background)]"
      : ""
  } ${
    role === "system"
      ? "bg-[var(--vscode-textBlockQuote-background)]"
      : ""
  } ${
    isError ? "bg-[var(--vscode-inputValidation-errorBackground)]" : ""
  }`;
  const markdownClassName =
    "text-[13px] leading-relaxed [&_p]:m-0 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_code]:bg-[var(--vscode-textCodeBlock-background)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.9em] [&_pre]:my-2 [&_pre]:rounded [&_pre]:overflow-x-auto";
  const showStreamingCursor = !!isStreaming && !suppressCursor;
  const renderMarkdown = (markdown: string, showCursor: boolean) => (
    <div className={markdownClassName}>
      <ReactMarkdown
        components={{
          code(props) {
            const { children, className, ...rest } = props;
            const match = /language-(\w+)/.exec(className || "");
            const language = match ? match[1] : "";

            return language ? (
              <SyntaxHighlighter
                style={syntaxTheme}
                language={language}
                PreTag="div"
              >
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            ) : (
              <code className={className} {...rest}>
                {children}
              </code>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
      {showCursor && (
        <span className="inline-block animate-[blink_1s_infinite] text-[var(--vscode-editorCursor-foreground)] ml-0.5">
          |
        </span>
      )}
    </div>
  );

  if (completionToolCall && completionContent) {
    const showCompletionCursor = !!completionToolCall.partial;
    return (
      <div className={baseMessageClasses}>
        <div className="flex items-center gap-2 mb-1.5 text-[11px] text-[var(--vscode-descriptionForeground)]">
          <span className="font-semibold text-[var(--vscode-foreground)] inline-flex items-center gap-1.5">
            <Check size={14} strokeWidth={2.2} />
            <span>Result</span>
          </span>
          <span className="opacity-70 ml-auto">
            {message.timestamp.toLocaleTimeString()}
          </span>
        </div>
        <div className="text-[var(--vscode-foreground)]">
          {renderMarkdown(completionContent, showCompletionCursor)}
        </div>
      </div>
    );
  }

  // For tool call messages, combine tool call and result
  if (hasToolCalls && !content) {
    const toolCall = toolCalls[0];
    const toolResult = hasToolResults ? toolResults[0] : undefined;

    return (
      <div className="mb-2">
        <ToolCallDisplay toolCall={toolCall} result={toolResult} />
      </div>
    );
  }

  // For reasoning messages
  const displayContent = role === "assistant" ? cleanedContent : content;

  return (
    <div className={messageClasses}>
      {showHeader && (
        <div className="flex items-center gap-2 mb-1.5 text-[11px] text-[var(--vscode-descriptionForeground)]">
          {isReasoning ? (
            <button
              type="button"
              className="font-semibold text-[var(--vscode-foreground)] inline-flex items-center gap-1.5"
              onClick={() => setIsReasoningExpanded((prev) => !prev)}
            >
              {isReasoningExpanded ? (
                <ChevronDown size={14} strokeWidth={2} />
              ) : (
                <ChevronRight size={14} strokeWidth={2} />
              )}
              <span>Reasoning</span>
            </button>
          ) : (
            <span className="font-semibold text-[var(--vscode-foreground)] inline-flex items-center gap-1.5">
              {header?.icon}
              <span>{header?.label}</span>
            </span>
          )}
          <span className="opacity-70 ml-auto">
            {message.timestamp.toLocaleTimeString()}
          </span>
        </div>
      )}

      <div className="text-[var(--vscode-foreground)]">
        {displayContent &&
          (!isReasoning || isReasoningExpanded) &&
          renderMarkdown(displayContent, showStreamingCursor)}
        {isReasoning && !isReasoningExpanded && (
          <div className="text-[11px] text-[var(--vscode-descriptionForeground)]">
            Reasoning collapsed
          </div>
        )}
      </div>
    </div>
  );
};


