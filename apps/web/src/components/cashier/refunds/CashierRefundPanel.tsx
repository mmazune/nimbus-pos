import { ArrowCounterClockwise, X } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { Button, ErrorState, Skeleton, StatusMessage } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { buildCashierIdempotencyKey } from "@/lib/cashier/idempotency";
import { getCashierOrder, getCashierOrderPayments } from "@/lib/cashier/orders";
import {
  deriveRefundStatus,
  deriveRefundableAmount,
  normalizeCashierRefund,
} from "@/lib/cashier/refund-state";
import type { CreateCashierRefundInput } from "@/lib/cashier/refund-types";
import {
  createCashierRefund,
  listCashierOrderRefunds,
  mapRefundApiError,
} from "@/lib/cashier/refunds";
import type { CashierReceiptViewModel } from "@/lib/cashier/receipt-types";

import { CashierRefundBlockedBanner } from "./CashierRefundBlockedBanner";
import { CashierRefundBoundaryCard } from "./CashierRefundBoundaryCard";
import { CashierRefundForm } from "./CashierRefundForm";
import { CashierRefundHistory } from "./CashierRefundHistory";
import { CashierRefundResultNotice } from "./CashierRefundResultNotice";
import { CashierRefundSummary } from "./CashierRefundSummary";

type CashierRefundPanelProps = {
  open: boolean;
  orderId?: string | null;
  receipt?: CashierReceiptViewModel | null;
  onClose: () => void;
  onRefresh?: () => Promise<void> | void;
  onCreated?: (message: { tone: "success" | "warning"; title: string; body?: string }) => void;
};

type RefundResult = {
  tone: "success" | "info" | "warning" | "danger";
  title: string;
  body?: string;
};

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message || fallback;
  return error instanceof Error ? error.message : fallback;
}

