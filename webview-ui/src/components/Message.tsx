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
import type { DisplayMessage } from "../types/messages";
import { ToolCallDisplay } from "./ToolCallDisplay";
import { useTheme } from "../hooks/useTheme";

interface MessageProps {
  message: DisplayMessage;
  onPermissionResponse?: (requestId: string, approved: boolean) => void;
}

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
}) => {
  const themeKind = useTheme();
  const {
    role,
    content,
    toolCalls,
    toolResults,
    isError,
    isStreaming,
    permissionRequest,
  } = message;

  // Select syntax highlighter theme based on VSCode theme
  const syntaxTheme = themeKind === "light" ? vs : vscDarkPlus;

  // Handle permission request messages
  if (role === "permission" && permissionRequest) {
    const getOperationIcon = (operation: string) => {
      switch (operation.toLowerCase()) {
        case "read":
          return <BookOpen size={18} strokeWidth={1.9} />;
        case "write":
        case "modify":
          return <PenLine size={18} strokeWidth={1.9} />;
        case "delete":
          return <Trash2 size={18} strokeWidth={1.9} />;
        case "execute":
          return <Zap size={18} strokeWidth={1.9} />;
        default:
          return <Wrench size={18} strokeWidth={1.9} />;
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

    const isResponded = content !== "";
    const isApproved = content.toLowerCase().includes("approved");

    return (
      <div className="mb-4 p-3 rounded-lg bg-[var(--vscode-editor-background)] shadow-[0_4px_12px_rgba(0,0,0,0.12)] w-full">
        <div className="flex items-center gap-2 mb-2 text-xs text-[var(--vscode-descriptionForeground)]">
          <span className="font-semibold text-[var(--vscode-foreground)] inline-flex items-center gap-1.5">
            <ShieldAlert size={15} strokeWidth={2} />
            <span>Permission Required</span>
          </span>
          <span className="opacity-70 ml-auto">
            {message.timestamp.toLocaleTimeString()}
          </span>
        </div>

        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-[var(--vscode-sideBarSectionHeader-background)] text-[var(--vscode-foreground)]">
              {getOperationIcon(permissionRequest.operation)}
            </span>
            <span
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: getOperationColor(permissionRequest.operation),
              }}
            >
              {permissionRequest.operation.toUpperCase()}
            </span>
            <span
              style={{
                fontSize: "13px",
                color: "var(--vscode-descriptionForeground)",
              }}
            >
              via {permissionRequest.toolName}
            </span>
          </div>

          <div
            className="bg-[var(--vscode-textCodeBlock-background)] rounded p-2 mb-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
            style={{ fontSize: "13px" }}
          >
            <div className="mb-1">
              <span
                style={{
                  fontSize: "11px",
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
                    fontSize: "11px",
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
                    marginTop: "2px",
                  }}
                >
                  {permissionRequest.details}
                </div>
              </div>
            )}
          </div>
        </div>

        {isResponded ? (
          <div className="flex items-center gap-2 font-semibold text-sm">
            {isApproved ? (
              <Check
                size={16}
                strokeWidth={2.4}
                className="text-[var(--vscode-testing-iconPassed,#73bf69)]"
              />
            ) : (
              <X
                size={16}
                strokeWidth={2.4}
                className="text-[var(--vscode-testing-iconFailed)]"
              />
            )}
            <span
              style={{
                color: isApproved
                  ? "var(--vscode-testing-iconPassed)"
                  : "var(--vscode-testing-iconFailed)",
              }}
            >
              {isApproved ? "Approved" : "Denied"}
            </span>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() =>
                onPermissionResponse?.(permissionRequest.id, false)
              }
              style={{
                backgroundColor: "transparent",
                border: "none",
                color: "var(--vscode-button-foreground)",
                padding: "6px 14px",
                cursor: "pointer",
                borderRadius: "4px",
                fontSize: "13px",
                fontWeight: 500,
              }}
            >
              <span className="inline-flex items-center gap-1">
                <X size={14} strokeWidth={2.4} />
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
                padding: "6px 14px",
                cursor: "pointer",
                borderRadius: "4px",
                fontSize: "13px",
                fontWeight: 500,
              }}
            >
              <span className="inline-flex items-center gap-1">
                <Check size={14} strokeWidth={2.4} />
                <span>Allow</span>
              </span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // Determine if this is a reasoning message (assistant with text content)
  const isReasoning = role === "assistant" && content && !isError;
  const hasToolCalls = toolCalls && toolCalls.length > 0;
  const hasToolResults = toolResults && toolResults.length > 0;
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
  const showHeader = role === "user" || content || isError;

  const messageClasses = `mb-4 p-3 rounded-lg bg-[var(--vscode-editor-background)] shadow-[0_6px_16px_rgba(0,0,0,0.14)] w-full ${
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

  // For tool call messages, combine tool call and result
  if (hasToolCalls && !content) {
    const toolCall = toolCalls[0];
    const toolResult = hasToolResults ? toolResults[0] : undefined;

    return (
      <div className="mb-3">
        <ToolCallDisplay toolCall={toolCall} result={toolResult} />
      </div>
    );
  }

  // For reasoning messages
  return (
    <div className={messageClasses}>
      {showHeader && (
        <div className="flex items-center gap-2 mb-2 text-xs text-[var(--vscode-descriptionForeground)]">
          <span className="font-semibold text-[var(--vscode-foreground)] inline-flex items-center gap-1.5">
            {header?.icon}
            <span>{header?.label}</span>
          </span>
          <span className="opacity-70 ml-auto">
            {message.timestamp.toLocaleTimeString()}
          </span>
        </div>
      )}

      <div className="text-(--vscode-foreground)">
        {content && (
          <div
            className={`leading-relaxed [&_p]:m-0 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_code]:bg-(--vscode-textCodeBlock-background) [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.9em] [&_pre]:my-2 [&_pre]:rounded [&_pre]:overflow-x-auto`}
          >
            <ReactMarkdown
              components={{
                code(props) {
                  const { children, className, ...rest } = props;
                  const match = /language-(\w+)/.exec(className || "");
                  const language = match ? match[1] : "";

                  return language ? (
                    <SyntaxHighlighter
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      style={syntaxTheme as any}
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
              {content}
            </ReactMarkdown>
            {isStreaming && (
              <span className="inline-block animate-[blink_1s_infinite] text-[var(--vscode-editorCursor-foreground)] ml-0.5">
                ▊
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
