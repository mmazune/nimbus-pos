import { ArrowClockwise, ListChecks, WarningCircle } from "@phosphor-icons/react";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import { Button, ErrorState, StatusMessage } from "@/components/ui";
import {
  SupervisorOrderDetailPanel,
  SupervisorOrderList,
  SupervisorOrdersSummary,
  SupervisorOrdersToolbar,
} from "@/components/supervisor/orders";
import { SupervisorShell } from "@/components/supervisor/shell";
import { SupervisorCaveatBanner } from "@/components/supervisor/states";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useSupervisorContext, useSupervisorReadiness } from "@/lib/supervisor/context";
import {
  fetchSupervisorOrderDetail,
  fetchSupervisorOrderDiscounts,
  fetchSupervisorOrderPayments,
  fetchSupervisorOrderRefunds,
  fetchSupervisorOrders,
  getPaymentState,
  getSupervisorOrderExceptionTags,
  getSupervisorOrderLabel,
  getSupervisorTableLabel,
  orderMatchesSearch,
  supervisorActiveOrderStatuses,
  toMoneyNumber,
  type SupervisorOrderListItem,
  type SupervisorOrderPayments,
  type SupervisorOrdersFilter,
  type SupervisorOrdersSort,
} from "@/lib/supervisor/orders";
import { supervisorCaveats } from "@/lib/supervisor/state";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

function getErrorCopy(error: unknown) {
  if (error instanceof ApiError) {
    if (error.isForbidden) {
      return {
        title: "Orders access blocked",
        description: "This supervisor account does not have permission to read branch orders.",
      };
    }

    if (error.isAuthError) {
      return {
        title: "Session expired",
        description: "Please log in again to continue.",
      };
    }

    return {
      title: "Could Not Load Orders",
      description: error.message,
    };
  }

  return {
    title: "Could Not Load Orders",
    description: error instanceof Error ? error.message : "Try again when the connection is stable.",
  };
}

function parseDate(value: string | null | undefined) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function matchesFilter(
  order: SupervisorOrderListItem,
  filter: SupervisorOrdersFilter,
  payments?: SupervisorOrderPayments,
) {
  const status = order.status;
  const paymentState = getPaymentState(payments);

  if (filter === "in-progress") {
    return status === "NEW" || status === "SENT" || status === "IN_KITCHEN";
  }
  if (filter === "ready-served") {
    return status === "READY" || status === "SERVED";
  }
  if (filter === "payable") {
    return status === "SENT" || status === "IN_KITCHEN" || status === "READY" || status === "SERVED";
  }
  if (filter === "partial-paid") {
    return paymentState === "partially-paid";
  }
  if (filter === "exception-watch") {
    return getSupervisorOrderExceptionTags({ order, payments }).length > 0;
  }
  return true;
}

function sortOrders(
  orders: SupervisorOrderListItem[],
  sort: SupervisorOrdersSort,
  paymentsByOrderId: Map<string, SupervisorOrderPayments>,
) {
  return [...orders].sort((a, b) => {
    if (sort === "oldest") return parseDate(a.createdAt) - parseDate(b.createdAt);
    if (sort === "highest-total") return toMoneyNumber(b.total) - toMoneyNumber(a.total);
    if (sort === "status") return String(a.status).localeCompare(String(b.status));
    if (sort === "table") return getSupervisorTableLabel(a).localeCompare(getSupervisorTableLabel(b));

    const aPayment = paymentsByOrderId.get(a.id);
    const bPayment = paymentsByOrderId.get(b.id);
    const aException = getSupervisorOrderExceptionTags({ order: a, payments: aPayment }).length;
    const bException = getSupervisorOrderExceptionTags({ order: b, payments: bPayment }).length;
    if (aException !== bException) return bException - aException;
    return parseDate(b.createdAt) - parseDate(a.createdAt);
  });
}

