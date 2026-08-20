import { X } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { Badge, Button, ErrorState, Skeleton, StatusMessage } from "@/components/ui";
import { OperationalTableStatusBadge } from "@/components/floor/OperationalTableStatusBadge";
import { formatOperationalTableLabel } from "@/components/floor/formatters";
import { useToast } from "@/components/providers/ToastProvider";
import { WaiterOwnershipBlockedPanel } from "@/components/waiter/floor/WaiterOwnershipBlockedPanel";
import { WaiterOrderBuilderScreen } from "@/components/waiter/orders";
import { ApiError, shouldRetryApiRequest } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { WaiterTableAction, WaiterTableViewModel } from "@/lib/waiter/floor-model";
import type { WaiterOrderApi } from "@/lib/waiter/order-api";
import { getReservation, seatReservation } from "@/lib/waiter/reservation-api";
import {
  buildSeatReservationPayload,
  normalizeWaiterReservation,
} from "@/lib/waiter/reservation-model";

type WaiterTableWorkspaceProps = {
  action: WaiterTableAction;
  requestedOrderId?: string;
  shiftIsOpen: boolean;
  onClose: () => void;
  onOpenOrder: (tableId: string, orderId: string, order?: WaiterOrderApi) => void;
};

function mutationErrorCopy(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.code === "SHIFT_NOT_OPEN") return "Start your shift before continuing service.";
    if (error.code === "ORDER_NOT_OWNED_BY_WAITER") {
      return "This table has an order assigned to another waiter.";
    }
    return error.message;
  }
  return error instanceof Error ? error.message : fallback;
}

function WorkspaceHeader({
  table,
  onClose,
}: {
  table: WaiterTableViewModel;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border-subtle pb-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2
            className="truncate text-xl font-bold leading-7 text-text-primary"
            title={table.label}
          >
            {formatOperationalTableLabel(table.label) || table.label}
          </h2>
          <OperationalTableStatusBadge status={table.status} />
          {table.isMine ? <Badge variant="info">Mine</Badge> : null}
        </div>
        <p className="mt-2 text-sm font-semibold text-text-secondary">
          <span className="tabular-nums">{table.capacity || "?"}</span> seats
        </p>
      </div>
      <button
        type="button"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surface-muted text-text-secondary hover:bg-surface hover:text-text-primary"
        aria-label={`Close ${table.label} workspace`}
        onClick={onClose}
      >
        <X size={20} weight="bold" aria-hidden />
      </button>
    </div>
  );
}

