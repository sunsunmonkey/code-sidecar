import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface InputProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  error?: string;
  type?: 'text' | 'password' | 'number';
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  required?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  value,
  onChange,
  error,
  type = 'text',
  placeholder,
  min,
  max,
  step,
  disabled = false,
  required = false,
}) => {
  const inputClasses = `w-full px-2 py-1.5 text-[13px] text-[var(--vscode-input-foreground)] bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border,var(--vscode-panel-border))] rounded-sm outline-none transition-all placeholder:text-[var(--vscode-input-placeholderForeground)] placeholder:opacity-70 hover:border-[var(--vscode-inputOption-activeBorder,var(--vscode-focusBorder))] focus:border-[var(--vscode-focusBorder)] disabled:opacity-50 disabled:cursor-not-allowed ${
    error ? 'border-[var(--vscode-inputValidation-errorBorder)] bg-[var(--vscode-inputValidation-errorBackground)]' : ''
  } ${required ? 'border-l-[3px] border-l-[var(--vscode-textLink-foreground)]' : ''} ${
    type === 'password' ? 'font-mono tracking-wider' : ''
  }`;

  return (
    <div className="flex flex-col gap-1.5 mb-4">
      <label className="text-[13px] font-medium text-[var(--vscode-foreground)] select-none">
        {label}
        {required && <span className="text-[var(--vscode-errorForeground)] font-bold"> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClasses}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        required={required}
      />
      {error && (
        <span className="text-xs text-[var(--vscode-inputValidation-errorForeground,var(--vscode-errorForeground))] -mt-0.5 leading-snug flex items-start gap-1">
          <AlertCircle size={12} strokeWidth={2.4} className="flex-shrink-0" />
          <span>{error}</span>
        </span>
      )}
    </div>
  );
};
