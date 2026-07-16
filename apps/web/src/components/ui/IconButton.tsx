import { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: ReactNode;
  variant?: "neutral" | "inverse";
};

export function IconButton({
  className,
  label,
  icon,
  variant = "neutral",
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-11 w-11 items-center justify-center rounded-md",
        "transition-[background-color,box-shadow,transform] duration-150 ease-out active:scale-[0.96]",
        variant === "neutral" && "bg-surface text-text-secondary shadow-subtle hover:bg-surface-muted",
        variant === "inverse" &&
          "bg-brand-navy-800 text-text-inverse hover:bg-brand-navy-900",
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
}
