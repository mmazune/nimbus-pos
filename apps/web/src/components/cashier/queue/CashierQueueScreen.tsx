import { Info } from "@phosphor-icons/react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CashierRefundPanel } from "@/components/cashier/refunds";
import { Badge, PageShell, StatusMessage } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useCashierContext } from "@/lib/cashier/context";
import { normalizeCashierOrder } from "@/lib/cashier/order-state";
import type { CashierOrderPaymentsApi, CashierOrderViewModel } from "@/lib/cashier/order-types";
import { getCashierOrder, getCashierOrderPayments, listCashierOrders } from "@/lib/cashier/orders";
import { filterCashierQueueOrders, searchCashierQueueOrders, type CashierQueueFilterId } from "@/lib/cashier/queue-filters";
import { useCashierReadiness } from "@/lib/cashier/readiness";

import { CashierCheckoutPreview } from "./CashierCheckoutPreview";
import { CashierOrderList } from "./CashierOrderList";
import { CashierQueueToolbar } from "./CashierQueueToolbar";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message || fallback;
  return error instanceof Error ? error.message : fallback;
}

function paymentErrorMessage(error: unknown) {
  if (!error) return undefined;
  return errorMessage(error, "Payment summary unavailable.");
}

function mapByOrderId(
  orderIds: string[],
  queries: Array<{
    data?: unknown;
    error?: unknown;
    isLoading?: boolean;
    isFetching?: boolean;
  }>,
) {
  const data = new Map<string, CashierOrderPaymentsApi>();
  const errors = new Map<string, string>();
  const loading = new Set<string>();

  orderIds.forEach((orderId, index) => {
    const query = queries[index];
    if (!query) return;
    if (query.data) data.set(orderId, query.data as CashierOrderPaymentsApi);
    if (query.error) errors.set(orderId, paymentErrorMessage(query.error) || "Payment summary unavailable.");
    if (query.isLoading || query.isFetching) loading.add(orderId);
  });

  return { data, errors, loading };
}

