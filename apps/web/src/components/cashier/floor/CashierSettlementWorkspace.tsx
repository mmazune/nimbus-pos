import { ArrowLeft, Info, Receipt, WarningCircle } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";

import { CashierOrderTotals } from "@/components/cashier/queue/CashierOrderTotals";
import { CashierPaymentSummary } from "@/components/cashier/queue/CashierPaymentSummary";
import { CashierQueueStatusBadge } from "@/components/cashier/queue/CashierQueueStatusBadge";
import { Badge, Button, Skeleton, StatusMessage } from "@/components/ui";
import { ApiError, shouldRetryApiRequest } from "@/lib/api/client";
import {
  CASHIER_BILL_CLASSIFICATION_LABELS,
  classifyCashierBillPayment,
  hasCashierPaymentInProgress,
} from "@/lib/cashier/bill-resolution";
import { cashierBillQueryKeys } from "@/lib/cashier/bill-query-keys";
import { formatCashierMoney } from "@/lib/cashier/formatters";
import { normalizeCashierOrder } from "@/lib/cashier/order-state";
import type { CashierOrderApi } from "@/lib/cashier/order-types";
import { getCashierOrder, getCashierOrderPayments } from "@/lib/cashier/orders";
import { CASHIER_TILL_ROUTE } from "@/lib/cashier/floor-route";
import type { CashierReadinessSnapshot } from "@/lib/cashier/readiness";

/**
 * Canonical Cashier settlement workspace (Prompt C2) — READ-ONLY foundation.
 *
 * This is the single settlement surface behind a Floor table selection (and
 * behind a Find-bill / tableless selection). It composes the SAME presentation
 * primitives the Queue checkout preview already uses (`CashierOrderTotals`,
 * `CashierPaymentSummary`, `CashierQueueStatusBadge`, `normalizeCashierOrder`)
 * so there is no duplicated financial logic and no second selected-order model.
 *
 * C2 exposes NO payment / split / close / receipt / refund mutation control —
 * those arrive in C3/C4. Payment state fails CLOSED: if the payment summary is
 * unavailable it is never presented as unpaid or zero-due, and no readiness or
 * action state is derived from missing data.
 */

type CashierSettlementWorkspaceProps = {
  orderId: string;
  token: string;
  branchId: string;
  fallbackBranchName?: string;
  readiness: CashierReadinessSnapshot;
  fallbackOrder?: CashierOrderApi;
  onClose: () => void;
  onBackToBills?: () => void;
};

function detailErrorCopy(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return "This bill is no longer available. It may have been moved, closed, or transferred. Return to Floor and re-select.";
    }
    if (error.isForbidden) return "This bill belongs to another branch and cannot be opened here.";
    if (error.isAuthError) return "Session expired. Please log in again to continue.";
    return error.message || "Could not load this bill.";
  }
  return "Could not load this bill. Try again when the connection is stable.";
}

function paymentErrorCopy(error: unknown) {
  if (!error) return undefined;
  if (error instanceof ApiError) return error.message || "Payment summary unavailable.";
  return "Payment summary unavailable.";
}

