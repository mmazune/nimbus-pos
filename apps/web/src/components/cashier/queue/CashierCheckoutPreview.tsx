import {
  ArrowCounterClockwise,
  Receipt,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";

import { CashierPaymentPanel } from "@/components/cashier/checkout";
import { CashierResolutionPanel } from "@/components/cashier/resolution";
import { Badge, Button, Skeleton, StatusMessage } from "@/components/ui";
import { formatCashierMoney } from "@/lib/cashier/formatters";
import type { CashierOrderViewModel } from "@/lib/cashier/order-types";
import type { CashierReadinessSnapshot } from "@/lib/cashier/readiness";

import { CashierOrderTotals } from "./CashierOrderTotals";
import { CashierPaymentSummary } from "./CashierPaymentSummary";
import { CashierQueueStatusBadge } from "./CashierQueueStatusBadge";

type CashierCheckoutPreviewProps = {
  order?: CashierOrderViewModel | null;
  detailOrder?: CashierOrderViewModel | null;
  targetOrders?: CashierOrderViewModel[];
  readiness: CashierReadinessSnapshot;
  isLoadingDetail?: boolean;
  detailError?: string;
  isLoadingPaymentSummary?: boolean;
  paymentError?: string;
  onClose: () => void;
  onRetryDetail: () => void;
  onRetryPaymentSummary: () => void;
  onPaymentMutation: () => Promise<void>;
  onOpenRefund?: (orderId: string) => void;
};

function readinessMessages(readiness: CashierReadinessSnapshot) {
  return [
    readiness.shift.status === "inactive" ? "No active shift. Payment actions will stay blocked." : null,
    readiness.shift.status === "failed" ? "Shift check failed. Retry before checkout." : null,
    readiness.till.status === "inactive" ? "No active till. Cash payments will stay blocked." : null,
    readiness.till.status === "failed" ? "Till check failed. Cash payments remain blocked." : null,
  ].filter((value): value is string => Boolean(value));
}

function lineKey(lineId: string, index: number) {
  return `${lineId}-${index}`;
}

export function CashierCheckoutPreview({
  order,
  detailOrder,
  targetOrders = [],
  readiness,
  isLoadingDetail,
  detailError,
  isLoadingPaymentSummary,
  paymentError,
  onClose,
  onRetryDetail,
  onRetryPaymentSummary,
  onPaymentMutation,
  onOpenRefund,
}: CashierCheckoutPreviewProps) {
  const current = detailOrder || order;
  const messages = readinessMessages(readiness);
  const receiptAvailable = current?.status === "CLOSED" || current?.status === "VOIDED";
  const refundAvailable = current?.status === "CLOSED";

  if (!current) {
    return (
      <aside
        className="sticky top-40 h-[calc(100vh-12rem)] rounded-lg bg-surface p-5 shadow-subtle"
        aria-labelledby="cashier-preview-title"
      >
        <div className="flex h-full flex-col items-start justify-center text-text-secondary">
          <Receipt size={34} weight="duotone" aria-hidden />
          <h2 id="cashier-preview-title" className="mt-4 text-lg font-bold text-text-primary">
            Select an order
          </h2>
          <p className="mt-2 text-sm">
            The read-only checkout preview opens here with order detail and payment summary.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="sticky top-40 h-[calc(100vh-12rem)] overflow-y-auto rounded-lg bg-surface p-5 shadow-subtle"
      aria-labelledby="cashier-preview-title"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-secondary">Checkout preview</p>
          <h2 id="cashier-preview-title" className="mt-1 truncate text-xl font-bold tracking-normal text-text-primary">
            {current.orderNumber}
          </h2>
        </div>
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-md bg-surface-muted text-text-secondary transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy-900"
          aria-label="Close checkout preview"
          onClick={onClose}
        >
          <X size={22} weight="bold" aria-hidden />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <CashierQueueStatusBadge label={current.statusLabel} tone={current.statusTone} />
        <Badge variant={current.payment.tone}>{current.payment.label}</Badge>
        <Badge variant={current.readinessTone}>{current.readinessLabel}</Badge>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="font-semibold text-text-muted">Table</dt>
          <dd className="mt-1 font-bold text-text-primary">{current.tableName}</dd>
        </div>
        <div>
          <dt className="font-semibold text-text-muted">Service</dt>
          <dd className="mt-1 font-bold text-text-primary">{current.serviceTypeLabel}</dd>
        </div>
        <div>
          <dt className="font-semibold text-text-muted">Server</dt>
          <dd className="mt-1 font-bold text-text-primary">{current.serverName}</dd>
        </div>
        <div>
          <dt className="font-semibold text-text-muted">Opened</dt>
          <dd className="mt-1 font-bold text-text-primary">{current.openedLabel}</dd>
        </div>
      </dl>

      {messages.length ? (
        <div className="mt-5 rounded-md bg-status-warning-surface p-4 text-status-warning" role="status">
          <div className="flex items-start gap-3">
            <WarningCircle size={22} weight="bold" aria-hidden />
            <div className="space-y-1 text-sm font-medium">
              {messages.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <section className="mt-6" aria-labelledby="cashier-lines-title">
        <div className="flex items-center justify-between gap-3">
          <h3 id="cashier-lines-title" className="font-bold text-text-primary">
            Items
          </h3>
          <span className="text-sm font-semibold text-text-muted">
            {current.lines.length || current.itemCount || 0} lines
          </span>
        </div>

        {isLoadingDetail ? (
          <div className="mt-3 space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : detailError ? (
          <StatusMessage tone="warning" title="Could not load order detail.">
            <span>{detailError}</span>
            <Button className="mt-3" variant="secondary" size="compact" onClick={onRetryDetail}>
              Retry detail
            </Button>
          </StatusMessage>
        ) : current.lines.length ? (
          <div className="mt-3 space-y-2">
            {current.lines.map((line, index) => (
              <div key={lineKey(line.id, index)} className="rounded-md bg-surface-muted p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-text-primary">
                      {line.quantity}x {line.name}
                    </p>
                    {[line.servingLabel, line.modifierSummary, line.notes].filter(Boolean).map((detail) => (
                      <p key={detail} className="mt-1 text-xs font-medium text-text-secondary">
                        {detail}
                      </p>
                    ))}
                  </div>
                  <p className="font-bold tabular-nums text-text-primary">
                    {formatCashierMoney(line.lineTotal, current.currencyCode)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-md bg-surface-muted p-3 text-sm font-medium text-text-secondary">
            Item detail is not available from the queue list. Select retry if the detail read failed.
          </p>
        )}
      </section>

      <section className="mt-6" aria-labelledby="cashier-totals-title">
        <h3 id="cashier-totals-title" className="font-bold text-text-primary">
          Totals
        </h3>
        <div className="mt-3 rounded-md bg-surface-muted p-4">
          <CashierOrderTotals order={current} />
        </div>
      </section>

      <section className="mt-6" aria-labelledby="cashier-payment-summary-title">
        <h3 id="cashier-payment-summary-title" className="font-bold text-text-primary">
          Payment summary
        </h3>
        <div className="mt-3">
          <CashierPaymentSummary
            order={current}
            isLoading={isLoadingPaymentSummary}
            error={paymentError}
            onRetry={onRetryPaymentSummary}
          />
        </div>
      </section>

      <section className="mt-6" aria-labelledby="cashier-receipt-link-title">
        <h3 id="cashier-receipt-link-title" className="font-bold text-text-primary">
          Receipt
        </h3>
        {receiptAvailable ? (
          <Link
            href={`/cashier/receipts?receiptId=${current.id}`}
            className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-md bg-brand-navy-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-navy-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy-900"
          >
            <Receipt size={18} weight="bold" aria-hidden />
            View receipt
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-surface-muted px-4 py-2 text-sm font-bold text-text-muted"
          >
            <Receipt size={18} weight="bold" aria-hidden />
            Receipt available after close.
          </button>
        )}
      </section>

      <section className="mt-6" aria-labelledby="cashier-refund-link-title">
        <h3 id="cashier-refund-link-title" className="font-bold text-text-primary">
          Refund
        </h3>
        {refundAvailable && onOpenRefund ? (
          <Button
            className="mt-3 w-full"
            size="pos"
            leadingIcon={<ArrowCounterClockwise size={18} weight="bold" aria-hidden />}
            onClick={() => onOpenRefund(current.id)}
          >
            Open refund
          </Button>
        ) : (
          <button
            type="button"
            disabled
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-surface-muted px-4 py-2 text-sm font-bold text-text-muted"
          >
            <ArrowCounterClockwise size={18} weight="bold" aria-hidden />
            Refunds are available after close.
          </button>
        )}
      </section>

      <section className="mt-6">
        <CashierPaymentPanel
          order={current}
          readiness={readiness}
          paymentSummaryBlocked={Boolean(paymentError) || isLoadingPaymentSummary}
          onRefresh={onPaymentMutation}
        />
      </section>

      <section className="mt-6">
        <CashierResolutionPanel
          order={current}
          targetOrders={targetOrders}
          readiness={readiness}
          detailBlocked={Boolean(detailError) || isLoadingDetail}
          paymentSummaryBlocked={Boolean(paymentError) || isLoadingPaymentSummary}
          onRefresh={onPaymentMutation}
        />
      </section>
    </aside>
  );
}
