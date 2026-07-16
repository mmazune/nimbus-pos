import { WarningCircle } from "@phosphor-icons/react";

import { Button } from "@/components/ui";
import { formatCashierMoney } from "@/lib/cashier/formatters";

type CashierRefundConfirmDialogProps = {
  open: boolean;
  amount?: number;
  currencyCode?: string | null;
  expectedPending: boolean;
  isSubmitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function CashierRefundConfirmDialog({
  open,
  amount,
  currencyCode,
  expectedPending,
  isSubmitting,
  onConfirm,
  onCancel,
}: CashierRefundConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-brand-navy-950/60 p-5">
      <div
        className="w-full max-w-md rounded-lg bg-surface p-5 shadow-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cashier-refund-confirm-title"
      >
        <div className="flex items-start gap-3">
          <WarningCircle size={24} weight="bold" className="shrink-0 text-status-warning" aria-hidden />
          <div className="min-w-0">
            <h3 id="cashier-refund-confirm-title" className="text-lg font-bold text-text-primary">
              Confirm refund request
            </h3>
            <div className="mt-2 space-y-2 text-sm font-medium leading-6 text-text-secondary">
              <p>Refund amount: {formatCashierMoney(amount, currencyCode)}.</p>
              <p>
                {expectedPending
                  ? "Expected result: refund request submitted for manager approval."
                  : "Expected result: refund recorded within cashier auto-approval threshold."}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="tertiary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Create refund"}
          </Button>
        </div>
      </div>
    </div>
  );
}
