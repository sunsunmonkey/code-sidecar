import React, { useState, useRef, useEffect } from "react";
import { Bug, Check, Code2, MessageCircleQuestion, PanelsTopLeft } from "lucide-react";
import type { WorkMode } from "../types/messages";

interface ModeSelectorProps {
  currentMode: WorkMode;
  onModeChange: (mode: WorkMode) => void;
}

interface ModeOption {
  id: WorkMode;
  name: string;
  description: string;
  icon: React.ReactNode;
}

/**
 * ModeSelector component for switching between work modes
 * Requirements: 7.5, 7.6
 */
export const ModeSelector: React.FC<ModeSelectorProps> = ({
  currentMode,
  onModeChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Mode definitions matching ModeManager.ts
  const modes: ModeOption[] = [
    {
      id: "architect",
      name: "Architect",
      description: "Architecture design and planning",
      icon: <PanelsTopLeft size={16} strokeWidth={1.75} />,
    },
    {
      id: "code",
      name: "Code",
      description: "Coding and refactoring",
      icon: <Code2 size={16} strokeWidth={1.75} />,
    },
    {
      id: "ask",
      name: "Ask",
      description: "Explanations and documents",
      icon: <MessageCircleQuestion size={16} strokeWidth={1.75} />,
    },
    {
      id: "debug",
      name: "Debug",
      description: "Debugging and issue diagnosis",
      icon: <Bug size={16} strokeWidth={1.75} />,
    },
  ];

  const currentModeOption = modes.find((m) => m.id === currentMode) || modes[1]; // Default to 'code'

  /**
   * Handle mode selection
   * Requirement 7.5: Switch work mode
   */
  const handleModeSelect = (mode: WorkMode) => {
    if (mode !== currentMode) {
      onModeChange(mode);
    }
    setIsOpen(false);
  };

  /**
   * Toggle dropdown
   */
  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  /**
   * Close dropdown when clicking outside
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-flex" ref={dropdownRef}>
      <button
        className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] cursor-pointer transition-all outline-none hover:bg-[var(--vscode-list-hoverBackground)] focus:shadow-[0_0_0_1px_var(--vscode-focusBorder)]"
        onClick={toggleDropdown}
        aria-label={`Select work mode (current: ${currentModeOption.name})`}
        aria-expanded={isOpen}
        title={`${currentModeOption.name} mode`}
      >
        <span className="text-[15px] leading-none flex-shrink-0 text-(--vscode-foreground)">
          {currentModeOption.icon}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-[calc(100%+6px)] left-0 z-[1000] min-w-[240px] max-w-[280px] bg-[var(--vscode-dropdown-background)] rounded shadow-[var(--vscode-widget-shadow)] overflow-hidden animate-[slideDown_0.15s_ease-out]">
          {modes.map((mode) => (
            <button
              key={mode.id}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 border-none bg-transparent text-[var(--vscode-dropdown-foreground)] cursor-pointer transition-colors text-left hover:bg-[var(--vscode-list-hoverBackground)] max-[400px]:px-3 max-[400px]:py-3 ${
                mode.id === currentMode
                  ? "bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]"
                  : ""
              }`}
              onClick={() => handleModeSelect(mode.id)}
              aria-label={`Switch to ${mode.name} mode`}
            >
              <span className="text-base leading-none flex-shrink-0 max-[400px]:text-sm text-(--vscode-foreground)">
                {mode.icon}
              </span>
              <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                <span className="font-medium leading-tight">{mode.name}</span>
                <span
                  className={`text-[11px] leading-tight whitespace-nowrap overflow-hidden text-ellipsis max-[400px]:text-[10px] ${
                    mode.id === currentMode
                      ? "text-[var(--vscode-list-activeSelectionForeground)] opacity-80"
                      : "text-[var(--vscode-descriptionForeground)]"
                  }`}
                >
                  {mode.description}
                </span>
              </div>
              {mode.id === currentMode && (
                <Check
                  size={14}
                  className="text-[var(--vscode-list-activeSelectionForeground)] flex-shrink-0"
                  strokeWidth={2.2}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
