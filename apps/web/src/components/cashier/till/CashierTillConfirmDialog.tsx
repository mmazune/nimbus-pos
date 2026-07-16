import { WarningCircle } from "@phosphor-icons/react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui";

type CashierTillConfirmDialogProps = {
  open: boolean;
  title: string;
  confirmLabel: string;
  isSubmitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children: ReactNode;
};

export function CashierTillConfirmDialog({
  open,
  title,
  confirmLabel,
  isSubmitting,
  onConfirm,
  onCancel,
  children,
}: CashierTillConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-brand-navy-950/60 p-5">
      <div
        className="w-full max-w-md rounded-lg bg-surface p-5 shadow-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cashier-till-confirm-title"
      >
        <div className="flex items-start gap-3">
          <WarningCircle size={24} weight="bold" className="shrink-0 text-status-warning" aria-hidden />
          <div className="min-w-0">
            <h3 id="cashier-till-confirm-title" className="text-lg font-bold text-text-primary">
              {title}
            </h3>
            <div className="mt-2 text-sm font-medium leading-6 text-text-secondary">{children}</div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="tertiary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Working..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
