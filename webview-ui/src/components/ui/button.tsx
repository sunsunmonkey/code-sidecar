import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../utils/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vscode-focusBorder)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none min-h-[28px]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]",
        secondary:
          "bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]",
        destructive:
          "bg-[var(--vscode-errorForeground)] text-white hover:opacity-90",
        ghost: "hover:bg-[var(--vscode-toolbar-hoverBackground)]",
        link: "text-[var(--vscode-textLink-foreground)] underline-offset-4 hover:underline",
      },
      size: {
        default: "px-3.5 py-1.5",
        sm: "h-7 px-2.5 text-xs",
        lg: "h-9 px-4",
        icon: "h-7 w-7",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        {children}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