function Section({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3" aria-labelledby={id}>
      <div className="flex items-center justify-between gap-3">
        <h3 id={id} className="text-sm font-bold uppercase tracking-wide text-text-muted">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function CashierSettlementWorkspace({
  orderId,
  token,
  branchId,
  fallbackBranchName,
  readiness,
  fallbackOrder,
  onClose,
  onBackToBills,
}: CashierSettlementWorkspaceProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  const detailQuery = useQuery({
    queryKey: cashierBillQueryKeys.orderDetail(branchId, orderId),
    queryFn: () => getCashierOrder(token, branchId, orderId),
    placeholderData: fallbackOrder,
    retry: shouldRetryApiRequest,
    staleTime: 8_000,
  });

  const paymentsQuery = useQuery({
    queryKey: cashierBillQueryKeys.orderPayments(branchId, orderId),
    queryFn: () => getCashierOrderPayments(token, branchId, orderId),
    retry: shouldRetryApiRequest,
    staleTime: 8_000,
  });

  // Move focus into the workspace when the selected bill changes.
  useEffect(() => {
    const raf = window.requestAnimationFrame(() => headingRef.current?.focus());
    return () => window.cancelAnimationFrame(raf);
  }, [orderId]);

  const detailError = detailQuery.isError ? detailErrorCopy(detailQuery.error) : undefined;
  const paymentError = paymentsQuery.isError ? paymentErrorCopy(paymentsQuery.error) : undefined;
  const paymentUnavailable = paymentsQuery.isError || (!paymentsQuery.data && !paymentsQuery.isLoading);

  const order = detailQuery.data || fallbackOrder;
  // Only feed the payment summary into the view model once it has actually
  // loaded — never present missing/failed payment state as unpaid.
  const view = order
    ? normalizeCashierOrder({
        order,
        paymentSummary: paymentsQuery.data || undefined,
        paymentError,
        fallbackBranchName,
      })
    : null;

  const paymentClassification = order
    ? classifyCashierBillPayment(order, paymentsQuery.data || undefined)
    : "UNKNOWN_UNSAFE";
  const classificationMeta = CASHIER_BILL_CLASSIFICATION_LABELS[paymentClassification];
  const paymentInProgress = hasCashierPaymentInProgress(paymentsQuery.data || undefined);

  const receiptExists = order?.status === "CLOSED" || order?.status === "VOIDED";
  const refundEligible = order?.status === "CLOSED";

  const backLabel = onBackToBills ? "Back to bills" : "Back to Floor";
  const handleBack = onBackToBills || onClose;

  const readinessMessages = [
    readiness.shift.status === "inactive" ? "No active shift — payment actions stay blocked." : null,
    readiness.shift.status === "failed" ? "Shift check failed — retry before settling." : null,
    readiness.till.status === "inactive" ? "No active till — cash payments stay blocked." : null,
    readiness.till.status === "failed" ? "Till check failed — cash payments stay blocked." : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <section className="grid gap-6" aria-label="Bill settlement workspace">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="inline-flex w-fit items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-text-secondary hover:bg-surface-muted focus-visible:shadow-focus"
          onClick={handleBack}
        >
          <ArrowLeft size={18} weight="bold" aria-hidden />
          {backLabel}
        </button>
        <Badge variant="info">Read-only</Badge>
      </div>

      {detailError && !order ? (
        <StatusMessage tone="warning" title="Bill unavailable">
          <p>{detailError}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="compact" variant="secondary" onClick={() => void detailQuery.refetch()}>
              Retry
            </Button>
            <Button size="compact" variant="tertiary" onClick={onClose}>
              Back to Floor
            </Button>
          </div>
        </StatusMessage>
      ) : !view ? (
        <div className="grid gap-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          <header className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2
                ref={headingRef}
                tabIndex={-1}
                className="text-2xl font-bold tracking-normal text-text-primary focus:outline-none"
                title={view.orderNumber}
              >
                {view.orderNumber}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <CashierQueueStatusBadge label={view.statusLabel} tone={view.statusTone} />
                <Badge variant={classificationMeta.tone}>{classificationMeta.label}</Badge>
              </div>
            </div>
            {detailError && order ? (
              <p className="text-sm font-medium text-status-warning">
                Showing the last loaded bill snapshot — a fresh read failed.{" "}
                <button
                  type="button"
                  className="font-semibold underline hover:no-underline focus-visible:shadow-focus"
                  onClick={() => void detailQuery.refetch()}
                >
                  Retry
                </button>
              </p>
            ) : null}
          </header>

          {/* BILL */}
          <Section id="cashier-settlement-bill" title="Bill">
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="font-semibold text-text-muted">Table / service</dt>
                <dd className="mt-1 font-bold text-text-primary">{view.tableName}</dd>
              </div>
              <div>
                <dt className="font-semibold text-text-muted">Service</dt>
                <dd className="mt-1 font-bold text-text-primary">{view.serviceTypeLabel}</dd>
              </div>
              <div>
                <dt className="font-semibold text-text-muted">Server</dt>
                <dd className="mt-1 font-bold text-text-primary">{view.serverName}</dd>
              </div>
              <div>
                <dt className="font-semibold text-text-muted">Opened</dt>
                <dd className="mt-1 font-bold text-text-primary">{view.openedLabel}</dd>
              </div>
            </dl>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-text-secondary">Items</span>
                <span className="text-sm font-semibold text-text-muted">
                  {view.lines.length || view.itemCount || 0} lines
                </span>
              </div>
              {detailQuery.isLoading && !order ? (
                <Skeleton className="h-16 w-full" />
              ) : view.lines.length ? (
                <div className="grid gap-2">
                  {view.lines.map((line, index) => (
                    <div key={`${line.id}-${index}`} className="rounded-md bg-surface-muted p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-text-primary">
                            {line.quantity}x {line.name}
                          </p>
                          {[line.servingLabel, line.modifierSummary, line.notes]
                            .filter(Boolean)
                            .map((detail) => (
                              <p key={detail} className="mt-1 text-xs font-medium text-text-secondary">
                                {detail}
                              </p>
                            ))}
                        </div>
                        <p className="font-bold tabular-nums text-text-primary">
                          {formatCashierMoney(line.lineTotal, view.currencyCode)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-md bg-surface-muted p-3 text-sm font-medium text-text-secondary">
                  No item lines are attached to this bill.
                </p>
              )}
            </div>
          </Section>

          {/* TOTALS */}
          <Section id="cashier-settlement-totals" title="Totals">
            <div className="rounded-md bg-surface-muted p-4">
              <CashierOrderTotals order={view} />
            </div>
          </Section>

          {/* PAYMENT STATE */}
          <Section id="cashier-settlement-payment" title="Payment state">
            {paymentInProgress ? (
              <StatusMessage tone="warning" title="Payment in progress">
                A payment is pending or was not confirmed for this bill. Verify before any settlement.
              </StatusMessage>
            ) : null}
            <CashierPaymentSummary
              order={view}
              isLoading={paymentsQuery.isLoading}
              error={paymentError}
              onRetry={() => void paymentsQuery.refetch()}
            />
            {paymentUnavailable && !paymentsQuery.isLoading ? (
              <p className="flex items-start gap-2 rounded-md bg-status-warning-surface p-3 text-sm font-medium text-status-warning">
                <WarningCircle size={18} weight="bold" aria-hidden className="mt-0.5 shrink-0" />
                Payment state is unavailable — this bill is not shown as paid or unpaid until the summary loads.
              </p>
            ) : null}
          </Section>

          {/* SETTLEMENT READINESS */}
          <Section
            id="cashier-settlement-readiness"
            title="Settlement readiness"
            action={
              <Link
                href={CASHIER_TILL_ROUTE}
                className="text-sm font-semibold text-brand-navy-900 underline hover:no-underline focus-visible:shadow-focus"
              >
                Open Till
              </Link>
            }
          >
            <div className="flex flex-wrap gap-2">
              <Badge variant={readiness.shift.tone}>{readiness.shift.label}</Badge>
              <Badge variant={readiness.till.tone}>{readiness.till.label}</Badge>
            </div>
            {readinessMessages.length ? (
              <div className="rounded-md bg-status-warning-surface p-3 text-sm font-medium text-status-warning" role="status">
                {readinessMessages.map((message) => (
                  <p key={message}>{message}</p>
                ))}
              </div>
            ) : null}
            <p className="text-sm font-medium text-text-secondary">
              Payment, split, and close actions open here in a later step. This foundation is read-only.
            </p>
          </Section>

          {/* HISTORY / CONTEXT */}
          <Section id="cashier-settlement-context" title="History &amp; context">
            <ul className="grid gap-2 text-sm font-medium text-text-secondary">
              <li className="flex items-center gap-2 rounded-md bg-surface-muted p-3">
                <Receipt size={18} weight="bold" aria-hidden className="shrink-0 text-text-muted" />
                {receiptExists
                  ? "A receipt exists for this bill. Receipt actions arrive in a later step."
                  : "A receipt becomes available after this bill is closed."}
              </li>
              <li className="flex items-center gap-2 rounded-md bg-surface-muted p-3">
                <Info size={18} weight="bold" aria-hidden className="shrink-0 text-text-muted" />
                {refundEligible
                  ? "This bill is closed — refund eligibility is reviewed in a later step."
                  : "Refunds are available after this bill is closed."}
              </li>
            </ul>
          </Section>

          <div className="sr-only" aria-live="polite">
            {detailQuery.isLoading ? "Loading selected bill." : `Selected bill ${view.orderNumber} loaded.`}
          </div>
        </>
      )}
    </section>
  );
}
