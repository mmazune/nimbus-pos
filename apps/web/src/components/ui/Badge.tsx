import { HTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

type BadgeVariant = "neutral" | "success" | "warning" | "danger" | "info";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const badgeClasses: Record<BadgeVariant, string> = {
  neutral: "bg-status-neutral-surface text-status-neutral",
  success: "bg-status-success-surface text-status-success",
  warning: "bg-status-warning-surface text-status-warning",
  danger: "bg-status-danger-surface text-status-danger",
  info: "bg-status-info-surface text-status-info",
};

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-semibold",
        badgeClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
