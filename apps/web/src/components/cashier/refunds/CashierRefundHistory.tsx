import { ClockCounterClockwise } from "@phosphor-icons/react";

import { Skeleton, StatusMessage } from "@/components/ui";
import { formatCashierMoney } from "@/lib/cashier/formatters";
import type { CashierRefundViewModel } from "@/lib/cashier/refund-types";

import { CashierRefundStatusBadge } from "./CashierRefundStatusBadge";

type CashierRefundHistoryProps = {
  refunds: CashierRefundViewModel[];
  isLoading?: boolean;
  error?: string;
  currencyCode?: string | null;
};

export function CashierRefundHistory({
  refunds,
  isLoading,
  error,
  currencyCode,
}: CashierRefundHistoryProps) {
  return (
    <section className="rounded-lg bg-surface p-4 shadow-subtle" aria-labelledby="cashier-refund-history-title">
      <div className="flex items-center justify-between gap-3">
        <h3 id="cashier-refund-history-title" className="font-bold text-text-primary">
          Refund History
        </h3>
        <ClockCounterClockwise size={20} weight="bold" className="text-text-secondary" aria-hidden />
      </div>

      {isLoading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : error ? (
        <div className="mt-3">
          <StatusMessage tone="warning" title="Could not load refund history.">
            {error}
          </StatusMessage>
        </div>
      ) : refunds.length === 0 ? (
        <p className="mt-3 rounded-md bg-surface-muted p-3 text-sm font-semibold text-text-secondary">
          No refunds recorded for this order.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {refunds.map((refund) => (
            <article key={refund.id} className="rounded-md bg-surface-muted p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-bold tabular-nums text-text-primary">{refund.id}</p>
                    <CashierRefundStatusBadge label={refund.statusLabel} tone={refund.statusTone} />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-text-secondary">
                    Payment {refund.paymentId} - {refund.provider}
                  </p>
                  <p className="mt-2 text-sm font-medium leading-6 text-text-secondary">{refund.reason}</p>
                </div>
                <p className="shrink-0 font-bold tabular-nums text-text-primary">
                  {formatCashierMoney(refund.amount, currencyCode)}
                </p>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="font-semibold text-text-muted">Requested by</dt>
                  <dd className="mt-1 font-bold text-text-primary">{refund.requestedBy}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-text-muted">Approved by</dt>
                  <dd className="mt-1 font-bold text-text-primary">{refund.approvedBy}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-text-muted">Created</dt>
                  <dd className="mt-1 font-bold tabular-nums text-text-primary">
                    {refund.createdAt || "Created time unavailable"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-text-muted">Updated</dt>
                  <dd className="mt-1 font-bold tabular-nums text-text-primary">
                    {refund.updatedAt || "Updated time unavailable"}
                  </dd>
                </div>
              </dl>

              {refund.approvalRequired ? (
                <p className="mt-3 rounded-md bg-status-warning-surface p-2 text-xs font-bold text-status-warning">
                  Approval required.
                </p>
              ) : null}
              {refund.failureReason ? (
                <p className="mt-3 rounded-md bg-status-danger-surface p-2 text-xs font-bold text-status-danger">
                  Failure reason: {refund.failureReason}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
