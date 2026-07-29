import { ArrowLeft, X } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { OperationalTableStatusBadge } from "@/components/floor/OperationalTableStatusBadge";
import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { useToast } from "@/components/providers/ToastProvider";
import { Badge, Button, Card, Skeleton, StatusMessage } from "@/components/ui";
import { ApiError, shouldRetryApiRequest } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  fetchSupervisorTableDetail,
  supervisorTableStatuses,
  updateSupervisorTableStatus,
  type SupervisorFloorData,
  type SupervisorTable,
  type SupervisorTableStatus,
} from "@/lib/supervisor/floor";
import type { SupervisorFloorTableViewModel } from "@/lib/supervisor/floor-model";
import { getSupervisorOrderActionAvailability } from "@/lib/supervisor/order-actions";
import {
  fetchSupervisorOrderDetail,
  fetchSupervisorOrderDiscounts,
  fetchSupervisorOrderPayments,
  formatAge,
  formatSupervisorDateTime,
  formatSupervisorMoney,
  formatSupervisorShortTime,
  getPaymentState,
  getPaymentStateLabel,
  getPaymentStateTone,
  getSupervisorOrderStatusLabel,
  getSupervisorUserName,
  markSupervisorOrderServed,
  requestSupervisorOrderBill,
  type SupervisorDiscount,
  type SupervisorOrderDetail,
  type SupervisorRequestBillResult,
} from "@/lib/supervisor/orders";
import { fetchSupervisorReservationDetail } from "@/lib/supervisor/reservations";

import { SupervisorMergeOrderDialog } from "./SupervisorMergeOrderDialog";
import { SupervisorMoveItemsDialog } from "./SupervisorMoveItemsDialog";
import { SupervisorSplitBillDialog } from "./SupervisorSplitBillDialog";
import { SupervisorApproveDiscountDialog } from "./SupervisorApproveDiscountDialog";
import { SupervisorComplimentaryDialog } from "./SupervisorComplimentaryDialog";
import { SupervisorDiscountRequestDialog } from "./SupervisorDiscountRequestDialog";
import { SupervisorRejectDiscountDialog } from "./SupervisorRejectDiscountDialog";
import { SupervisorSplitItemsDialog } from "./SupervisorSplitItemsDialog";
import { SupervisorTransferTableDialog } from "./SupervisorTransferTableDialog";
import { SupervisorVoidOrderDialog } from "./SupervisorVoidOrderDialog";

type SupervisorTableControlWorkspaceProps = {
  table: SupervisorFloorTableViewModel | null;
  requestedOrderId?: string;
  canUpdateStatus: boolean;
  permissions: readonly string[];
  onClose: () => void;
  onNavigateToOrder?: (params: { orderId: string; tableId?: string | null }) => void;
};

function readMetadataString(metadata: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!metadata) return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function statusLabel(status: SupervisorTableStatus) {
  return status === "CLEANING" ? "Cleaning / reset" : status.charAt(0) + status.slice(1).toLowerCase();
}

function formatReservationDateTime(value: string | null | undefined) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border-subtle py-3 last:border-0">
      <dt className="font-medium text-text-muted">{label}</dt>
      <dd className="max-w-[65%] text-right font-semibold text-text-primary">{value}</dd>
    </div>
  );
}

function discountStatusTone(status: string | null | undefined): "success" | "warning" | "danger" | "neutral" {
  if (status === "APPROVED") return "success";
  if (status === "PENDING") return "warning";
  if (status === "REJECTED") return "danger";
  return "neutral";
}

type DiscountRowReview = {
  /** Reviewer holds pos:discount:approve (controls are shown at all). */
  visible: boolean;
  canApprove: boolean;
  canReject: boolean;
  reason: string | null;
  disabled: boolean;
  onApprove: () => void;
  onReject: () => void;
};

