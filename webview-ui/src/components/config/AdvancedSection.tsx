import React from "react";
import { Input } from "../common/Input";
import type { WorkMode } from "../../types/messages";

export interface AdvancedSectionProps {
  advanced: {
    defaultMode: WorkMode;
    maxLoopCount: number;
    contextWindowSize: number;
  };
  onChange: (field: string, value: string | number) => void;
  errors?: {
    maxLoopCount?: string;
    contextWindowSize?: string;
  };
}

export const AdvancedSection: React.FC<AdvancedSectionProps> = ({
  advanced,
  onChange,
  errors = {},
}) => {
  const handleModeChange = (value: string) => {
    onChange("defaultMode", value as WorkMode);
  };

  const handleMaxLoopCountChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      onChange("maxLoopCount", numValue);
    }
  };

  const handleContextWindowSizeChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      onChange("contextWindowSize", numValue);
    }
  };

  return (
    <section className="p-4 mb-4 border border-(--vscode-panel-border) rounded bg-(--vscode-editor-background) transition-all">
      <h2 className="text-base font-semibold text-(--vscode-foreground) m-0 mb-4 pb-2 border-b border-(--vscode-panel-border)">
        Advanced Settings
      </h2>
      <div className="flex flex-col gap-1.5 mb-4">
        <label className="text-[13px] font-medium text-(--vscode-foreground) select-none">
          Default Mode
        </label>
        <select
          value={advanced.defaultMode}
          onChange={(e) => handleModeChange(e.target.value)}
          className="w-full px-2 py-1.5 text-[13px] text-(--vscode-input-foreground) bg-(--vscode-input-background) border border-(--vscode-input-border,var(--vscode-panel-border)) rounded-sm outline-none cursor-pointer transition-all hover:border-(--vscode-inputOption-activeBorder,var(--vscode-focusBorder)) focus:border-(--vscode-focusBorder)"
        >
          <option value="architect">Architect</option>
          <option value="code">Code</option>
          <option value="ask">Ask</option>
          <option value="debug">Debug</option>
        </select>
      </div>
      <Input
        label="Max Loop Count"
        type="number"
        value={advanced.maxLoopCount}
        onChange={handleMaxLoopCountChange}
        error={errors.maxLoopCount}
        min={1}
        placeholder="10"
      />
      <Input
        label="Context Window Size"
        type="number"
        value={advanced.contextWindowSize}
        onChange={handleContextWindowSizeChange}
        error={errors.contextWindowSize}
        min={1}
        placeholder="8192"
      />
    </section>
  );
};
