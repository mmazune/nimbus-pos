import { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger";
type ButtonSize = "compact" | "standard" | "pos";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  staticPress?: boolean;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-navy-900 text-text-inverse shadow-subtle hover:bg-brand-navy-800 disabled:bg-brand-silver disabled:text-text-secondary",
  secondary:
    "bg-surface text-text-primary shadow-subtle hover:bg-surface-muted disabled:bg-surface-muted disabled:text-text-muted",
  tertiary:
    "bg-transparent text-text-secondary hover:bg-surface-muted disabled:text-text-muted",
  danger:
    "bg-status-danger text-text-inverse shadow-subtle hover:brightness-95 disabled:bg-status-danger-surface disabled:text-status-danger",
};

const sizeClasses: Record<ButtonSize, string> = {
  compact: "min-h-9 px-3 text-sm",
  standard: "min-h-10 px-4 text-sm",
  pos: "min-h-12 px-5 text-base",
};

export function Button({
  className,
  children,
  variant = "primary",
  size = "standard",
  leadingIcon,
  trailingIcon,
  staticPress = false,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-semibold",
        "transition-[background-color,box-shadow,filter,transform] duration-150 ease-out",
        !staticPress && "active:scale-[0.96]",
        "disabled:pointer-events-none",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {leadingIcon}
      <span>{children}</span>
      {trailingIcon}
    </button>
  );
}