function SupervisorDiscountRow({
  discount,
  review,
}: {
  discount: SupervisorDiscount;
  review?: DiscountRowReview;
}) {
  const valueLabel =
    discount.type === "PERCENTAGE"
      ? `${Number(discount.value ?? 0)}%`
      : formatSupervisorMoney(discount.value);
  const reviewer = discount.approvedBy || discount.rejectedBy;
  const isPending = discount.status === "PENDING";
  const showReview = Boolean(review?.visible && isPending);
  return (
    <div className="grid gap-1 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-text-primary">
          {discount.type === "PERCENTAGE" ? "Percentage" : "Fixed"} • {valueLabel}
        </span>
        <Badge variant={discountStatusTone(discount.status)}>
          {getSupervisorOrderStatusLabel(discount.status)}
        </Badge>
      </div>
      {discount.reason ? <p className="text-sm text-text-secondary">{discount.reason}</p> : null}
      <p className="text-sm text-text-muted">
        Requested by {getSupervisorUserName(discount.createdBy)}
        {discount.createdAt ? ` • ${formatSupervisorDateTime(discount.createdAt)}` : ""}
        {reviewer ? ` • reviewed by ${getSupervisorUserName(reviewer)}` : ""}
      </p>
      {discount.status === "REJECTED" && discount.rejectionReason ? (
        <p className="text-sm text-text-muted">Rejection reason: {discount.rejectionReason}</p>
      ) : null}
      {showReview && review ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            size="compact"
            variant="secondary"
            disabled={!review.canApprove || review.disabled}
            onClick={review.onApprove}
          >
            Approve
          </Button>
          <Button
            size="compact"
            variant="danger"
            disabled={!review.canReject || review.disabled}
            onClick={review.onReject}
          >
            Reject
          </Button>
          {review.reason && (!review.canApprove || !review.canReject) ? (
            <p className="text-sm text-text-muted">{review.reason}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function WorkspaceHeader({
  onClose,
  table,
}: {
  onClose: () => void;
  table: SupervisorFloorTableViewModel | null;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border-subtle pb-5">
      <div className="min-w-0">
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-semibold text-text-secondary hover:bg-surface-muted hover:text-text-primary focus-visible:shadow-focus"
          onClick={onClose}
        >
          <ArrowLeft size={18} weight="bold" aria-hidden />
          Back to Floor
        </button>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h2 className="break-words text-2xl font-bold leading-7 text-text-primary">
            {table?.label || "Order context"}
          </h2>
          {table ? <OperationalTableStatusBadge status={table.status} /> : <Badge variant="neutral">No table</Badge>}
        </div>
        <p className="mt-2 text-sm font-semibold text-text-secondary">
          {table?.assignedStaffName || "Assigned waiter unavailable"}
        </p>
      </div>
      <button
        type="button"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surface-muted text-text-secondary hover:bg-surface hover:text-text-primary focus-visible:shadow-focus"
        aria-label="Close Supervisor table workspace"
        onClick={onClose}
      >
        <X size={20} weight="bold" aria-hidden />
      </button>
    </div>
  );
}

function WorkspaceQueryFailure({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const title = error instanceof ApiError && error.isForbidden
    ? "Order context is not available"
    : error instanceof ApiError && error.status === 404
      ? "Order context was not found"
      : "Could not load workspace detail";
  const description = error instanceof ApiError && error.isForbidden
    ? "This session cannot inspect the requested order. Return to Floor or choose another table."
    : error instanceof ApiError && error.status === 404
      ? "The preserved order reference does not match an accessible order."
      : error instanceof Error ? error.message : "Retry when the connection is stable.";

  return (
    <Card className="bg-status-danger-surface" role="alert">
      <h3 className="text-lg font-bold text-text-primary">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
      <Button className="mt-4" variant="secondary" onClick={onRetry}>Retry</Button>
    </Card>
  );
}

export function SupervisorTableControlWorkspace({
  canUpdateStatus,
  onClose,
  onNavigateToOrder,
  permissions,
  requestedOrderId,
  table,
}: SupervisorTableControlWorkspaceProps) {
  const { accessToken, branchId, user } = useAuth();
  const currentUserId = user?.id ?? null;
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [pendingStatus, setPendingStatus] = useState<SupervisorTableStatus | "">("");
  const [confirmingStatus, setConfirmingStatus] = useState(false);
  const [billAck, setBillAck] = useState<SupervisorRequestBillResult | null>(null);
  const [markServedOpen, setMarkServedOpen] = useState(false);
  const [markServedReason, setMarkServedReason] = useState("");
  const [activeAction, setActiveAction] = useState<
    | "split-bill"
    | "split-items"
    | "move-items"
    | "merge"
    | "transfer-table"
    | "void"
    | "request-discount"
    | "approve-discount"
    | "reject-discount"
    | "complimentary"
    | null
  >(null);
  const [reviewDiscount, setReviewDiscount] = useState<SupervisorDiscount | null>(null);
  const orderId = requestedOrderId || table?.activeOrderId || null;

  const tableQuery = useQuery({
    queryKey: ["supervisor", "table-detail", branchId, table?.id],
    enabled: Boolean(accessToken && branchId && table?.id),
    queryFn: () => fetchSupervisorTableDetail(accessToken as string, branchId as string, table?.id as string),
    placeholderData: table?.raw,
    retry: shouldRetryApiRequest,
    staleTime: 10_000,
  });

  const orderQuery = useQuery({
    queryKey: ["supervisor", "order-detail", branchId, orderId],
    enabled: Boolean(accessToken && branchId && orderId),
    queryFn: () => fetchSupervisorOrderDetail(accessToken as string, branchId as string, orderId as string),
    placeholderData: table?.activeOrder as SupervisorOrderDetail | undefined,
    retry: shouldRetryApiRequest,
    staleTime: 8_000,
  });

  const paymentsQuery = useQuery({
    queryKey: ["supervisor", "order-payments", branchId, orderId],
    enabled: Boolean(accessToken && branchId && orderId && !orderQuery.isError),
    queryFn: () => fetchSupervisorOrderPayments(accessToken as string, branchId as string, orderId as string),
    retry: shouldRetryApiRequest,
    staleTime: 8_000,
  });

  const discountsQuery = useQuery({
    queryKey: ["supervisor", "order-discounts", branchId, orderId],
    enabled: Boolean(accessToken && branchId && orderId && !orderQuery.isError),
    queryFn: () => fetchSupervisorOrderDiscounts(accessToken as string, branchId as string, orderId as string),
    retry: shouldRetryApiRequest,
    staleTime: 8_000,
  });

  const reservationId = table?.reservationId || null;
  const reservationQuery = useQuery({
    queryKey: ["supervisor", "reservation-detail", branchId, reservationId],
    enabled: Boolean(accessToken && branchId && reservationId),
    queryFn: () => fetchSupervisorReservationDetail(accessToken as string, branchId as string, reservationId as string),
    placeholderData: table?.reservation,
    retry: shouldRetryApiRequest,
    staleTime: 10_000,
  });

  const statusMutation = useMutation({
    mutationFn: (status: SupervisorTableStatus) => updateSupervisorTableStatus({
      token: accessToken as string,
      branchId: branchId as string,
      tableId: table?.id as string,
      status,
    }),
    onSuccess: (updated) => {
      queryClient.setQueryData<SupervisorFloorData>(["supervisor", "floor", branchId], (current) => current ? {
        ...current,
        tables: current.tables.map((entry) => entry.id === updated.id ? { ...entry, ...updated } : entry),
      } : current);
      queryClient.setQueryData<SupervisorTable>(["supervisor", "table-detail", branchId, updated.id], updated);
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "floor", branchId] });
      void queryClient.invalidateQueries({ queryKey: ["waiter", "floor", branchId] });
      setPendingStatus("");
      setConfirmingStatus(false);
      showToast({ tone: "success", title: "Table status updated", description: `${updated.label || "Table"} is now ${statusLabel(updated.status as SupervisorTableStatus)}.` });
    },
    onError: (error) => {
      setConfirmingStatus(false);
      showToast({ tone: "danger", title: "Could not update table status", description: error instanceof Error ? error.message : "Retry when the connection is stable." });
    },
  });

  const order = orderQuery.data || null;
  const paymentState = getPaymentState(paymentsQuery.data);
  const billState = readMetadataString(order?.metadata, ["billState", "billStatus", "bill_state"])
    || (order?.status === "CLOSED" ? "Closed" : "Not requested");
  const orderItemCount = order?.items?.length ?? table?.activeOrder?.items?.length ?? 0;
  const operationalAttention = useMemo(() => {
    if (!table && orderId) return "Order is not linked to an accessible table.";
    if (paymentsQuery.data && !paymentsQuery.data.isSettled && Number(paymentsQuery.data.totalPaid) > 0) return "Partial payment requires Cashier follow-up.";
    if (table?.status === "reserved") return "Reservation context is linked to this table.";
    return "No immediate table warning returned.";
  }, [orderId, paymentsQuery.data, table]);

  const requestBillMutation = useMutation({
    mutationFn: () =>
      requestSupervisorOrderBill(accessToken as string, branchId as string, orderId as string),
    onSuccess: (result) => {
      // request-bill is audit-only on the backend (no persisted order/payment
      // state change), so we surface the server's own receipt truthfully rather
      // than refetching or manufacturing a persisted bill state.
      setBillAck(result);
      showToast({
        tone: "success",
        title: "Bill requested",
        description: `Cashier notified for ${order?.orderNumber || "this order"}.`,
      });
    },
    onError: (error) => {
      showToast({
        tone: "danger",
        title: "Could not request bill",
        description: error instanceof Error ? error.message : "Retry when the connection is stable.",
      });
    },
  });

  const markServedMutation = useMutation({
    mutationFn: (reason: string) =>
      markSupervisorOrderServed(accessToken as string, branchId as string, orderId as string, reason),
    onSuccess: () => {
      queryClient.setQueryData<SupervisorOrderDetail>(
        ["supervisor", "order-detail", branchId, orderId],
        (current) => (current ? { ...current, status: "SERVED" } : current),
      );
      queryClient.setQueryData<SupervisorFloorData>(["supervisor", "floor", branchId], (current) =>
        current
          ? {
              ...current,
              activeOrders: current.activeOrders.map((entry) =>
                entry.id === orderId ? { ...entry, status: "SERVED" } : entry,
              ),
            }
          : current,
      );
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "order-detail", branchId, orderId] });
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "floor", branchId] });
      void queryClient.invalidateQueries({ queryKey: ["waiter", "floor", branchId] });
      setMarkServedOpen(false);
      setMarkServedReason("");
      showToast({
        tone: "success",
        title: "Order marked served",
        description: `${order?.orderNumber || "Order"} is now served.`,
      });
    },
    onError: (error) => {
      showToast({
        tone: "danger",
        title: "Could not mark served",
        description: error instanceof Error ? error.message : "Retry when the connection is stable.",
      });
    },
  });

  const isOrderActionMutating = requestBillMutation.isPending || markServedMutation.isPending;
  const discountRows = discountsQuery.data?.data ?? [];
  const hasPendingDiscount = discountRows.some((discount) => discount.status === "PENDING");
  // Financial adjustments (void/discount) depend on payment state. Treat loading OR
  // an errored payment read as "unavailable" so we never assume "unpaid" on failure.
  const paymentUnavailable = paymentsQuery.isLoading || paymentsQuery.isError;
  const orderActionContext = {
    permissions,
    order: order ? { status: order.status } : null,
    orderErrored: orderQuery.isError,
    isMutating: isOrderActionMutating,
    lineCount: order?.items?.length ?? 0,
    total: order?.total ?? null,
    paymentState,
    paymentUnavailable,
    hasPendingDiscount,
  };
  const requestBillAvailability = getSupervisorOrderActionAvailability("request-bill", orderActionContext);
  const markServedAvailability = getSupervisorOrderActionAvailability("mark-served", orderActionContext);
  const splitBillAvailability = getSupervisorOrderActionAvailability("split-bill", orderActionContext);
  const splitItemsAvailability = getSupervisorOrderActionAvailability("split-items", orderActionContext);
  const moveItemsAvailability = getSupervisorOrderActionAvailability("move-items", orderActionContext);
  const mergeAvailability = getSupervisorOrderActionAvailability("merge", orderActionContext);
  const transferTableAvailability = getSupervisorOrderActionAvailability("transfer-table", orderActionContext);
  const voidAvailability = getSupervisorOrderActionAvailability("void", orderActionContext);
  const requestDiscountAvailability = getSupervisorOrderActionAvailability("request-discount", orderActionContext);
  const approveDiscountAvailability = getSupervisorOrderActionAvailability("approve-discount", orderActionContext);
  const rejectDiscountAvailability = getSupervisorOrderActionAvailability("reject-discount", orderActionContext);
  const complimentaryAvailability = getSupervisorOrderActionAvailability("complimentary", orderActionContext);
  const showServiceActions = requestBillAvailability.visible || markServedAvailability.visible;
  const showHandoffActions =
    splitBillAvailability.visible ||
    splitItemsAvailability.visible ||
    moveItemsAvailability.visible ||
    mergeAvailability.visible ||
    transferTableAvailability.visible;
  const showAdjustmentActions =
    voidAvailability.visible || requestDiscountAvailability.visible || complimentaryAvailability.visible;
  // Inline per-discount review (approve/reject) is offered when the reviewer holds
  // pos:discount:approve; each PENDING row also checks order-level enablement.
  const discountReview: DiscountRowReview = {
    visible: approveDiscountAvailability.visible || rejectDiscountAvailability.visible,
    canApprove: approveDiscountAvailability.enabled,
    canReject: rejectDiscountAvailability.enabled,
    reason: approveDiscountAvailability.reason || rejectDiscountAvailability.reason,
    disabled: isOrderActionMutating,
    onApprove: () => {},
    onReject: () => {},
  };
  const showOrderActions =
    Boolean(order) && !orderQuery.isError && (showServiceActions || showHandoffActions || showAdjustmentActions);

  useEffect(() => {
    setBillAck(null);
    setMarkServedOpen(false);
    setMarkServedReason("");
    setActiveAction(null);
    setReviewDiscount(null);
    requestBillMutation.reset();
    markServedMutation.reset();
    // Reset action state whenever the selected order changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  return (
    <div className="grid gap-5">
      <WorkspaceHeader table={table} onClose={onClose} />

      {orderQuery.isError ? (
        <WorkspaceQueryFailure error={orderQuery.error} onRetry={() => void orderQuery.refetch()} />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-text-muted">Order status</p>
          {orderQuery.isLoading && !order ? <Skeleton className="mt-3 h-7 w-28" /> : <p className="mt-3 text-xl font-bold text-text-primary">{order ? getSupervisorOrderStatusLabel(order.status) : "No active order"}</p>}
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-text-muted">Items</p>
          <p className="mt-3 text-xl font-bold tabular-nums text-text-primary">{orderItemCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-text-muted">Running total</p>
          {orderQuery.isLoading && !order ? <Skeleton className="mt-3 h-7 w-32" /> : <p className="mt-3 text-xl font-bold tabular-nums text-text-primary">{order ? formatSupervisorMoney(order.total) : "Not applicable"}</p>}
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-text-muted">Order age</p>
          <p className="mt-3 text-xl font-bold text-text-primary">{order ? formatAge(order.createdAt) : "Not applicable"}</p>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h3 className="text-lg font-bold text-text-primary">Table and service</h3>
          <dl className="mt-3 text-sm">
            <DetailRow label="Table" value={table?.label || "No linked table"} />
            <DetailRow label="Capacity" value={(tableQuery.data?.capacity ?? table?.capacity) ? `${tableQuery.data?.capacity ?? table?.capacity} seats` : "Capacity unavailable"} />
            <DetailRow label="Floor plan" value={tableQuery.data?.floorPlan?.name || table?.floorPlanName || "Floor plan unavailable"} />
            <DetailRow label="Assigned waiter" value={table?.assignedStaffName || "Assigned waiter unavailable"} />
            <DetailRow label="Attention" value={operationalAttention} />
          </dl>
          {tableQuery.isError ? (
            <StatusMessage tone="warning" title="Table detail could not refresh">
              <span>Cached Floor context remains visible.</span>
              <Button className="mt-3" size="compact" variant="secondary" onClick={() => void tableQuery.refetch()}>Retry table detail</Button>
            </StatusMessage>
          ) : null}
        </Card>

        <Card>
          <h3 className="text-lg font-bold text-text-primary">Order and bill</h3>
          <dl className="mt-3 text-sm">
            <DetailRow label="Order" value={order?.orderNumber || (order ? "Order number unavailable" : "No active order")} />
            <DetailRow label="Status" value={order ? getSupervisorOrderStatusLabel(order.status) : "Not applicable"} />
            <DetailRow label="Bill state" value={billState} />
            <DetailRow label="Subtotal" value={order ? formatSupervisorMoney(order.subtotal) : "Not applicable"} />
            <DetailRow label="Total" value={order ? formatSupervisorMoney(order.total) : "Not applicable"} />
          </dl>
        </Card>

        <Card>
          <h3 className="text-lg font-bold text-text-primary">Reservation</h3>
          {reservationQuery.isError ? (
            <StatusMessage tone="warning" title="Reservation detail could not refresh">
              <span>Cached Floor context remains visible.</span>
              <Button className="mt-3" size="compact" variant="secondary" onClick={() => void reservationQuery.refetch()}>Retry reservation</Button>
            </StatusMessage>
          ) : reservationQuery.isLoading && !reservationQuery.data ? (
            <div className="mt-4 grid gap-3"><Skeleton className="h-5 w-40" /><Skeleton className="h-5 w-56" /></div>
          ) : reservationQuery.data ? (
            <dl className="mt-3 text-sm">
              <DetailRow label="Guest" value={reservationQuery.data.customerName || "Guest unavailable"} />
              <DetailRow label="Status" value={String(reservationQuery.data.status || "Status unavailable").replace(/_/g, " ").toLowerCase()} />
              <DetailRow label="Party" value={reservationQuery.data.partySize ? `${reservationQuery.data.partySize} guests` : "Party size unavailable"} />
              <DetailRow label="Reservation time" value={formatReservationDateTime(reservationQuery.data.reservationAt)} />
            </dl>
          ) : (
            <p className="mt-3 text-sm leading-6 text-text-secondary">No active reservation is linked to this table.</p>
          )}
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-text-primary">Payment state</h3>
            <Badge variant={getPaymentStateTone(paymentState)}>{getPaymentStateLabel(paymentState)}</Badge>
          </div>
          {paymentsQuery.isError ? (
            <StatusMessage tone="warning" title="Payment summary could not refresh">
              <span>The order remains available in read-only mode.</span>
              <Button className="mt-3" size="compact" variant="secondary" onClick={() => void paymentsQuery.refetch()}>Retry payment summary</Button>
            </StatusMessage>
          ) : paymentsQuery.isLoading ? (
            <div className="mt-4 grid gap-3"><Skeleton className="h-5 w-40" /><Skeleton className="h-5 w-56" /></div>
          ) : paymentsQuery.data ? (
            <dl className="mt-3 text-sm">
              <DetailRow label="Order total" value={formatSupervisorMoney(paymentsQuery.data.orderTotal)} />
              <DetailRow label="Paid" value={formatSupervisorMoney(paymentsQuery.data.totalPaid)} />
              <DetailRow label="Remaining" value={formatSupervisorMoney(paymentsQuery.data.remainingBalance)} />
              <DetailRow label="Payment rows" value={String(paymentsQuery.data.payments.length)} />
            </dl>
          ) : (
            <p className="mt-3 text-sm leading-6 text-text-secondary">No payment summary is available for this context.</p>
          )}
          <p className="mt-3 text-sm leading-6 text-text-muted">Payment collection and order close remain in Cashier.</p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-text-primary">Order items</h3>
          <Badge variant="neutral">Read only</Badge>
        </div>
        {orderQuery.isLoading && !order ? (
          <div className="mt-4 grid gap-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
        ) : order?.items?.length ? (
          <div className="mt-4 divide-y divide-border-subtle">
            {order.items.map((item) => (
              <div key={item.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-5">
                <div className="min-w-0">
                  <p className="font-semibold text-text-primary">{item.menuItem?.name || "Menu item"}</p>
                  {item.menuItemServing?.label || item.menuItemServing?.format ? (
                    <p className="mt-1 text-sm text-text-muted">{item.menuItemServing.label || item.menuItemServing.format}</p>
                  ) : null}
                </div>
                <p className="text-sm font-semibold tabular-nums text-text-secondary">Qty {item.quantity || 0}</p>
                <p className="font-semibold tabular-nums text-text-primary">{formatSupervisorMoney(item.subtotal)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-text-secondary">No order lines are available for this table context.</p>
        )}
      </Card>

      {orderId && !orderQuery.isError && (discountsQuery.isLoading || discountsQuery.isError || discountRows.length > 0) ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-text-primary">Discounts</h3>
            <Badge variant="neutral">Read only</Badge>
          </div>
          {discountsQuery.isError ? (
            <StatusMessage tone="warning" title="Discounts could not refresh">
              <span>The order remains available in read-only mode.</span>
              <Button className="mt-3" size="compact" variant="secondary" onClick={() => void discountsQuery.refetch()}>
                Retry discounts
              </Button>
            </StatusMessage>
          ) : discountsQuery.isLoading ? (
            <div className="mt-4 grid gap-3"><Skeleton className="h-12 w-full" /></div>
          ) : (
            <div className="mt-2 divide-y divide-border-subtle">
              {discountRows.map((discount) => (
                <SupervisorDiscountRow
                  key={discount.id}
                  discount={discount}
                  review={{
                    ...discountReview,
                    onApprove: () => {
                      setReviewDiscount(discount);
                      setActiveAction("approve-discount");
                    },
                    onReject: () => {
                      setReviewDiscount(discount);
                      setActiveAction("reject-discount");
                    },
                  }}
                />
              ))}
            </div>
          )}
          <p className="mt-3 text-sm leading-6 text-text-muted">
            Approve or reject pending requests here; the branch-wide discount queue stays in Approvals.
          </p>
        </Card>
      ) : null}

      {table ? (
        <Card>
          <h3 className="text-lg font-bold text-text-primary">Table status</h3>
          {canUpdateStatus ? (
            <div className="mt-4 grid gap-4 md:grid-cols-[minmax(220px,320px)_1fr] md:items-end">
              <label className="grid gap-1 text-sm font-semibold text-text-secondary">
                <span>New status</span>
                <select
                  className="min-h-12 rounded-md bg-surface-muted px-3 text-base font-semibold text-text-primary shadow-subtle focus-visible:shadow-focus"
                  value={pendingStatus}
                  disabled={statusMutation.isPending}
                  onChange={(event) => {
                    setPendingStatus(event.target.value as SupervisorTableStatus);
                    setConfirmingStatus(false);
                  }}
                >
                  <option value="">Choose a status</option>
                  {supervisorTableStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                </select>
              </label>
              {!confirmingStatus ? (
                <Button
                  variant="secondary"
                  disabled={!pendingStatus || statusMutation.isPending}
                  onClick={() => setConfirmingStatus(true)}
                >Review status change</Button>
              ) : (
                <div className="flex flex-wrap items-center gap-3 rounded-lg bg-status-warning-surface p-3">
                  <p className="min-w-[220px] flex-1 text-sm font-semibold text-text-primary">Change {table.label} to {statusLabel(pendingStatus as SupervisorTableStatus)}?</p>
                  <Button variant="tertiary" disabled={statusMutation.isPending} onClick={() => setConfirmingStatus(false)}>Cancel</Button>
                  <Button disabled={statusMutation.isPending} onClick={() => statusMutation.mutate(pendingStatus as SupervisorTableStatus)}>{statusMutation.isPending ? "Updating status" : "Confirm change"}</Button>
                </div>
              )}
            </div>
          ) : (
            <StatusMessage tone="warning" title="Table status changes unavailable">
              This session can inspect table state but cannot change it.
            </StatusMessage>
          )}
        </Card>
      ) : null}

      {showOrderActions ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-text-primary">Order actions</h3>
            <Badge variant="neutral">Floor exceptions</Badge>
          </div>

          {showServiceActions ? (
            <div className="mt-4 grid gap-2">
              <p className="text-xs font-semibold uppercase tracking-normal text-text-muted">Service</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {requestBillAvailability.visible ? (
                  <div className="grid gap-2">
                    <Button
                      variant="secondary"
                      disabled={!requestBillAvailability.enabled || requestBillMutation.isPending}
                      onClick={() => requestBillMutation.mutate()}
                    >
                      {requestBillMutation.isPending ? "Requesting bill" : "Request bill"}
                    </Button>
                    {billAck ? (
                      <p className="text-sm font-semibold text-status-success">
                        Bill requested • {formatSupervisorShortTime(billAck.requestedAt)}
                      </p>
                    ) : requestBillAvailability.reason ? (
                      <p className="text-sm leading-6 text-text-muted">{requestBillAvailability.reason}</p>
                    ) : (
                      <p className="text-sm leading-6 text-text-muted">
                        Notifies the cashier that this table is ready to pay. Does not collect payment.
                      </p>
                    )}
                  </div>
                ) : null}

                {markServedAvailability.visible ? (
                  <div className="grid gap-2">
                    <Button
                      variant="secondary"
                      disabled={!markServedAvailability.enabled || markServedMutation.isPending}
                      onClick={() => setMarkServedOpen(true)}
                    >
                      Mark served
                    </Button>
                    {markServedAvailability.reason ? (
                      <p className="text-sm leading-6 text-text-muted">{markServedAvailability.reason}</p>
                    ) : (
                      <p className="text-sm leading-6 text-text-muted">
                        Service exception for an order the kitchen has already marked ready.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {showHandoffActions ? (
            <div className="mt-4 grid gap-2">
              <p className="text-xs font-semibold uppercase tracking-normal text-text-muted">Handoff</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { key: "split-bill" as const, label: "Split bill", availability: splitBillAvailability, hint: "Allocate payable groups for the cashier." },
                  { key: "split-items" as const, label: "Split items", availability: splitItemsAvailability, hint: "Move items onto a new child order." },
                  { key: "move-items" as const, label: "Move items", availability: moveItemsAvailability, hint: "Move items to another open order." },
                  { key: "merge" as const, label: "Merge order", availability: mergeAvailability, hint: "Void this order into a surviving order." },
                  { key: "transfer-table" as const, label: "Transfer table", availability: transferTableAvailability, hint: "Move this order to another table in the branch." },
                ]
                  .filter((entry) => entry.availability.visible)
                  .map((entry) => (
                    <div key={entry.key} className="grid gap-2">
                      <Button
                        variant="secondary"
                        disabled={!entry.availability.enabled || isOrderActionMutating}
                        onClick={() => setActiveAction(entry.key)}
                      >
                        {entry.label}
                      </Button>
                      <p className="text-sm leading-6 text-text-muted">
                        {entry.availability.reason || entry.hint}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          ) : null}

          {showAdjustmentActions ? (
            <div className="mt-4 grid gap-2">
              <p className="text-xs font-semibold uppercase tracking-normal text-text-muted">Adjustments</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {requestDiscountAvailability.visible ? (
                  <div className="grid gap-2">
                    <Button
                      variant="secondary"
                      disabled={!requestDiscountAvailability.enabled || isOrderActionMutating}
                      onClick={() => setActiveAction("request-discount")}
                    >
                      Discount
                    </Button>
                    <p className="text-sm leading-6 text-text-muted">
                      {requestDiscountAvailability.reason
                        || "Request an order-level discount (auto-approved within the branch threshold, else pending)."}
                    </p>
                  </div>
                ) : null}

                {complimentaryAvailability.visible ? (
                  <div className="grid gap-2">
                    <Button
                      variant="secondary"
                      disabled={!complimentaryAvailability.enabled || isOrderActionMutating}
                      onClick={() => setActiveAction("complimentary")}
                    >
                      Complimentary
                    </Button>
                    <p className="text-sm leading-6 text-text-muted">
                      {complimentaryAvailability.reason
                        || "Comp the whole order (100% discount; may need approval). Not a refund or void."}
                    </p>
                  </div>
                ) : null}

                {voidAvailability.visible ? (
                  <div className="grid gap-2">
                    <Button
                      variant="danger"
                      disabled={!voidAvailability.enabled || isOrderActionMutating}
                      onClick={() => setActiveAction("void")}
                    >
                      Void order
                    </Button>
                    <p className="text-sm leading-6 text-text-muted">
                      {voidAvailability.reason
                        || "Void this active order. Not a refund, complimentary, or post-close void."}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      <StatusMessage tone="info" title="Additional order controls are not available in this version.">
        Transfer server, refund, post-close void, payment collection, and order close are intentionally not shown here.
      </StatusMessage>

      <ActionConfirmDialog
        open={markServedOpen}
        title="Mark order served"
        consequence="This records the order as served for the guest. It does not collect payment or close the order."
        context={
          order ? (
            <p>
              {order.orderNumber || "Order"} • {getSupervisorOrderStatusLabel(order.status)}
              {table?.label ? ` • ${table.label}` : ""}
            </p>
          ) : null
        }
        reason={{
          label: "Reason (optional)",
          placeholder: "Add a short note for the audit trail",
          value: markServedReason,
          onChange: setMarkServedReason,
          required: false,
        }}
        pending={markServedMutation.isPending}
        error={
          markServedMutation.isError
            ? markServedMutation.error instanceof Error
              ? markServedMutation.error.message
              : "Could not mark served."
            : null
        }
        confirmLabel="Mark served"
        onCancel={() => {
          if (markServedMutation.isPending) return;
          setMarkServedOpen(false);
          setMarkServedReason("");
          markServedMutation.reset();
        }}
        onConfirm={() => markServedMutation.mutate(markServedReason)}
      />

      {order && accessToken && branchId ? (
        <>
          {activeAction === "split-bill" ? (
            <SupervisorSplitBillDialog
              order={order}
              token={accessToken}
              branchId={branchId}
              tableLabel={table?.label ?? null}
              onClose={() => setActiveAction(null)}
            />
          ) : null}

          {activeAction === "split-items" ? (
            <SupervisorSplitItemsDialog
              order={order}
              token={accessToken}
              branchId={branchId}
              tableLabel={table?.label ?? null}
              onClose={() => setActiveAction(null)}
            />
          ) : null}

          {activeAction === "move-items" ? (
            <SupervisorMoveItemsDialog
              order={order}
              token={accessToken}
              branchId={branchId}
              tableLabel={table?.label ?? null}
              onClose={() => setActiveAction(null)}
            />
          ) : null}

          {activeAction === "merge" ? (
            <SupervisorMergeOrderDialog
              order={order}
              token={accessToken}
              branchId={branchId}
              tableLabel={table?.label ?? null}
              onClose={() => setActiveAction(null)}
              onCompleted={(nav) => {
                setActiveAction(null);
                if (onNavigateToOrder) onNavigateToOrder(nav);
                else onClose();
              }}
            />
          ) : null}

          {activeAction === "transfer-table" ? (
            <SupervisorTransferTableDialog
              order={order}
              token={accessToken}
              branchId={branchId}
              sourceTableId={order.tableId ?? table?.id ?? null}
              sourceTableLabel={table?.label ?? order.table?.label ?? null}
              onClose={() => setActiveAction(null)}
              onCompleted={({ newTableId }) => {
                setActiveAction(null);
                // Stay in the same order workspace, but re-anchor it to the
                // returned target table (updates selection + URL, keeps orderId).
                if (onNavigateToOrder) onNavigateToOrder({ orderId: order.id, tableId: newTableId });
              }}
            />
          ) : null}

          {activeAction === "request-discount" ? (
            <SupervisorDiscountRequestDialog
              order={order}
              token={accessToken}
              branchId={branchId}
              tableLabel={table?.label ?? null}
              onClose={() => setActiveAction(null)}
              onCompleted={() => setActiveAction(null)}
            />
          ) : null}

          {activeAction === "void" ? (
            <SupervisorVoidOrderDialog
              order={order}
              token={accessToken}
              branchId={branchId}
              tableLabel={table?.label ?? null}
              paymentStateLabel={getPaymentStateLabel(paymentState)}
              onClose={() => setActiveAction(null)}
              // Stay in the now read-only voided-order context (actions self-suppress).
              onCompleted={() => setActiveAction(null)}
            />
          ) : null}

          {activeAction === "complimentary" ? (
            <SupervisorComplimentaryDialog
              order={order}
              token={accessToken}
              branchId={branchId}
              tableLabel={table?.label ?? null}
              onClose={() => setActiveAction(null)}
              onCompleted={() => setActiveAction(null)}
            />
          ) : null}

          {activeAction === "approve-discount" && reviewDiscount ? (
            <SupervisorApproveDiscountDialog
              order={order}
              discount={reviewDiscount}
              token={accessToken}
              branchId={branchId}
              tableLabel={table?.label ?? null}
              currentUserId={currentUserId}
              onClose={() => {
                setActiveAction(null);
                setReviewDiscount(null);
              }}
              onCompleted={() => {
                setActiveAction(null);
                setReviewDiscount(null);
              }}
            />
          ) : null}

          {activeAction === "reject-discount" && reviewDiscount ? (
            <SupervisorRejectDiscountDialog
              order={order}
              discount={reviewDiscount}
              token={accessToken}
              branchId={branchId}
              tableLabel={table?.label ?? null}
              onClose={() => {
                setActiveAction(null);
                setReviewDiscount(null);
              }}
              onCompleted={() => {
                setActiveAction(null);
                setReviewDiscount(null);
              }}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