export function CashierQueueScreen() {
  const queryClient = useQueryClient();
  const { accessToken, branchId, clearSession } = useAuth();
  const cashierContext = useCashierContext();
  const readiness = useCashierReadiness();
  const [activeFilter, setActiveFilter] = useState<CashierQueueFilterId>("active-payable");
  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [refundOrderId, setRefundOrderId] = useState<string | null>(null);

  const canQuery = Boolean(accessToken && branchId);

  const ordersQuery = useQuery({
    queryKey: ["cashier", "orders", branchId, activeFilter],
    enabled: canQuery,
    queryFn: () =>
      activeFilter === "closed-today"
        ? listCashierOrders(accessToken as string, branchId as string, {
            status: "CLOSED",
            pageSize: 100,
          })
        : listCashierOrders(accessToken as string, branchId as string, {
            excludeStatus: ["NEW", "CLOSED", "VOIDED"],
            pageSize: 100,
          }),
    retry: 1,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (ordersQuery.error instanceof ApiError && ordersQuery.error.isAuthError) {
      clearSession();
    }
  }, [clearSession, ordersQuery.error]);

  const listOrders = useMemo(() => ordersQuery.data?.data || [], [ordersQuery.data?.data]);
  const orderIds = useMemo(() => listOrders.map((order) => order.id), [listOrders]);

  const paymentQueries = useQueries({
    queries: listOrders.map((order) => ({
      queryKey: ["cashier", "order-payments", branchId, order.id],
      enabled: Boolean(accessToken && branchId && order.id),
      queryFn: () => getCashierOrderPayments(accessToken as string, branchId as string, order.id),
      retry: 1,
      staleTime: 20_000,
    })),
  });

  const paymentState = useMemo(
    () => mapByOrderId(orderIds, paymentQueries),
    [orderIds, paymentQueries],
  );

  const queue = useMemo<CashierOrderViewModel[]>(
    () =>
      listOrders.map((order) =>
        normalizeCashierOrder({
          order,
          paymentSummary: paymentState.data.get(order.id),
          paymentError: paymentState.errors.get(order.id),
          fallbackBranchName: cashierContext.branchName,
        }),
      ),
    [cashierContext.branchName, listOrders, paymentState.data, paymentState.errors],
  );

  const visibleOrders = useMemo(
    () => searchCashierQueueOrders(filterCashierQueueOrders(queue, activeFilter), search),
    [activeFilter, queue, search],
  );

  useEffect(() => {
    if (!selectedOrderId && visibleOrders.length > 0) {
      setSelectedOrderId(visibleOrders[0].id);
    }
  }, [selectedOrderId, visibleOrders]);

  useEffect(() => {
    if (selectedOrderId && visibleOrders.length > 0 && !visibleOrders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(visibleOrders[0].id);
    }
  }, [selectedOrderId, visibleOrders]);

  const selectedListOrder = queue.find((order) => order.id === selectedOrderId) || null;

  const detailQuery = useQuery({
    queryKey: ["cashier", "order-detail", branchId, selectedOrderId],
    enabled: Boolean(accessToken && branchId && selectedOrderId),
    queryFn: () => getCashierOrder(accessToken as string, branchId as string, selectedOrderId as string),
    retry: 1,
    staleTime: 10_000,
  });

  const selectedPaymentsQuery = useQuery({
    queryKey: ["cashier", "order-payments", branchId, selectedOrderId, "selected"],
    enabled: Boolean(accessToken && branchId && selectedOrderId),
    queryFn: () => getCashierOrderPayments(accessToken as string, branchId as string, selectedOrderId as string),
    retry: 1,
    staleTime: 10_000,
  });

  useEffect(() => {
    const error = detailQuery.error || selectedPaymentsQuery.error;
    if (error instanceof ApiError && error.isAuthError) {
      clearSession();
    }
  }, [clearSession, detailQuery.error, selectedPaymentsQuery.error]);

  const selectedDetailOrder = useMemo(
    () =>
      detailQuery.data
        ? normalizeCashierOrder({
            order: detailQuery.data,
            paymentSummary: selectedPaymentsQuery.data || paymentState.data.get(detailQuery.data.id),
            paymentError: paymentErrorMessage(selectedPaymentsQuery.error) || paymentState.errors.get(detailQuery.data.id),
            fallbackBranchName: cashierContext.branchName,
          })
        : null,
    [
      cashierContext.branchName,
      detailQuery.data,
      paymentState.data,
      paymentState.errors,
      selectedPaymentsQuery.data,
      selectedPaymentsQuery.error,
    ],
  );

  const queueError = ordersQuery.error
    ? errorMessage(ordersQuery.error, "Try again when the cashier API is reachable.")
    : undefined;
  const detailError = detailQuery.error
    ? errorMessage(detailQuery.error, "Could not load order detail.")
    : undefined;
  const selectedPaymentError = selectedPaymentsQuery.error
    ? paymentErrorMessage(selectedPaymentsQuery.error)
    : selectedOrderId
      ? paymentState.errors.get(selectedOrderId)
      : undefined;

  const refreshCheckoutState = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["cashier", "order-payments", branchId] });
    await queryClient.invalidateQueries({ queryKey: ["cashier", "orders", branchId] });
    await Promise.all([
      ordersQuery.refetch(),
      selectedOrderId ? detailQuery.refetch() : Promise.resolve(),
      selectedOrderId ? selectedPaymentsQuery.refetch() : Promise.resolve(),
      readiness.shiftQuery.refetch(),
      readiness.tillQuery.refetch(),
    ]);
  }, [
    branchId,
    detailQuery,
    ordersQuery,
    queryClient,
    readiness.shiftQuery,
    readiness.tillQuery,
    selectedOrderId,
    selectedPaymentsQuery,
  ]);

  return (
    <PageShell
      title="Queue"
      subtitle={`Active payable branch orders for ${cashierContext.branchName}.`}
      actions={
        <div className="flex items-center gap-2">
          <Badge variant="info">Read-only</Badge>
          <Badge variant={readiness.shift.status === "active" ? "success" : "warning"}>{readiness.shift.label}</Badge>
        </div>
      }
    >
      <StatusMessage tone="info" title="Bill-requested gap">
        Bill-requested is audit-derived. Until a dedicated filter exists, Queue shows active payable branch orders.
      </StatusMessage>

      {!branchId ? (
        <StatusMessage tone="warning" title="Branch context unavailable">
          A branch context is required before cashier queue reads can run.
        </StatusMessage>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)_420px] items-start gap-6">
        <div className="min-w-0 space-y-5">
          <CashierQueueToolbar
            activeFilter={activeFilter}
            search={search}
            onFilterChange={setActiveFilter}
            onSearchChange={setSearch}
          />

          {activeFilter === "closed-today" ? (
            <StatusMessage tone="info" title="Closed order review">
              Closed order preview is read-only and exposes receipt and refund entry points only where safe.
            </StatusMessage>
          ) : null}

          {readiness.shift.status === "inactive" ? (
            <StatusMessage tone="warning" title="No active shift">
              No active shift. Payment actions will stay blocked.
            </StatusMessage>
          ) : null}
          {readiness.till.status === "inactive" ? (
            <StatusMessage tone="warning" title="No active till">
              No active till. Cash payments will stay blocked.
            </StatusMessage>
          ) : null}

          <CashierOrderList
            orders={visibleOrders}
            total={ordersQuery.data?.total}
            selectedOrderId={selectedOrderId}
            isLoading={ordersQuery.isLoading}
            isRefreshing={ordersQuery.isFetching && !ordersQuery.isLoading}
            error={queueError}
            search={search}
            onSelect={setSelectedOrderId}
            onRetry={() => void ordersQuery.refetch()}
          />

          {ordersQuery.isSuccess && paymentState.errors.size > 0 ? (
            <StatusMessage tone="warning" title="Some payment summaries did not load">
              Queue cards remain visible, but checkout should retry payment summary before payment workflow starts.
            </StatusMessage>
          ) : null}

          <div className="flex items-start gap-3 rounded-lg bg-surface-muted p-4 text-sm text-text-secondary">
            <Info size={22} weight="bold" className="shrink-0 text-status-info" aria-hidden />
            <p>
              Queue reads only <span className="font-semibold">GET /api/pos/orders</span>, order detail, and order
              payment summary endpoints. NEW, CLOSED, and VOIDED orders are excluded from the default read.
            </p>
          </div>
        </div>

        <CashierCheckoutPreview
          order={selectedListOrder}
          detailOrder={selectedDetailOrder}
          targetOrders={queue}
          readiness={readiness}
          isLoadingDetail={detailQuery.isLoading}
          detailError={detailError}
          isLoadingPaymentSummary={selectedPaymentsQuery.isLoading || (selectedOrderId ? paymentState.loading.has(selectedOrderId) : false)}
          paymentError={selectedPaymentError}
          onClose={() => setSelectedOrderId(null)}
          onRetryDetail={() => void detailQuery.refetch()}
          onRetryPaymentSummary={() => void selectedPaymentsQuery.refetch()}
          onPaymentMutation={refreshCheckoutState}
          onOpenRefund={(nextOrderId) => setRefundOrderId(nextOrderId)}
        />
      </div>

      <CashierRefundPanel
        open={Boolean(refundOrderId)}
        orderId={refundOrderId}
        onClose={() => setRefundOrderId(null)}
        onRefresh={refreshCheckoutState}
      />

      {ordersQuery.isLoading ? (
        <div className="sr-only" aria-live="polite">
          Loading cashier queue.
        </div>
      ) : null}
      {ordersQuery.isError ? (
        <div className="sr-only" aria-live="assertive">
          Cashier queue failed to load.
        </div>
      ) : null}
      {ordersQuery.isSuccess ? (
        <div className="sr-only" aria-live="polite">
          Cashier queue loaded.
        </div>
      ) : null}
    </PageShell>
  );
}
