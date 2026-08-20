import { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Manager content-region wrapper (Track B1). `OperationalShell`'s `<main>` is
 * already the single scroll owner (max-width 1600px, top/bottom padding) —
 * this component standardizes the per-page container inside it (gap +
 * min-w-0 for truncation-safe grids) and MUST NOT add its own
 * `overflow-y-*`, or the page gets two scrollbars.
 */
type ManagerContentShellProps = {
  children: ReactNode;
  className?: string;
};

export function ManagerContentShell({ children, className }: ManagerContentShellProps) {
  return <div className={cn("flex min-w-0 flex-col gap-4", className)}>{children}</div>;
}
