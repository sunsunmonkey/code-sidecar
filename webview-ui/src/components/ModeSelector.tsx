import React, { useState, useRef, useEffect } from "react";
import { Check } from "lucide-react";
import type { WorkMode } from "code-sidecar-shared/types/modes";

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
      icon: "🏗️",
    },
    {
      id: "code",
      name: "Code",
      description: "Coding and refactoring",
      icon: "💻",
    },
    {
      id: "ask",
      name: "Ask",
      description: "Explanations and documents",
      icon: "💬",
    },
    {
      id: "debug",
      name: "Debug",
      description: "Debugging and issue diagnosis",
      icon: "🐞",
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
        className="inline-flex h-8 w-8 items-center justify-center rounded bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] cursor-pointer transition-colors outline-none hover:bg-[var(--vscode-button-secondaryHoverBackground)] focus:shadow-[0_0_0_1px_var(--vscode-focusBorder)]"
        onClick={toggleDropdown}
        aria-label={`Select work mode (current: ${currentModeOption.name})`}
        aria-expanded={isOpen}
        title={`${currentModeOption.name} mode`}
      >
        <span className="text-[14px] leading-none flex-shrink-0 text-(--vscode-foreground)">
          {currentModeOption.icon}
        </span>
      </button>

      {isOpen && (
        <div className="absolute bottom-[calc(100%+6px)] right-0 z-[1000] min-w-[200px] max-w-[240px] bg-[var(--vscode-dropdown-background)] rounded shadow-[var(--vscode-widget-shadow)] overflow-hidden animate-[slideDown_0.15s_ease-out]">
          {modes.map((mode) => (
            <button
              key={mode.id}
              className={`w-full flex items-center gap-2 pl-3 pr-4 py-2 border-none bg-transparent text-[13px] text-[var(--vscode-dropdown-foreground)] cursor-pointer transition-colors text-left hover:bg-[var(--vscode-list-hoverBackground)] max-[400px]:pl-3 max-[400px]:pr-3 max-[400px]:py-2.5 ${
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
              <div className="flex-1 flex flex-col gap-0 min-w-0">
                <span className="font-medium leading-tight text-[13px]">{mode.name}</span>
                <span
                  className={`text-[10px] leading-tight whitespace-nowrap overflow-hidden text-ellipsis max-[400px]:text-[9px] ${
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
                  size={12}
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