function ReservationWorkspace({
  table,
  shiftIsOpen,
  onClose,
  onOpenOrder,
}: {
  table: WaiterTableViewModel;
  shiftIsOpen: boolean;
  onClose: () => void;
  onOpenOrder: (tableId: string, orderId: string, order?: WaiterOrderApi) => void;
}) {
  const { accessToken, branchId } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const reservationQuery = useQuery({
    queryKey: ["waiter", "reservation", branchId, table.reservationId],
    enabled: Boolean(accessToken && branchId && table.reservationId),
    queryFn: () =>
      getReservation(accessToken as string, branchId as string, table.reservationId as string),
    retry: shouldRetryApiRequest,
  });

  const reservation = useMemo(
    () => (reservationQuery.data ? normalizeWaiterReservation(reservationQuery.data) : null),
    [reservationQuery.data],
  );

  const seatMutation = useMutation({
    mutationFn: () =>
      seatReservation(
        accessToken as string,
        branchId as string,
        reservation?.id as string,
        buildSeatReservationPayload(reservation!),
      ),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["waiter", "reservations"] });
      void queryClient.invalidateQueries({ queryKey: ["waiter", "reservation", branchId, result.id] });
      void queryClient.invalidateQueries({ queryKey: ["waiter", "floor"] });
      void queryClient.invalidateQueries({ queryKey: ["waiter", "orders-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["waiter", "table", branchId, table.id] });

      const orderId = result.seatedOrderId || result.seatedOrder?.id;
      showToast({
        tone: "success",
        title: "Guest seated",
        description: orderId
          ? "The linked order is open in this table workspace."
          : "Reservation and Floor data were refreshed.",
      });
      if (orderId) onOpenOrder(table.id, orderId, result.seatedOrder || undefined);
    },
    onError: (error) => {
      showToast({
        tone: "danger",
        title: "Could not seat guest",
        description: mutationErrorCopy(error, "The reservation could not be seated."),
      });
    },
  });

  if (!table.reservationId) {
    return (
      <div className="grid gap-5">
        <WorkspaceHeader table={table} onClose={onClose} />
        <ErrorState
          title="Reservation link unavailable"
          description="This table is reserved, but no accessible reservation was returned for it."
        />
      </div>
    );
  }

  if (reservationQuery.isLoading) {
    return (
      <div className="grid gap-5">
        <WorkspaceHeader table={table} onClose={onClose} />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (reservationQuery.isError || !reservation) {
    return (
      <div className="grid gap-5">
        <WorkspaceHeader table={table} onClose={onClose} />
        <ErrorState
          title="Could not load reservation"
          description={mutationErrorCopy(reservationQuery.error, "Try again from Reservations.")}
        />
      </div>
    );
  }

  const seatDisabledReason = !shiftIsOpen
    ? "Start your shift before seating guests."
    : reservation.blockedReason;

  return (
    <div className="grid gap-5">
      <WorkspaceHeader table={table} onClose={onClose} />
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xl font-bold text-text-primary">{reservation.guest.name}</p>
          <Badge variant={reservation.status.tone}>{reservation.status.label}</Badge>
        </div>
        <p className="mt-2 text-sm font-semibold tabular-nums text-text-secondary">
          {reservation.dateLabel}, {reservation.timeLabel}
        </p>
      </div>
      <dl className="grid gap-3 text-sm">
        <div className="flex items-center justify-between gap-4 border-b border-border-subtle pb-3">
          <dt className="font-medium text-text-muted">Party</dt>
          <dd className="font-semibold text-text-primary">{reservation.partyLabel}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-b border-border-subtle pb-3">
          <dt className="font-medium text-text-muted">Table</dt>
          <dd className="font-semibold text-text-primary">{reservation.table.name}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-b border-border-subtle pb-3">
          <dt className="font-medium text-text-muted">Arrival</dt>
          <dd className="font-semibold text-text-primary">{reservation.relativeTimeLabel}</dd>
        </div>
      </dl>
      {seatDisabledReason ? (
        <StatusMessage tone="warning" title="Seat guest unavailable">
          {seatDisabledReason}
        </StatusMessage>
      ) : null}
      <Button
        size="pos"
        className="w-full"
        disabled={Boolean(seatDisabledReason) || seatMutation.isPending}
        onClick={() => seatMutation.mutate()}
      >
        {seatMutation.isPending ? "Seating guest" : "Seat guest"}
      </Button>
    </div>
  );
}

export function WaiterTableWorkspace({
  action,
  requestedOrderId,
  shiftIsOpen,
  onClose,
  onOpenOrder,
}: WaiterTableWorkspaceProps) {
  const { table } = action;
  const orderId = requestedOrderId || table.activeOrderId;

  if (orderId && (action.intent === "own-order" || requestedOrderId)) {
    return (
      <WaiterOrderBuilderScreen
        orderId={orderId}
        initialOrder={table.activeOrder}
        expectedTableId={table.id}
        tableContext={{ id: table.id, name: table.label }}
        onClose={onClose}
      />
    );
  }

  if (action.intent === "ownership-blocked") {
    return <WaiterOwnershipBlockedPanel table={table} onClose={onClose} />;
  }

  if (action.intent === "start-order") {
    return (
      <WaiterOrderBuilderScreen
        expectedTableId={table.id}
        tableContext={{ id: table.id, name: table.label }}
        startOrderOnMount
        onClose={onClose}
        onOrderResolved={(order) => onOpenOrder(table.id, order.id, order)}
      />
    );
  }

  if (action.intent === "reservation-detail") {
    return (
      <ReservationWorkspace
        table={table}
        shiftIsOpen={shiftIsOpen}
        onClose={onClose}
        onOpenOrder={onOpenOrder}
      />
    );
  }

  return (
    <div className="grid gap-5">
      <WorkspaceHeader table={table} onClose={onClose} />
      <StatusMessage tone="warning" title={action.title}>
        {action.message}
      </StatusMessage>
    </div>
  );
}
