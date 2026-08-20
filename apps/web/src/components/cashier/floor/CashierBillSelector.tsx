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
 *
 * Two truthful modes share one row shell:
 *  - `payable` (default) — the canonical multiple-payable-bill chooser;
 *  - `closed-history` — the read-only terminal list rendered under the zero-
 *    payable empty state. Same rows, but the framing copy must NOT claim the
 *    bills are open/payable, and the redundant "Closed" classification badge is
 *    suppressed because the status badge already says Closed.
 */

type CashierBillSelectorMode = "payable" | "closed-history";

type CashierBillSelectorProps = {
  candidates: CashierBillCandidate[];
  fallbackBranchName?: string;
  onSelect: (orderId: string) => void;
  /** Framing/labelling variant. Defaults to the payable chooser. */
  mode?: CashierBillSelectorMode;
};

function selectorCopy(mode: CashierBillSelectorMode, count: number) {
  if (mode === "closed-history") {
    return {
      sectionLabel: "Recent closed bills for this table",
      heading: "Recent closed bills",
      description:
        count === 1
          ? "1 closed bill on this table. Open it read-only."
          : `${count} closed bills on this table. Open one read-only.`,
      listLabel: "Closed bills",
    };
  }
  return {
    sectionLabel: "Select a bill for this table",
    heading: "Multiple bills on this table",
    description: `${count} payable bills are open. Choose one to continue.`,
    listLabel: "Payable bills",
  };
}

export function CashierBillSelector({
  candidates,
  fallbackBranchName,
  onSelect,
  mode = "payable",
}: CashierBillSelectorProps) {
  const copy = selectorCopy(mode, candidates.length);
  const showClassificationBadge = mode !== "closed-history";

  return (
    <section className="grid gap-3" aria-label={copy.sectionLabel}>
      <div className="grid gap-1">
        <h3 className="text-lg font-bold text-text-primary">{copy.heading}</h3>
        <p className="text-sm font-medium text-text-secondary">{copy.description}</p>
      </div>

      <ul className="grid gap-2" aria-label={copy.listLabel}>
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
                  {showClassificationBadge ? (
                    <Badge variant={classification.tone}>{classification.label}</Badge>
                  ) : null}
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
