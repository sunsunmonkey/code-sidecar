import * as React from "react";
import { cn } from "../../utils/utils";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full px-2 py-1.5 text-[13px]",
          "text-[var(--vscode-input-foreground)] bg-[var(--vscode-input-background)]",
          "border border-[var(--vscode-input-border,var(--vscode-panel-border))] rounded-sm",
          "outline-none transition-colors",
          "placeholder:text-[var(--vscode-input-placeholderForeground)] placeholder:opacity-70",
          "hover:border-[var(--vscode-inputOption-activeBorder,var(--vscode-focusBorder))]",
          "focus-visible:border-[var(--vscode-focusBorder)]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          type === "password" && "font-mono tracking-wider",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