export function CashierRefundPanel({
  open,
  orderId,
  receipt,
  onClose,
  onRefresh,
  onCreated,
}: CashierRefundPanelProps) {
  const queryClient = useQueryClient();
  const { accessToken, branchId, isCashier, isLoading, clearSession } = useAuth();
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | undefined>();
  const [result, setResult] = useState<RefundResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canQuery = Boolean(open && accessToken && branchId && orderId);

  const orderQuery = useQuery({
    queryKey: ["cashier", "order-detail", branchId, orderId, "refund"],
    enabled: canQuery,
    queryFn: () => getCashierOrder(accessToken as string, branchId as string, orderId as string),
    retry: 1,
    staleTime: 10_000,
  });

  const paymentsQuery = useQuery({
    queryKey: ["cashier", "order-payments", branchId, orderId, "refund"],
    enabled: canQuery,
    queryFn: () => getCashierOrderPayments(accessToken as string, branchId as string, orderId as string),
    retry: 1,
    staleTime: 10_000,
  });

  const refundsQuery = useQuery({
    queryKey: ["cashier", "order-refunds", branchId, orderId],
    enabled: canQuery,
    queryFn: () => listCashierOrderRefunds(accessToken as string, branchId as string, orderId as string),
    retry: 1,
    staleTime: 10_000,
  });

  useEffect(() => {
    const error = orderQuery.error || paymentsQuery.error || refundsQuery.error;
    if (error instanceof ApiError && error.isAuthError) clearSession();
  }, [clearSession, orderQuery.error, paymentsQuery.error, refundsQuery.error]);

  const refunds = useMemo(
    () => (refundsQuery.data || []).map(normalizeCashierRefund),
    [refundsQuery.data],
  );

  const summary = useMemo(
    () =>
      deriveRefundableAmount({
        payments: paymentsQuery.data?.payments,
        refunds: refundsQuery.data,
        refundsTrusted: !refundsQuery.error && Boolean(refundsQuery.data),
      }),
    [paymentsQuery.data?.payments, refundsQuery.data, refundsQuery.error],
  );

  const firstAvailablePayment = useMemo(
    () => summary.paymentOptions.find((payment) => !payment.disabledReason),
    [summary.paymentOptions],
  );

  useEffect(() => {
    if (!open) {
      setSelectedPaymentId(undefined);
      setResult(null);
      setSubmitError(null);
      return;
    }
    if (!selectedPaymentId && firstAvailablePayment) {
      setSelectedPaymentId(firstAvailablePayment.id);
    }
  }, [firstAvailablePayment, open, selectedPaymentId]);

  const selectedPayment = summary.paymentOptions.find((payment) => payment.id === selectedPaymentId);
  const currencyCode = receipt?.currencyCode || orderQuery.data?.branch?.currencyCode || "UGX";
  const orderStatus = String(orderQuery.data?.status || receipt?.status || "").toUpperCase();
  const loading = orderQuery.isLoading || paymentsQuery.isLoading || refundsQuery.isLoading;
  const orderError = orderQuery.error ? errorMessage(orderQuery.error, "Could not load order detail.") : undefined;
  const paymentError = paymentsQuery.error
    ? errorMessage(paymentsQuery.error, "Could not load order payment summary.")
    : undefined;
  const refundHistoryError = refundsQuery.error
    ? errorMessage(refundsQuery.error, "Could not load refund history.")
    : undefined;

  const blockedReason = (() => {
    if (isLoading) return "Session is still loading.";
    if (!accessToken) return "Sign in before creating a refund.";
    if (!isCashier) return "Only cashier users can create cashier refund requests.";
    if (!branchId) return "Branch context is missing.";
    if (!orderId) return "Order detail is missing.";
    if (orderError) return "Order detail missing or unavailable.";
    if (paymentError) return "Payment summary failed, so refund payments cannot be trusted.";
    if (refundHistoryError) return "Refund history failed, so refundable amount cannot be trusted.";
    if (orderStatus === "VOIDED") return "Voided orders cannot be refunded by the cashier workflow.";
    if (orderStatus && orderStatus !== "CLOSED") return "Refunds are available after close.";
    if (summary.paymentOptions.length === 0) return "No payment rows returned for this order.";
    if (!firstAvailablePayment) return "No refundable completed payment exists.";
    if (summary.remainingRefundable !== undefined && summary.remainingRefundable <= 0) {
      return "No refundable balance remains for this order.";
    }
    if (isSubmitting) return "This refund request is already processing.";
    return null;
  })();

  async function refreshAfterCreate() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["cashier", "order-refunds", branchId, orderId] }),
      queryClient.invalidateQueries({ queryKey: ["cashier", "order-detail", branchId, orderId] }),
      queryClient.invalidateQueries({ queryKey: ["cashier", "order-payments", branchId, orderId] }),
      queryClient.invalidateQueries({ queryKey: ["cashier", "receipt", branchId, orderId] }),
      queryClient.invalidateQueries({ queryKey: ["cashier", "receipt-history", branchId, orderId] }),
      queryClient.invalidateQueries({ queryKey: ["cashier", "receipt-candidate-orders", branchId] }),
      queryClient.invalidateQueries({ queryKey: ["cashier", "orders", branchId] }),
      orderQuery.refetch(),
      paymentsQuery.refetch(),
      refundsQuery.refetch(),
      Promise.resolve(onRefresh?.()),
    ]);
  }

  async function handleSubmit(input: { paymentId: string; amount: number; reason: string }) {
    if (!accessToken || !branchId || !orderId) return;
    setIsSubmitting(true);
    setSubmitError(null);
    setResult(null);

    const body: CreateCashierRefundInput = {
      paymentId: input.paymentId,
      amount: input.amount,
      reason: input.reason,
      metadata: { source: "cashier_refund_panel" },
    };

    try {
      const created = await createCashierRefund({
        token: accessToken,
        branchId,
        orderId,
        idempotencyKey: buildCashierIdempotencyKey({
          operation: "refund-create",
          orderId,
          method: input.paymentId,
        }),
        input: body,
      });
      const status = deriveRefundStatus(created.status);
      const pending = status.approvalRequired;
      const message = pending
        ? {
            tone: "warning" as const,
            title: "Refund request submitted for manager approval.",
            body: "Cashier can create refund requests. Manager approval remains outside this workflow.",
          }
        : {
            tone: "success" as const,
            title: "Refund recorded.",
            body: "The backend returned a completed or approved refund state.",
          };

      setResult(message);
      onCreated?.(message);
      await refreshAfterCreate();
    } catch (error) {
      setSubmitError(mapRefundApiError(error, "Could not create refund request."));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85]">
      <button
        type="button"
        aria-label="Close refund overlay"
        className="absolute inset-0 bg-brand-navy-950/30"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="cashier-refund-title"
        className="absolute right-0 top-0 flex h-full w-[680px] flex-col overscroll-contain bg-page shadow-overlay"
      >
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-border-subtle bg-surface px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ArrowCounterClockwise size={22} weight="bold" className="text-brand-navy-900" aria-hidden />
              <h2 id="cashier-refund-title" className="text-xl font-bold tracking-normal text-text-primary">
                Refund
              </h2>
            </div>
            <p className="mt-1 truncate text-sm font-semibold tabular-nums text-text-secondary">
              {receipt?.orderNumber || orderQuery.data?.orderNumber || orderId || "Order unavailable"}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close refund panel"
            className="flex h-11 w-11 items-center justify-center rounded-md bg-surface-muted text-text-secondary transition-[background-color,transform] duration-150 ease-out hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy-900 active:scale-[0.96]"
            onClick={onClose}
          >
            <X size={20} weight="bold" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="grid gap-4">
            <CashierRefundResultNotice result={result} />
            {submitError ? (
              <StatusMessage tone="danger" title="Refund request failed">
                {submitError}
              </StatusMessage>
            ) : null}

            {loading ? (
              <div className="rounded-lg bg-surface p-5 shadow-subtle">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="mt-4 h-24 w-full" />
                <Skeleton className="mt-4 h-44 w-full" />
              </div>
            ) : orderError ? (
              <ErrorState title="Refund unavailable" description={orderError} />
            ) : (
              <>
                <section className="rounded-lg bg-surface p-4 shadow-subtle" aria-labelledby="refund-order-title">
                  <h3 id="refund-order-title" className="font-bold text-text-primary">
                    Order Identity
                  </h3>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="font-semibold text-text-muted">Order</dt>
                      <dd className="mt-1 font-bold tabular-nums text-text-primary">
                        {receipt?.orderNumber || orderQuery.data?.orderNumber || "Order unavailable"}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-text-muted">Receipt ID</dt>
                      <dd className="mt-1 truncate font-bold tabular-nums text-text-primary">
                        {receipt?.id || orderId}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-text-muted">Table</dt>
                      <dd className="mt-1 font-bold text-text-primary">
                        {receipt?.tableName || orderQuery.data?.table?.label || "Table unavailable"}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-text-muted">Closed</dt>
                      <dd className="mt-1 font-bold tabular-nums text-text-primary">
                        {receipt?.updatedAt || "Closed time unavailable"}
                      </dd>
                    </div>
                  </dl>
                </section>

                <CashierRefundSummary
                  summary={summary}
                  currencyCode={currencyCode}
                  selectedPaymentRefundable={selectedPayment?.refundableAmount}
                />
                <CashierRefundHistory
                  refunds={refunds}
                  isLoading={refundsQuery.isLoading}
                  error={refundHistoryError}
                  currencyCode={currencyCode}
                />
                <CashierRefundBlockedBanner reason={blockedReason} />
                <CashierRefundForm
                  paymentOptions={summary.paymentOptions}
                  selectedPaymentId={selectedPaymentId}
                  currencyCode={currencyCode}
                  remainingRefundable={summary.remainingRefundable}
                  blockedReason={blockedReason}
                  isSubmitting={isSubmitting}
                  onPaymentChange={setSelectedPaymentId}
                  onSubmit={handleSubmit}
                />
                <CashierRefundBoundaryCard title="Manager approval">
                  Cashier can create refund requests. Approval for refunds above threshold is manager/supervisor-only.
                </CashierRefundBoundaryCard>
                <CashierRefundBoundaryCard title="Post-close void">
                  Post-close void is manager/supervisor-only and remains outside the cashier workflow.
                </CashierRefundBoundaryCard>
              </>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
