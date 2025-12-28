import React, {
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useState,
} from "react";
import TextareaAutosize from "react-textarea-autosize";
import type { KeyboardEvent } from "react";
import { Send, Square, Trash2 } from "lucide-react";

interface InputBoxProps {
  onSend: (message: string) => void;
  onClear?: () => void;
  onCancel?: () => void;
  isProcessing: boolean;
  inputValue: string;
  setInputValue: (text: string) => void;
  className?: string;
  modeSelector?: React.ReactNode;
}

interface SlashCommand {
  id: string;
  label: string;
  description: string;
  insertText: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "init",
    label: "/init",
    description: "Generate or update AGENTS.md guidance",
    insertText: "/init ",
  },
];

/**
 * InputBox component for user input with multi-line support
 * Requirements: 4.1, 9.4
 */
export const InputBox: React.FC<InputBoxProps> = ({
  onSend,
  onClear,
  onCancel,
  isProcessing,
  inputValue,
  setInputValue,
  className,
  modeSelector,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const lastCommandQueryRef = useRef("");
  const commandInput = useMemo(() => inputValue.trimStart(), [inputValue]);
  const shouldShowCommands =
    commandInput.startsWith("/") && !/\s/.test(commandInput.slice(1));
  const commandQuery = useMemo(
    () => (shouldShowCommands ? commandInput.slice(1).toLowerCase() : ""),
    [commandInput, shouldShowCommands]
  );
  const filteredCommands = useMemo(() => {
    if (!shouldShowCommands) {
      return [];
    }
    if (!commandQuery) {
      return SLASH_COMMANDS;
    }
    return SLASH_COMMANDS.filter((command) =>
      command.label.slice(1).toLowerCase().startsWith(commandQuery)
    );
  }, [commandQuery, shouldShowCommands]);
  const hasCommandSuggestions = filteredCommands.length > 0;
  const activeCommandIndex = hasCommandSuggestions
    ? Math.min(selectedCommandIndex, filteredCommands.length - 1)
    : 0;

  const applyCommand = useCallback(
    (command: SlashCommand) => {
      const leadingWhitespace = inputValue.match(/^\s*/)?.[0] ?? "";
      setInputValue(`${leadingWhitespace}${command.insertText}`);
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
    [inputValue, setInputValue]
  );

  const syncCommandSelection = useCallback((nextValue: string) => {
    const trimmed = nextValue.trimStart();
    const nextShouldShow =
      trimmed.startsWith("/") && !/\s/.test(trimmed.slice(1));
    const nextQuery = nextShouldShow ? trimmed.slice(1).toLowerCase() : "";

    if (!nextShouldShow || nextQuery !== lastCommandQueryRef.current) {
      setSelectedCommandIndex(0);
    }

    lastCommandQueryRef.current = nextQuery;
  }, []);

  /**
   * Handle send button click
   * Requirement 4.1: Support user input
   */
  const handleSend = useCallback(() => {
    if (isProcessing) {
      return;
    }
    if (inputValue.trim()) {
      onSend(inputValue);
      setInputValue("");
    }
  }, [isProcessing, inputValue, onSend, setInputValue]);

  /**
   * Handle keyboard shortcuts
   * Requirement 4.1: Support Ctrl+Enter to send
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (isProcessing) {
        return;
      }
      const isComposing = e.nativeEvent?.isComposing ?? false;

      if (hasCommandSuggestions && !isComposing) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedCommandIndex(
            (prev) => (prev + 1) % filteredCommands.length
          );
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedCommandIndex(
            (prev) =>
              (prev - 1 + filteredCommands.length) % filteredCommands.length
          );
          return;
        }
        if (e.key === "Tab") {
          e.preventDefault();
          const command = filteredCommands[activeCommandIndex];
          if (command) {
            applyCommand(command);
          }
          return;
        }
        if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
          const isExactMatch = filteredCommands.some(
            (command) => command.label === commandInput
          );
          if (!isExactMatch) {
            e.preventDefault();
            const command = filteredCommands[activeCommandIndex];
            if (command) {
              applyCommand(command);
            }
            return;
          }
        }
      }

      // Ctrl+Enter or Cmd+Enter to send
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !isComposing) {
        e.preventDefault();
        handleSend();
      }

      // Enter without Shift to send (optional behavior)
      // Shift+Enter for new line
      if (
        e.key === "Enter" &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !isComposing
      ) {
        e.preventDefault();
        handleSend();
      }
    },
    [
      activeCommandIndex,
      applyCommand,
      commandInput,
      filteredCommands,
      handleSend,
      hasCommandSuggestions,
      inputValue,
      isProcessing,
      selectedCommandIndex,
    ]
  );

  /**
   * Handle input change
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      syncCommandSelection(newValue);
      setInputValue(newValue);
    },
    [setInputValue, syncCommandSelection]
  );

  /**
   * Focus input on mount
   */
  useEffect(() => {
    if (textareaRef.current && !isProcessing) {
      textareaRef.current.focus();
    }
  }, [isProcessing]);

  const handlePrimaryAction = useCallback(() => {
    if (isProcessing) {
      onCancel?.();
      return;
    }
    handleSend();
  }, [handleSend, isProcessing, onCancel]);

  const isPrimaryDisabled =
    (isProcessing && !onCancel) || (!isProcessing && !inputValue.trim());

  return (
    <div
      className={`flex flex-col gap-2 p-2 md:p-3 bg-[var(--vscode-editor-background)] rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.14)] ${
        className ?? ""
      }`}
    >
      <div className="flex flex-col gap-1.5">
        <div className="relative">
          {hasCommandSuggestions && (
            <div className="absolute left-0 right-0 bottom-full mb-2 z-10">
              <div className="flex flex-col gap-1 rounded-lg bg-[var(--vscode-editorWidget-background)] px-2 py-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.28)]">
                <div className="flex flex-col gap-1 max-h-40 overflow-auto">
                  {filteredCommands.map((command, index) => {
                    const isSelected = index === activeCommandIndex;
                    return (
                      <button
                        key={command.id}
                        type="button"
                        className={`flex items-center gap-2 rounded px-2 py-1 text-left text-[11px] transition-colors ${
                          isSelected
                            ? "bg-[var(--vscode-list-hoverBackground)] text-[var(--vscode-foreground)]"
                            : "text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)]"
                        }`}
                        onClick={() => applyCommand(command)}
                      >
                        <span className="font-semibold text-[var(--vscode-foreground)]">
                          {command.label}
                        </span>
                        <span className="truncate text-[var(--vscode-descriptionForeground)]">
                          {command.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <TextareaAutosize
            ref={textareaRef}
            className="w-full min-h-[40px] px-2.5 py-2 rounded bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] leading-normal resize-none overflow-y-auto outline-none transition-all placeholder:text-[var(--vscode-input-placeholderForeground)] focus:shadow-[0_0_0_1px_var(--vscode-focusBorder)] disabled:opacity-60 disabled:cursor-not-allowed"
            placeholder="Type your message... (Ctrl+Enter to send)"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
            minRows={3}
            maxRows={15}
            autoFocus={true}
          />
        </div>

        <div className="flex flex-nowrap gap-1.5 justify-end items-center">
          {isProcessing && (
            <div className="flex h-8 items-center gap-1.5 px-2.5 text-[11px] text-[var(--vscode-descriptionForeground)] bg-[var(--vscode-badge-background)] rounded mr-auto">
              <span className="inline-block w-2 h-2 bg-[var(--vscode-charts-blue)] rounded-full animate-pulse"></span>
              processing...
            </div>
          )}
          {modeSelector && <div className="flex-shrink-0">{modeSelector}</div>}
          {onClear && (
            <button
              className="flex items-center justify-center h-8 w-8 rounded bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] cursor-pointer transition-colors hover:bg-[var(--vscode-button-secondaryHoverBackground)] disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              onClick={onClear}
              disabled={isProcessing}
              title="Clear conversation"
              aria-label="Clear conversation"
            >
              <Trash2 size={16} strokeWidth={2} />
            </button>
          )}

          <button
            className="flex items-center justify-center gap-1.5 h-8 px-3 rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] text-[13px] font-medium cursor-pointer transition-all whitespace-nowrap hover:bg-[var(--vscode-button-hoverBackground)] active:translate-y-px disabled:opacity-70 disabled:cursor-not-allowed"
            onClick={handlePrimaryAction}
            disabled={isPrimaryDisabled}
            title={
              isProcessing ? "Cancel current task" : "Send message (Ctrl+Enter)"
            }
            aria-label={isProcessing ? "Cancel current task" : "Send message"}
          >
            {isProcessing ? (
              <>
                <Square
                  size={16}
                  strokeWidth={2}
                  className="translate-y-[0.5px]"
                />
                Cancel
              </>
            ) : (
              <>
                <Send
                  size={16}
                  strokeWidth={2}
                  className="translate-y-[0.5px]"
                />
                Send
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
