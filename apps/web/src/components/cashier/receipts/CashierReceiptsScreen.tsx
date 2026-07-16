import { Info, Receipt } from "@phosphor-icons/react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CashierEmptyState } from "@/components/cashier/states";
import { CashierRefundPanel } from "@/components/cashier/refunds";
import { Badge, PageShell, StatusMessage } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { buildCashierIdempotencyKey } from "@/lib/cashier/idempotency";
import type { CashierOrderPaymentsApi } from "@/lib/cashier/order-types";
import { getCashierOrderPayments, listCashierOrders } from "@/lib/cashier/orders";
import {
  filterCashierReceipts,
  mapReceiptApiError,
  normalizeCashierReceipt,
  normalizeReceiptCandidate,
  normalizeReceiptHistory,
  searchCashierReceipts,
} from "@/lib/cashier/receipt-state";
import type {
  CashierReceiptApi,
  CashierReceiptFilterId,
  CashierReceiptReprintInput,
  CashierReceiptSendInput,
  CashierReceiptViewModel,
} from "@/lib/cashier/receipt-types";
import {
  getCashierReceipt,
  getCashierReceiptHistory,
  requestCashierReceiptReprint,
  requestCashierReceiptSend,
} from "@/lib/cashier/receipts";
import { useCashierContext } from "@/lib/cashier/context";

import { CashierReceiptDrawer } from "./CashierReceiptDrawer";
import { CashierReceiptList } from "./CashierReceiptList";
import { CashierReceiptReprintDialog } from "./CashierReceiptReprintDialog";
import { CashierReceiptSendDialog } from "./CashierReceiptSendDialog";
import { CashierReceiptsToolbar } from "./CashierReceiptsToolbar";

type ActionMessage = {
  tone: "success" | "info" | "warning" | "danger";
  title: string;
  body?: string;
};

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message || fallback;
  return error instanceof Error ? error.message : fallback;
}

function selectedReceiptIdFromQuery(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || null;
}

function mapOrderPaymentQueries(
  orderIds: string[],
  queries: Array<{ data?: unknown; error?: unknown }>,
) {
  const data = new Map<string, CashierOrderPaymentsApi>();
  const errors = new Map<string, string>();

  orderIds.forEach((orderId, index) => {
    const query = queries[index];
    if (!query) return;
    if (query.data) data.set(orderId, query.data as CashierOrderPaymentsApi);
    if (query.error) errors.set(orderId, errorMessage(query.error, "Payment summary unavailable."));
  });

  return { data, errors };
}

function mapReceiptQueries(orderIds: string[], queries: Array<{ data?: unknown; error?: unknown }>) {
  const data = new Map<string, CashierReceiptApi>();
  const errors = new Map<string, string>();

  orderIds.forEach((orderId, index) => {
    const query = queries[index];
    if (!query) return;
    if (query.data) data.set(orderId, query.data as CashierReceiptApi);
    if (query.error) errors.set(orderId, errorMessage(query.error, "Receipt detail unavailable."));
  });

  return { data, errors };
}

