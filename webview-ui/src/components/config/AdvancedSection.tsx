import React from "react";
import { Input } from "../common/Input";

export interface AdvancedSectionProps {
  advanced: {
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
    <section className="relative overflow-hidden rounded-2xl bg-[var(--vscode-editor-background)] px-5 md:px-6 py-5 shadow-[0_8px_22px_rgba(0,0,0,0.12)] transition-all">
      <div className="relative">
        <h2 className="text-base font-semibold text-(--vscode-foreground) m-0 mb-2.5">
          Advanced Settings
        </h2>
        <p className="text-[12px] text-[var(--vscode-descriptionForeground)] m-0 mb-2.5 leading-relaxed">
          Control safety limits and how much context the assistant keeps in memory.
        </p>

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
      </div>
    </section>
  );
};
