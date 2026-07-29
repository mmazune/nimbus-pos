import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export function OperationalTableWorkspaceFrame({
  children,
  immersive = false,
  onClose,
}: {
  children: ReactNode;
  immersive?: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60]" data-operational-workspace>
      <button
        type="button"
        className="absolute inset-0 bg-brand-navy-950/30"
        aria-label="Close selected table workspace"
        onClick={onClose}
      />
      <aside
        className={cn(
          "absolute bottom-20 right-0 top-[120px] w-[min(1180px,calc(100vw-32px))] rounded-l-xl border-l border-border-subtle bg-page shadow-overlay",
          immersive ? "overflow-visible" : "overflow-y-auto p-5",
        )}
        aria-label="Selected table workspace"
      >
        {children}
      </aside>
    </div>
  );
}