export function CashierReceiptsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, branchId, clearSession } = useAuth();
  const cashierContext = useCashierContext();
  const [activeFilter, setActiveFilter] = useState<CashierReceiptFilterId>("today");
  const [search, setSearch] = useState("");
  const [actionMessage, setActionMessage] = useState<ActionMessage | null>(null);
  const [reprintOpen, setReprintOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [reprintError, setReprintError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isReprinting, setIsReprinting] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const selectedReceiptId = selectedReceiptIdFromQuery(router.query.receiptId);
  const canQuery = Boolean(accessToken && branchId);

  const ordersQuery = useQuery({
    queryKey: ["cashier", "receipt-candidate-orders", branchId],
    enabled: canQuery,
    queryFn: () =>
      listCashierOrders(accessToken as string, branchId as string, {
        status: "CLOSED",
        pageSize: 20,
      }),
    retry: 1,
    staleTime: 20_000,
  });

  useEffect(() => {
    if (ordersQuery.error instanceof ApiError && ordersQuery.error.isAuthError) {
      clearSession();
    }
  }, [clearSession, ordersQuery.error]);

  const candidateOrders = useMemo(() => ordersQuery.data?.data || [], [ordersQuery.data?.data]);
  const candidateIds = useMemo(() => candidateOrders.map((order) => order.id), [candidateOrders]);

  const paymentQueries = useQueries({
    queries: candidateOrders.map((order) => ({
      queryKey: ["cashier", "order-payments", branchId, order.id, "receipt-list"],
      enabled: Boolean(accessToken && branchId && order.id),
      queryFn: () => getCashierOrderPayments(accessToken as string, branchId as string, order.id),
      retry: 0,
      staleTime: 30_000,
    })),
  });

  const receiptQueries = useQueries({
    queries: candidateOrders.map((order) => ({
      queryKey: ["cashier", "receipt", branchId, order.id, "candidate"],
      enabled: Boolean(accessToken && branchId && order.id),
      queryFn: () => getCashierReceipt(accessToken as string, branchId as string, order.id),
      retry: 0,
      staleTime: 30_000,
    })),
  });

  const paymentsByOrder = useMemo(
    () => mapOrderPaymentQueries(candidateIds, paymentQueries),
    [candidateIds, paymentQueries],
  );
  const receiptsByOrder = useMemo(
    () => mapReceiptQueries(candidateIds, receiptQueries),
    [candidateIds, receiptQueries],
  );

  const candidateReceipts = useMemo<CashierReceiptViewModel[]>(
    () =>
      candidateOrders.map((order) =>
        normalizeReceiptCandidate({
          order,
          paymentSummary: paymentsByOrder.data.get(order.id),
          receipt: receiptsByOrder.data.get(order.id),
        }),
      ),
    [candidateOrders, paymentsByOrder.data, receiptsByOrder.data],
  );

  const visibleReceipts = useMemo(
    () => searchCashierReceipts(filterCashierReceipts(candidateReceipts, activeFilter), search),
    [activeFilter, candidateReceipts, search],
  );

  const selectedReceiptQuery = useQuery({
    queryKey: ["cashier", "receipt", branchId, selectedReceiptId],
    enabled: Boolean(accessToken && branchId && selectedReceiptId),
    queryFn: () => getCashierReceipt(accessToken as string, branchId as string, selectedReceiptId as string),
    retry: 1,
    staleTime: 10_000,
  });

  const historyQuery = useQuery({
    queryKey: ["cashier", "receipt-history", branchId, selectedReceiptId],
    enabled: Boolean(accessToken && branchId && selectedReceiptId),
    queryFn: () => getCashierReceiptHistory(accessToken as string, branchId as string, selectedReceiptId as string),
    retry: 1,
    staleTime: 10_000,
  });

  useEffect(() => {
    const error = selectedReceiptQuery.error || historyQuery.error;
    if (error instanceof ApiError && error.isAuthError) {
      clearSession();
    }
  }, [clearSession, historyQuery.error, selectedReceiptQuery.error]);

  const selectedReceipt = useMemo(
    () => (selectedReceiptQuery.data ? normalizeCashierReceipt(selectedReceiptQuery.data) : null),
    [selectedReceiptQuery.data],
  );

  const history = useMemo(() => normalizeReceiptHistory(historyQuery.data), [historyQuery.data]);

  const setSelectedReceipt = useCallback(
    (receiptId: string | null) => {
      setActionMessage(null);
      setReprintError(null);
      setSendError(null);
      const nextQuery = { ...router.query };
      if (receiptId) nextQuery.receiptId = receiptId;
      else delete nextQuery.receiptId;
      if (!receiptId) setRefundOpen(false);
      void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
    },
    [router],
  );

  async function refreshReceiptState(receiptId: string) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["cashier", "receipt", branchId, receiptId] }),
      queryClient.invalidateQueries({ queryKey: ["cashier", "receipt-history", branchId, receiptId] }),
      queryClient.invalidateQueries({ queryKey: ["cashier", "receipt-candidate-orders", branchId] }),
      selectedReceiptQuery.refetch(),
      historyQuery.refetch(),
      ordersQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: ["cashier", "order-payments", branchId, receiptId] }),
    ]);
  }

  async function handleReprint(input: CashierReceiptReprintInput) {
    if (!accessToken || !branchId || !selectedReceipt) return;
    setIsReprinting(true);
    setReprintError(null);
    setActionMessage(null);

    try {
      const result = await requestCashierReceiptReprint({
        token: accessToken,
        branchId,
        receiptId: selectedReceipt.id,
        idempotencyKey: buildCashierIdempotencyKey({
          operation: "receipt-reprint",
          orderId: selectedReceipt.id,
        }),
        input,
      });
      setReprintOpen(false);
      setActionMessage({
        tone: "success",
        title: "Receipt reprint request recorded.",
        body: `Metadata only. Copies: ${result.copies ?? input.copies ?? 1}.`,
      });
      await refreshReceiptState(selectedReceipt.id);
    } catch (error) {
      setReprintError(mapReceiptApiError(error, "Could not record receipt reprint request."));
    } finally {
      setIsReprinting(false);
    }
  }

  async function handleSend(input: CashierReceiptSendInput) {
    if (!accessToken || !branchId || !selectedReceipt) return;
    setIsSending(true);
    setSendError(null);
    setActionMessage(null);

    try {
      const result = await requestCashierReceiptSend({
        token: accessToken,
        branchId,
        receiptId: selectedReceipt.id,
        idempotencyKey: buildCashierIdempotencyKey({
          operation: "receipt-send",
          orderId: selectedReceipt.id,
          method: input.channel,
        }),
        input,
      });
      setSendOpen(false);
      setActionMessage({
        tone: "warning",
        title: "Receipt send request recorded as pending.",
        body: `Status: ${result.status || "PENDING"}. Supported: ${result.supported === true ? "true" : "false"}.`,
      });
      await refreshReceiptState(selectedReceipt.id);
    } catch (error) {
      setSendError(mapReceiptApiError(error, "Could not record receipt send request."));
    } finally {
      setIsSending(false);
    }
  }

  const listError = ordersQuery.error
    ? errorMessage(ordersQuery.error, "Could not load closed-order receipts.")
    : undefined;
  const selectedError = selectedReceiptQuery.error
    ? errorMessage(selectedReceiptQuery.error, "Could not load receipt detail.")
    : undefined;
  const historyError = historyQuery.error
    ? errorMessage(historyQuery.error, "Could not load receipt history.")
    : undefined;
  const someReceiptReadsFailed = receiptsByOrder.errors.size > 0;

  return (
    <PageShell
      title="Receipts"
      subtitle={`View closed-order receipts, metadata reprints, and pending digital send requests for ${cashierContext.branchName}.`}
      actions={
        <div className="flex items-center gap-2">
          <Badge variant="warning">Metadata print</Badge>
          <Badge variant="warning">Send pending</Badge>
        </div>
      }
    >
      <div className="grid grid-cols-[minmax(0,1fr)_420px] items-start gap-6">
        <div className="min-w-0 space-y-5">
          <CashierReceiptsToolbar
            activeFilter={activeFilter}
            search={search}
            onFilterChange={setActiveFilter}
            onSearchChange={setSearch}
          />

          {!branchId ? (
            <StatusMessage tone="warning" title="Branch context unavailable">
              A branch context is required before receipt reads can run.
            </StatusMessage>
          ) : null}

          {someReceiptReadsFailed ? (
            <StatusMessage tone="warning" title="Some receipt details did not load">
              Candidate rows stay visible from closed orders, but open a receipt to retry the full receipt read.
            </StatusMessage>
          ) : null}

          <CashierReceiptList
            receipts={visibleReceipts}
            selectedReceiptId={selectedReceiptId}
            isLoading={ordersQuery.isLoading}
            isRefreshing={ordersQuery.isFetching && !ordersQuery.isLoading}
            error={listError}
            search={search}
            onSelect={setSelectedReceipt}
            onRetry={() => void ordersQuery.refetch()}
          />

          <div className="flex items-start gap-3 rounded-lg bg-surface-muted p-4 text-sm text-text-secondary">
            <Info size={22} weight="bold" className="shrink-0 text-status-info" aria-hidden />
            <p>
              Receipt ID equals order ID. This screen builds candidates from closed cashier-safe orders and
              uses the receipt read and history endpoints for the drawer.
            </p>
          </div>
        </div>

        <aside className="sticky top-40 rounded-lg bg-surface p-5 shadow-subtle" aria-labelledby="receipt-side-title">
          {selectedReceiptId ? (
            <div>
              <p id="receipt-side-title" className="text-sm font-bold text-text-primary">
                Receipt selected
              </p>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                The drawer is open for receipt {selectedReceiptId}. Close it to return to the list.
              </p>
            </div>
          ) : (
            <CashierEmptyState
              icon={<Receipt size={26} weight="duotone" aria-hidden />}
              title="Select a receipt"
              description="Receipt detail, history, reprint metadata, and pending send controls open in the drawer."
            />
          )}
        </aside>
      </div>

      <CashierReceiptDrawer
        open={Boolean(selectedReceiptId)}
        receipt={selectedReceipt}
        history={history}
        isLoadingReceipt={selectedReceiptQuery.isLoading}
        isLoadingHistory={historyQuery.isLoading}
        receiptError={selectedError}
        historyError={historyError}
        actionMessage={actionMessage}
        isReprinting={isReprinting}
        isSending={isSending}
        isRefunding={refundOpen}
        onClose={() => setSelectedReceipt(null)}
        onOpenReprint={() => {
          setReprintError(null);
          setReprintOpen(true);
        }}
        onOpenSend={() => {
          setSendError(null);
          setSendOpen(true);
        }}
        onOpenRefund={() => {
          setActionMessage(null);
          setRefundOpen(true);
        }}
      />

      <CashierRefundPanel
        open={refundOpen && Boolean(selectedReceiptId)}
        orderId={selectedReceiptId}
        receipt={selectedReceipt}
        onClose={() => setRefundOpen(false)}
        onRefresh={() => (selectedReceiptId ? refreshReceiptState(selectedReceiptId) : undefined)}
        onCreated={(message) => {
          setActionMessage(message);
        }}
      />

      {reprintOpen && selectedReceipt ? (
        <CashierReceiptReprintDialog
          receipt={selectedReceipt}
          isSubmitting={isReprinting}
          error={reprintError}
          onCancel={() => setReprintOpen(false)}
          onSubmit={(input) => void handleReprint(input)}
        />
      ) : null}

      {sendOpen && selectedReceipt ? (
        <CashierReceiptSendDialog
          receipt={selectedReceipt}
          isSubmitting={isSending}
          error={sendError}
          onCancel={() => setSendOpen(false)}
          onSubmit={(input) => void handleSend(input)}
        />
      ) : null}

      {ordersQuery.isLoading ? (
        <div className="sr-only" aria-live="polite">
          Loading receipts.
        </div>
      ) : null}
      {ordersQuery.isError ? (
        <div className="sr-only" aria-live="assertive">
          Receipt list failed to load.
        </div>
      ) : null}
    </PageShell>
  );
}
