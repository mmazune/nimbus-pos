import { Badge } from "@/components/ui";
import {
  CASHIER_BILL_CLASSIFICATION_LABELS,
  type CashierBillCandidate,
} from "@/lib/cashier/bill-resolution";
import { normalizeCashierOrder } from "@/lib/cashier/order-state";

/**
 * Bounded multiple-payable-bill selector (Prompt C2).
 *
 * When a table has more than one payable bill the cashier must choose one — the
 * first is NEVER auto-selected. Rows show enough verified information to tell
 * bills apart (order number, status, service, opened time, total) and never
 * expose guest names, contact details, payment references, or a raw UUID as the
 * primary label. Selection is keyboard-accessible.
 */

type CashierBillSelectorProps = {
  candidates: CashierBillCandidate[];
  fallbackBranchName?: string;
  onSelect: (orderId: string) => void;
};

export function CashierBillSelector({ candidates, fallbackBranchName, onSelect }: CashierBillSelectorProps) {
  return (
    <section className="grid gap-3" aria-label="Select a bill for this table">
      <div className="grid gap-1">
        <h3 className="text-lg font-bold text-text-primary">Multiple bills on this table</h3>
        <p className="text-sm font-medium text-text-secondary">
          {candidates.length} payable bills are open. Choose one to continue.
        </p>
      </div>

      <ul className="grid gap-2" aria-label="Payable bills">
        {candidates.map((candidate) => {
          const view = normalizeCashierOrder({ order: candidate.order, fallbackBranchName });
          const classification = CASHIER_BILL_CLASSIFICATION_LABELS[candidate.classification];
          return (
            <li key={candidate.order.id}>
              <button
                type="button"
                onClick={() => onSelect(candidate.order.id)}
                className="grid w-full gap-1 rounded-md border border-border-subtle bg-surface p-3 text-left hover:bg-surface-muted focus-visible:shadow-focus"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-semibold text-text-primary">{view.orderNumber}</span>
                  <span className="font-bold tabular-nums text-text-primary">{view.formattedTotal}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
                  <Badge variant={view.statusTone}>{view.statusLabel}</Badge>
                  {candidate.isBillRequested ? <Badge variant="warning">Bill requested</Badge> : null}
                  <Badge variant={classification.tone}>{classification.label}</Badge>
                  <span>{view.serviceTypeLabel}</span>
                  <span>Opened {view.openedLabel}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