function selectedTableIdFromQuery(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

export default function SupervisorOrdersPage() {
  const router = useRouter();
  const { accessToken, branchId, clearSession, isAuthenticated, isSupervisor } = useAuth();
  const context = useSupervisorContext();
  const readiness = useSupervisorReadiness();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SupervisorOrdersFilter>("all-active");
  const [sort, setSort] = useState<SupervisorOrdersSort>("newest");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const tableId = selectedTableIdFromQuery(router.query.tableId);
  const canQuery = Boolean(accessToken && branchId && isAuthenticated && isSupervisor);

  const ordersQuery = useQuery({
    queryKey: ["supervisor", "orders", branchId, tableId],
    enabled: canQuery,
    queryFn: () =>
      fetchSupervisorOrders(accessToken as string, branchId as string, {
        excludeStatus: ["CLOSED", "VOIDED"],
        page: 1,
        pageSize: 100,
        tableId: tableId || undefined,
      }),
    retry: 1,
    staleTime: 10_000,
  });

  const orders = useMemo(() => ordersQuery.data?.data || [], [ordersQuery.data]);

  const listPaymentQueries = useQueries({
    queries: orders.map((order) => ({
      queryKey: ["supervisor", "order-payments", branchId, order.id],
      enabled: canQuery,
      queryFn: () => fetchSupervisorOrderPayments(accessToken as string, branchId as string, order.id),
      retry: 1,
      staleTime: 10_000,
    })),
  });

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) || null,
    [orders, selectedOrderId],
  );

  const orderDetailQuery = useQuery({
    queryKey: ["supervisor", "order-detail", branchId, selectedOrderId],
    enabled: canQuery && Boolean(selectedOrderId),
    queryFn: () =>
      fetchSupervisorOrderDetail(accessToken as string, branchId as string, selectedOrderId as string),
    retry: 1,
    staleTime: 8_000,
  });

  const selectedPaymentsQuery = useQuery({
    queryKey: ["supervisor", "selected-order-payments", branchId, selectedOrderId],
    enabled: canQuery && Boolean(selectedOrderId),
    queryFn: () =>
      fetchSupervisorOrderPayments(accessToken as string, branchId as string, selectedOrderId as string),
    retry: 1,
    staleTime: 5_000,
  });

  const selectedRefundsQuery = useQuery({
    queryKey: ["supervisor", "order-refunds", branchId, selectedOrderId],
    enabled: canQuery && Boolean(selectedOrderId),
    queryFn: () =>
      fetchSupervisorOrderRefunds(accessToken as string, branchId as string, selectedOrderId as string),
    retry: 1,
    staleTime: 8_000,
  });

  const selectedDiscountsQuery = useQuery({
    queryKey: ["supervisor", "order-discounts", branchId, selectedOrderId],
    enabled: canQuery && Boolean(selectedOrderId),
    queryFn: () =>
      fetchSupervisorOrderDiscounts(accessToken as string, branchId as string, selectedOrderId as string),
    retry: 1,
    staleTime: 8_000,
  });

  useEffect(() => {
    const errors = [
      ordersQuery.error,
      orderDetailQuery.error,
      selectedPaymentsQuery.error,
      selectedRefundsQuery.error,
      selectedDiscountsQuery.error,
      ...listPaymentQueries.map((result) => result.error),
    ];

    if (errors.some((error) => error instanceof ApiError && error.isAuthError)) {
      clearSession();
    }
  }, [
    clearSession,
    listPaymentQueries,
    orderDetailQuery.error,
    ordersQuery.error,
    selectedDiscountsQuery.error,
    selectedPaymentsQuery.error,
    selectedRefundsQuery.error,
  ]);

  useEffect(() => {
    if (selectedOrderId && !orders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(null);
    }
  }, [orders, selectedOrderId]);

  const paymentsByOrderId = useMemo(() => {
    const map = new Map<string, SupervisorOrderPayments>();
    orders.forEach((order, index) => {
      const data = listPaymentQueries[index]?.data;
      if (data) map.set(order.id, data);
    });
    return map;
  }, [listPaymentQueries, orders]);

  const filteredOrders = useMemo(() => {
    const next = orders.filter((order) => {
      const payments = paymentsByOrderId.get(order.id);
      return matchesFilter(order, filter, payments)
        && orderMatchesSearch(order, query, getPaymentState(payments));
    });

    return sortOrders(next, sort, paymentsByOrderId);
  }, [filter, orders, paymentsByOrderId, query, sort]);

  const summary = useMemo(() => {
    let inProgressCount = 0;
    let payableCount = 0;
    let partiallyPaidCount = 0;
    let exceptionCount = 0;

    orders.forEach((order) => {
      const payments = paymentsByOrderId.get(order.id);
      const paymentState = getPaymentState(payments);
      if (order.status === "NEW" || order.status === "SENT" || order.status === "IN_KITCHEN") {
        inProgressCount += 1;
      }
      if (order.status === "SENT" || order.status === "IN_KITCHEN" || order.status === "READY" || order.status === "SERVED") {
        payableCount += 1;
      }
      if (paymentState === "partially-paid") partiallyPaidCount += 1;
      if (getSupervisorOrderExceptionTags({ order, payments }).length > 0) exceptionCount += 1;
    });

    return {
      activeCount: orders.filter((order) =>
        supervisorActiveOrderStatuses.includes(order.status as (typeof supervisorActiveOrderStatuses)[number]),
      ).length,
      exceptionCount,
      inProgressCount,
      partiallyPaidCount,
      payableCount,
    };
  }, [orders, paymentsByOrderId]);

  const tableFilterLabel = useMemo(() => {
    if (!tableId) return null;
    const tableOrder = orders.find((order) => order.tableId === tableId || order.table?.id === tableId);
    return tableOrder ? getSupervisorTableLabel(tableOrder) : tableId;
  }, [orders, tableId]);

  function refreshOrders() {
    void ordersQuery.refetch();
    listPaymentQueries.forEach((result) => void result.refetch());
    if (selectedOrderId) {
      void orderDetailQuery.refetch();
      void selectedPaymentsQuery.refetch();
      void selectedRefundsQuery.refetch();
      void selectedDiscountsQuery.refetch();
    }
  }

  function clearTableFilter() {
    const nextQuery = { ...router.query };
    delete nextQuery.tableId;
    void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
  }

  const blockingError = ordersQuery.error;
  const errorCopy = blockingError ? getErrorCopy(blockingError) : null;
  const paymentsLoading = listPaymentQueries.some((result) => result.isLoading || result.isFetching);

  return (
    <SupervisorShell>
      <section className="space-y-6" aria-labelledby="supervisor-orders-title">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-normal text-text-muted">
              Service exceptions
            </p>
            <h1
              id="supervisor-orders-title"
              className="mt-2 text-balance text-3xl font-bold tracking-normal text-text-primary"
            >
              Order Supervision
            </h1>
            <p className="mt-2 max-w-4xl text-base leading-7 text-text-secondary">
              Monitor active branch orders, payment state, table context, and exception signals without entering waiter or cashier workflows.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <StatusPill label={context.branchName} tone="info" />
              <StatusPill
                label={readiness.shift.label}
                tone={readiness.shift.tone === "success" ? "success" : readiness.shift.tone === "warning" ? "warning" : "neutral"}
              />
              <StatusPill label={`${orders.length} active rows`} tone={orders.length > 0 ? "success" : "neutral"} />
            </div>
          </div>
          <Button
            className="shrink-0"
            variant="secondary"
            size="pos"
            leadingIcon={<ArrowClockwise size={22} weight="bold" aria-hidden />}
            onClick={refreshOrders}
            disabled={ordersQuery.isFetching || paymentsLoading}
          >
            Refresh orders
          </Button>
        </div>

        <StatusMessage tone="info" title="Read-only order oversight">
          Split, merge, transfer, void, refund, close, discount approval, cashier settlement, and KDS controls remain disabled.
        </StatusMessage>

        <SupervisorOrdersSummary {...summary} paymentsLoading={paymentsLoading} />

        {errorCopy ? (
          <ErrorState title={errorCopy.title} description={errorCopy.description} />
        ) : (
          <>
            <SupervisorOrdersToolbar
              query={query}
              filter={filter}
              sort={sort}
              tableFilterLabel={tableFilterLabel}
              onQueryChange={setQuery}
              onFilterChange={setFilter}
              onSortChange={setSort}
              onClearTableFilter={clearTableFilter}
            />

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_460px] xl:items-start">
              <div className="space-y-4">
                {listPaymentQueries.some((result) => result.error instanceof ApiError && result.error.isForbidden) ? (
                  <StatusMessage tone="warning" title="Payment summaries unavailable">
                    Orders loaded, but this session cannot read payment summaries for at least one order.
                  </StatusMessage>
                ) : null}

                <SupervisorOrderList
                  orders={filteredOrders}
                  paymentsByOrderId={paymentsByOrderId}
                  selectedOrderId={selectedOrderId}
                  isLoading={ordersQuery.isLoading}
                  onSelectOrder={(order) => setSelectedOrderId(order.id)}
                />
              </div>

              <div className="space-y-4 xl:sticky xl:top-36">
                <SupervisorOrderDetailPanel
                  order={selectedOrder}
                  detail={orderDetailQuery.data}
                  payments={selectedPaymentsQuery.data || (selectedOrderId ? paymentsByOrderId.get(selectedOrderId) : null)}
                  refunds={selectedRefundsQuery.data}
                  discounts={selectedDiscountsQuery.data}
                  isLoading={orderDetailQuery.isLoading}
                  paymentsError={selectedPaymentsQuery.error instanceof Error ? selectedPaymentsQuery.error.message : null}
                  refundsError={selectedRefundsQuery.error instanceof Error ? selectedRefundsQuery.error.message : null}
                  discountsError={selectedDiscountsQuery.error instanceof Error ? selectedDiscountsQuery.error.message : null}
                  onClose={() => setSelectedOrderId(null)}
                />
                <SupervisorCaveatBanner
                  title={supervisorCaveats.receiptsDevices}
                  description="Receipts, devices, terminals, accounting, billing, franchise, and developer surfaces stay outside Supervisor Orders."
                  icon="excluded"
                  tone="neutral"
                />
              </div>
            </div>
          </>
        )}

        {!ordersQuery.isLoading && !errorCopy && orders.length === 0 ? (
          <div className="flex items-center gap-2 text-sm font-medium text-text-muted">
            <WarningCircle size={18} weight="bold" aria-hidden />
            <span>No active branch orders were returned for this scope.</span>
          </div>
        ) : null}
      </section>
    </SupervisorShell>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "success" | "warning" | "info";
}) {
  const classes = {
    neutral: "bg-status-neutral-surface text-status-neutral",
    success: "bg-status-success-surface text-status-success",
    warning: "bg-status-warning-surface text-status-warning",
    info: "bg-status-info-surface text-status-info",
  };

  return (
    <span className={`inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-semibold ${classes[tone]}`}>
      {label}
    </span>
  );
}
