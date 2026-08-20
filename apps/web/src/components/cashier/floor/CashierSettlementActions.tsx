import { CheckCircle, Lock, Prohibit } from "@phosphor-icons/react";

import { CashierPaymentPanel } from "@/components/cashier/checkout";
import { CashierResolutionPanel } from "@/components/cashier/resolution";
import { StatusMessage } from "@/components/ui";
import type { CashierOrderViewModel } from "@/lib/cashier/order-types";
import { isCashierOrderClosed, isCashierOrderVoid } from "@/lib/cashier/payment-validation";
import type { CashierReadinessSnapshot } from "@/lib/cashier/readiness";

/**
 * Settlement execution surface for the Cashier Floor workspace (Prompt C3).
 *
 * This component adds NO financial logic. It is a mount point that composes the
 * already-verified checkout primitives inside the ONE canonical settlement
 * workspace C2 built:
 *
 *  - `CashierPaymentPanel` — payment collection (cash final-close + manual/stub
 *    reference methods), partial payment + remaining balance, the payment-blocked
 *    banner, the result notice, payment history, and `CashierCloseOrderPanel`
 *    (the truthful close-state surface). Its validation
 *    (`validateCashierPaymentInput`) is the single gate and it fails closed on
 *    readiness that is loading / unavailable / failed / inactive — including a
 *    till owned by another operator, which `GET /api/tills/active` simply does
 *    not return for this actor.
 *  - `CashierResolutionPanel variant="split-only"` — the existing split-bill
 *    allocation and split-items primitives, with the advanced handoff group
 *    (merge / move items / transfer table) intentionally NOT mounted: transfer is
 *    Supervisor-owned and merge/move are not part of cashier settlement.
 *
 * Terminal bills render no execution control at all — closed/voided is read-only
 * and says so, rather than presenting a disabled form.
 */

type CashierSettlementActionsProps = {
  order: CashierOrderViewModel;
  readiness: CashierReadinessSnapshot;
  /** Order detail read is failed/loading — split actions must not run on stale lines. */
  detailBlocked?: boolean;
  /** Payment summary read is failed/loading — no money action may run. */
  paymentSummaryBlocked?: boolean;
  onRefresh: () => Promise<void>;
};

export function CashierSettlementActions({
  order,
  readiness,
  detailBlocked,
  paymentSummaryBlocked,
  onRefresh,
}: CashierSettlementActionsProps) {
  if (isCashierOrderClosed(order)) {
    return (
      <StatusMessage tone="success" title="This bill is closed.">
        <span className="flex items-start gap-2">
          <CheckCircle size={18} weight="bold" aria-hidden className="mt-0.5 shrink-0" />
          <span>
            Payment and close are complete — no further settlement action is available here.
          </span>
        </span>
      </StatusMessage>
    );
  }

  if (isCashierOrderVoid(order)) {
    return (
      <StatusMessage tone="warning" title="This bill is voided.">
        <span className="flex items-start gap-2">
          <Prohibit size={18} weight="bold" aria-hidden className="mt-0.5 shrink-0" />
          <span>A voided bill cannot be paid, split, or closed. Return to Floor and re-select.</span>
        </span>
      </StatusMessage>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-lg bg-surface p-4 shadow-subtle">
        <CashierPaymentPanel
          order={order}
          readiness={readiness}
          paymentSummaryBlocked={paymentSummaryBlocked}
          onRefresh={onRefresh}
        />
      </div>

      <CashierResolutionPanel
        order={order}
        targetOrders={[]}
        readiness={readiness}
        variant="split-only"
        detailBlocked={detailBlocked}
        paymentSummaryBlocked={paymentSummaryBlocked}
        onRefresh={onRefresh}
      />

      <p className="flex items-start gap-2 rounded-md bg-surface-muted p-3 text-sm font-medium text-text-secondary">
        <Lock size={18} weight="bold" aria-hidden className="mt-0.5 shrink-0 text-text-muted" />
        Receipt actions and refunds are not available from this workspace yet. Void, discount, and
        table/server transfer stay outside the cashier role.
      </p>
    </div>
  );
}
