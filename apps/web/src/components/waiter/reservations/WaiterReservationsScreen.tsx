import {
  Armchair,
  ArrowRight,
  CalendarCheck,
  CheckCircle,
  Clock,
  FunnelSimple,
  Phone,
  Receipt,
  User,
  Users,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageShell,
  SearchInput,
  Skeleton,
  StatusMessage,
} from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cn } from "@/lib/utils/cn";
import {
  getReservation,
  listUpcomingReservations,
  seatReservation,
  type WaiterReservationListQuery,
} from "@/lib/waiter/reservation-api";
import {
  buildSeatReservationPayload,
  filterWaiterReservations,
  normalizeSeatResult,
  normalizeWaiterReservation,
  normalizeWaiterReservations,
  type WaiterReservationFilter,
  type WaiterReservationSeatResultViewModel,
  type WaiterReservationViewModel,
} from "@/lib/waiter/reservation-model";
import { useActiveShift } from "@/lib/waiter/useActiveShift";

type FilterConfig = {
  id: WaiterReservationFilter;
  label: string;
  query?: WaiterReservationListQuery;
};

const FILTERS: FilterConfig[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "today", label: "Today", query: { pageSize: 100 } },
  { id: "seated", label: "Seated", query: { status: "SEATED", pageSize: 100 } },
  { id: "late", label: "Late", query: { pageSize: 100 } },
  { id: "all", label: "All", query: { pageSize: 100 } },
];

function getQueryParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getReservationErrorCopy(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "NETWORK_ERROR") {
      return {
        title: "Could not reach the API",
        description: "Confirm the backend is running at the configured API URL.",
      };
    }

    if (error.code === "SHIFT_NOT_OPEN") {
      return {
        title: "Shift not started",
        description: "Reservations remain readable, but seating needs an open shift.",
      };
    }

    if (error.code === "RESERVATION_NOT_FOUND" || error.status === 404) {
      return {
        title: "Reservation not found",
        description: "This reservation may no longer be available in this branch.",
      };
    }

    if (error.isForbidden) {
      return {
        title: "Reservations access blocked",
        description: "This waiter account cannot read reservations for this branch.",
      };
    }

    if (error.isAuthError) {
      return {
        title: "Session expired",
        description: "Log in again to continue seating guests.",
      };
    }

    return { title: "Could not load reservations", description: error.message };
  }

  return {
    title: "Could not load reservations",
    description: error instanceof Error ? error.message : "Try again when the connection is stable.",
  };
}

function getSeatErrorCopy(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "SHIFT_NOT_OPEN") return "Start your shift before seating guests.";
    if (error.code === "RESERVATION_NOT_FOUND" || error.status === 404) {
      return "Reservation not found.";
    }
    if (error.code === "RESERVATION_ALREADY_SEATED" || error.status === 409) {
      return error.message || "Reservation is already seated or no longer seatable.";
    }
    if (error.code === "TABLE_NOT_AVAILABLE") return "Table is not available for seating.";
    if (error.isForbidden) return "This action is not available for waiter role.";
    if (error.isAuthError) return "Session expired. Log in again.";
    if (error.code === "NETWORK_ERROR") return "Could not reach the API.";
    return error.message;
  }

  return error instanceof Error ? error.message : "Could not seat guest.";
}

function ReservationsSkeleton() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index} className="min-h-[116px]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <Skeleton className="h-12 w-12 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="mt-3 h-4 w-80" />
                <Skeleton className="mt-3 h-4 w-56" />
              </div>
            </div>
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function FilterChips({
  activeFilter,
  onChange,
}: {
  activeFilter: WaiterReservationFilter;
  onChange: (filter: WaiterReservationFilter) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {FILTERS.map((filter) => {
        const active = filter.id === activeFilter;
        return (
          <button
            key={filter.id}
            type="button"
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold",
              "transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96]",
              active
                ? "bg-brand-navy-900 text-text-inverse"
                : "bg-surface-muted text-text-secondary hover:bg-surface",
            )}
            onClick={() => onChange(filter.id)}
          >
            <span>{filter.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ReservationCard({
  reservation,
  active,
  onSelect,
}: {
  reservation: WaiterReservationViewModel;
  active: boolean;
  onSelect: (reservation: WaiterReservationViewModel) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-lg bg-surface p-5 text-left text-text-primary shadow-subtle",
        "transition-[background-color,box-shadow,transform] duration-150 ease-out hover:bg-surface-raised hover:shadow-panel active:scale-[0.99]",
        active && "shadow-panel",
      )}
      onClick={() => onSelect(reservation)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-status-warning-surface text-status-warning">
            <CalendarCheck size={24} weight="duotone" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="truncate text-lg font-bold tracking-normal text-text-primary">
                {reservation.guest.name}
              </p>
              <Badge variant={reservation.status.tone}>{reservation.status.label}</Badge>
              {reservation.depositLabel ? (
                <Badge variant="neutral">{reservation.depositLabel}</Badge>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium text-text-secondary">
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Clock size={16} weight="bold" aria-hidden />
                {reservation.timeLabel}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users size={16} weight="bold" aria-hidden />
                {reservation.partyLabel}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Armchair size={16} weight="bold" aria-hidden />
                {reservation.table.name}
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold text-text-muted">
              {reservation.relativeTimeLabel} / {reservation.reservationNumber}
              {reservation.source ? ` / ${reservation.source}` : ""}
            </p>
          </div>
        </div>
        <ArrowRight size={20} weight="bold" className="mt-1 shrink-0 text-text-muted" aria-hidden />
      </div>
    </button>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | undefined;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md bg-surface-muted px-3 py-2">
      <dt className="text-sm font-semibold text-text-secondary">{label}</dt>
      <dd className="text-right text-sm font-bold text-text-primary">{value || "Unavailable"}</dd>
    </div>
  );
}

function SeatSuccessPanel({
  result,
  onOpenOrder,
  onStartOrder,
  onGoToFloor,
}: {
  result: WaiterReservationSeatResultViewModel;
  onOpenOrder: () => void;
  onStartOrder: () => void;
  onGoToFloor: () => void;
}) {
  return (
    <Card className="bg-status-success-surface text-status-success">
      <div className="flex items-start gap-3">
        <CheckCircle size={24} weight="bold" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-bold">Guest seated.</p>
          <p className="mt-1 text-sm">
            {result.orderId
              ? `Linked order ${result.orderNumber || result.orderId} is ready.`
              : `${result.tableName} was refreshed from the backend.`}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {result.orderId ? (
              <Button variant="secondary" onClick={onOpenOrder}>
                Open order
              </Button>
            ) : result.tableId ? (
              <Button variant="secondary" onClick={onStartOrder}>
                Start order
              </Button>
            ) : null}
            <Button variant="secondary" onClick={onGoToFloor}>
              Go to Floor
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ReservationDetailPanel({
  reservation,
  isLoading,
  isSeatPending,
  seatDisabledReason,
  seatError,
  seatResult,
  onSeat,
  onClose,
  onOpenOrder,
  onStartOrder,
  onGoToFloor,
}: {
  reservation?: WaiterReservationViewModel;
  isLoading: boolean;
  isSeatPending: boolean;
  seatDisabledReason?: string;
  seatError?: string | null;
  seatResult?: WaiterReservationSeatResultViewModel | null;
  onSeat: (reservation: WaiterReservationViewModel) => void;
  onClose: () => void;
  onOpenOrder: () => void;
  onStartOrder: () => void;
  onGoToFloor: () => void;
}) {
  if (isLoading) {
    return (
      <Card className="min-h-[620px]">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-4 h-5 w-72" />
        <div className="mt-6 grid gap-3">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  if (!reservation) {
    return (
      <Card className="min-h-[420px] bg-surface-muted">
        <p className="text-lg font-bold tracking-normal text-text-primary">Select a reservation</p>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          Guest detail and seating actions appear here.
        </p>
      </Card>
    );
  }

  const disabledReason = seatDisabledReason || reservation.blockedReason;

  return (
    <Card className="min-h-[620px]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xl font-bold tracking-normal text-text-primary">
              {reservation.guest.name}
            </p>
            <Badge variant={reservation.status.tone}>{reservation.status.label}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            {reservation.partyLabel} at {reservation.timeLabel} on {reservation.dateLabel}.
          </p>
        </div>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-muted text-text-secondary transition-[background-color,color,transform] duration-150 ease-out hover:bg-brand-white hover:text-text-primary active:scale-[0.96]"
          aria-label="Close reservation detail"
          onClick={onClose}
        >
          <X size={18} weight="bold" aria-hidden />
        </button>
      </div>

      <dl className="mt-5 grid gap-3">
        <DetailRow label="Reservation" value={reservation.reservationNumber} />
        <DetailRow label="Time" value={`${reservation.dateLabel}, ${reservation.timeLabel}`} />
        <DetailRow label="Table" value={reservation.table.name} />
        <DetailRow label="Party" value={reservation.partyLabel} />
        <DetailRow label="Source" value={reservation.source} />
        <DetailRow label="Deposit" value={reservation.depositLabel || "No deposit state returned"} />
      </dl>

      <div className="mt-5 grid gap-3">
        <div className="rounded-md bg-surface-muted p-4">
          <p className="mb-3 text-sm font-bold text-text-primary">Safe contact</p>
          <div className="grid gap-2 text-sm font-medium text-text-secondary">
            <span className="inline-flex items-center gap-2">
              <User size={16} weight="bold" aria-hidden />
              {reservation.guest.name}
            </span>
            <span className="inline-flex items-center gap-2">
              <Phone size={16} weight="bold" aria-hidden />
              {reservation.guest.phone || reservation.guest.email || "Contact not returned"}
            </span>
          </div>
        </div>

        {reservation.notes || reservation.specialRequests ? (
          <div className="rounded-md bg-surface-muted p-4">
            <p className="text-sm font-bold text-text-primary">Read-only notes</p>
            {reservation.notes ? (
              <p className="mt-2 text-sm leading-6 text-text-secondary">{reservation.notes}</p>
            ) : null}
            {reservation.specialRequests ? (
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                {reservation.specialRequests}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <StatusMessage tone="info" title="Waiter reservation scope">
        Create, confirm, cancel, no-show, table assignment, and deposit actions are manager/admin
        workflows and are not exposed here.
      </StatusMessage>

      {seatError ? (
        <StatusMessage tone="danger" title="Could not seat guest">
          {seatError}
        </StatusMessage>
      ) : null}

      {disabledReason ? (
        <StatusMessage tone="warning" title="Seat guest disabled">
          {disabledReason}
        </StatusMessage>
      ) : null}

      {seatResult?.reservationId === reservation.id ? (
        <div className="mt-5">
          <SeatSuccessPanel
            result={seatResult}
            onOpenOrder={onOpenOrder}
            onStartOrder={onStartOrder}
            onGoToFloor={onGoToFloor}
          />
        </div>
      ) : null}

      <Button
        className="mt-5 w-full"
        size="pos"
        disabled={Boolean(disabledReason) || isSeatPending}
        leadingIcon={<CheckCircle size={22} weight="bold" aria-hidden />}
        onClick={() => onSeat(reservation)}
      >
        {isSeatPending ? "Seating guest" : "Seat guest"}
      </Button>
    </Card>
  );
}

export function WaiterReservationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, branchId, branchName, clearSession } = useAuth();
  const activeShift = useActiveShift();
  const [activeFilter, setActiveFilter] = useState<WaiterReservationFilter>("upcoming");
  const [search, setSearch] = useState("");
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [seatError, setSeatError] = useState<string | null>(null);
  const [seatResult, setSeatResult] = useState<WaiterReservationSeatResultViewModel | null>(null);

  useEffect(() => {
    const fromQuery = getQueryParam(router.query.reservationId);
    if (fromQuery) setSelectedReservationId(fromQuery);
  }, [router.query.reservationId]);

  const filter = FILTERS.find((entry) => entry.id === activeFilter) || FILTERS[0];

  const reservationsQuery = useQuery({
    queryKey: ["waiter", "reservations", branchId, activeFilter],
    enabled: Boolean(accessToken && branchId),
    queryFn: () =>
      listUpcomingReservations(accessToken as string, branchId as string, filter.query || {}),
    retry: 1,
    staleTime: 15_000,
  });

  const detailQuery = useQuery({
    queryKey: ["waiter", "reservation", branchId, selectedReservationId],
    enabled: Boolean(accessToken && branchId && selectedReservationId),
    queryFn: () =>
      getReservation(accessToken as string, branchId as string, selectedReservationId as string),
    retry: 1,
  });

  useEffect(() => {
    if (reservationsQuery.error instanceof ApiError && reservationsQuery.error.isAuthError) {
      clearSession();
    }
    if (detailQuery.error instanceof ApiError && detailQuery.error.isAuthError) {
      clearSession();
    }
  }, [clearSession, detailQuery.error, reservationsQuery.error]);

  const reservations = useMemo(
    () => normalizeWaiterReservations(reservationsQuery.data?.data || []),
    [reservationsQuery.data?.data],
  );

  const visibleReservations = useMemo(
    () => filterWaiterReservations(reservations, activeFilter, search),
    [activeFilter, reservations, search],
  );

  const selectedFromList = useMemo(
    () => reservations.find((reservation) => reservation.id === selectedReservationId),
    [reservations, selectedReservationId],
  );

  const selectedReservation = useMemo(() => {
    if (detailQuery.data) return normalizeWaiterReservation(detailQuery.data);
    return selectedFromList;
  }, [detailQuery.data, selectedFromList]);

  const shiftBlockedReason = activeShift.isLoading
    ? "Checking shift state before seating."
    : activeShift.isError
      ? "Shift state unavailable. Seating is disabled until shift readiness is known."
      : !activeShift.data
        ? "Start your shift before seating guests."
        : undefined;

  const seatMutation = useMutation({
    mutationFn: (reservation: WaiterReservationViewModel) =>
      seatReservation(
        accessToken as string,
        branchId as string,
        reservation.id,
        buildSeatReservationPayload(reservation),
      ),
    onSuccess: async (result) => {
      const normalized = normalizeSeatResult(result);
      setSeatResult(normalized);
      setSeatError(null);
      setSelectedReservationId(normalized.reservationId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["waiter", "reservations"] }),
        queryClient.invalidateQueries({ queryKey: ["waiter", "reservation", branchId, normalized.reservationId] }),
        queryClient.invalidateQueries({ queryKey: ["waiter", "floor"] }),
        queryClient.invalidateQueries({ queryKey: ["waiter", "orders-queue"] }),
        normalized.tableId
          ? queryClient.invalidateQueries({ queryKey: ["waiter", "table", branchId, normalized.tableId] })
          : Promise.resolve(),
      ]);
    },
    onError: (error) => setSeatError(getSeatErrorCopy(error)),
  });

  function selectReservation(reservation: WaiterReservationViewModel) {
    setSeatError(null);
    setSelectedReservationId(reservation.id);
    void router.replace(
      { pathname: "/waiter/reservations", query: { reservationId: reservation.id } },
      undefined,
      { shallow: true },
    );
  }

  function clearSelection() {
    setSelectedReservationId(null);
    setSeatError(null);
    void router.replace("/waiter/reservations", undefined, { shallow: true });
  }

  const listErrorCopy = reservationsQuery.isError
    ? getReservationErrorCopy(reservationsQuery.error)
    : null;
  const detailErrorCopy = detailQuery.isError ? getReservationErrorCopy(detailQuery.error) : null;

  return (
    <PageShell
      title="Reservations"
      subtitle="Upcoming guests ready to seat."
      actions={
        <div className="flex items-center gap-2">
          <Badge variant={activeShift.data ? "success" : "warning"}>
            {activeShift.data ? "Shift open" : "Shift not started"}
          </Badge>
          <Badge variant="neutral">{branchName || "Branch"}</Badge>
        </div>
      }
    >
      {shiftBlockedReason && !activeShift.isLoading ? (
        <StatusMessage tone="warning" title="Seat guest blocked">
          {shiftBlockedReason}
        </StatusMessage>
      ) : null}

      {seatResult ? (
        <StatusMessage tone="success" title="Guest seated">
          Table and order state have been refreshed from the backend.
        </StatusMessage>
      ) : null}

      <Card className="grid grid-cols-[1fr_360px] items-center gap-5">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-secondary">
            <FunnelSimple size={18} weight="bold" aria-hidden />
            <span>Service window</span>
          </div>
          <FilterChips
            activeFilter={activeFilter}
            onChange={(nextFilter) => {
              setActiveFilter(nextFilter);
              setSeatError(null);
            }}
          />
        </div>
        <SearchInput
          value={search}
          aria-label="Search reservations"
          placeholder="Search guest, table, phone, status"
          onChange={(event) => setSearch(event.target.value)}
        />
      </Card>

      {listErrorCopy ? (
        <ErrorState title={listErrorCopy.title} description={listErrorCopy.description} />
      ) : (
        <div className="grid grid-cols-[1fr_420px] items-start gap-6">
          <section className="grid gap-3">
            {reservationsQuery.isLoading ? (
              <ReservationsSkeleton />
            ) : visibleReservations.length === 0 ? (
              <EmptyState
                icon={<CalendarCheck size={32} weight="duotone" />}
                title={
                  search
                    ? "No reservations match this search"
                    : "No reservations for this service window"
                }
                description={
                  search
                    ? "Try another guest name, table, phone, email, reservation number, or status."
                    : "Use Floor for walk-ins or check another reservation filter."
                }
                action={
                  <Button variant="secondary" onClick={() => void router.push("/waiter/floor")}>
                    Go to Floor
                  </Button>
                }
              />
            ) : (
              visibleReservations.map((reservation) => (
                <ReservationCard
                  key={reservation.id}
                  reservation={reservation}
                  active={reservation.id === selectedReservationId}
                  onSelect={selectReservation}
                />
              ))
            )}
          </section>

          <aside className="sticky top-36">
            {detailErrorCopy ? (
              <ErrorState title={detailErrorCopy.title} description={detailErrorCopy.description} />
            ) : (
              <ReservationDetailPanel
                reservation={selectedReservation}
                isLoading={detailQuery.isLoading}
                isSeatPending={seatMutation.isPending}
                seatDisabledReason={shiftBlockedReason}
                seatError={seatError}
                seatResult={seatResult}
                onSeat={(reservation) => seatMutation.mutate(reservation)}
                onClose={clearSelection}
                onOpenOrder={() => {
                  if (seatResult?.orderId) void router.push(`/waiter/orders/${seatResult.orderId}`);
                }}
                onStartOrder={() => {
                  if (seatResult?.tableId) {
                    void router.push(`/waiter/orders/new?tableId=${encodeURIComponent(seatResult.tableId)}`);
                  }
                }}
                onGoToFloor={() => void router.push("/waiter/floor")}
              />
            )}
          </aside>
        </div>
      )}

      {reservationsQuery.isFetching && !reservationsQuery.isLoading ? (
        <div className="fixed bottom-24 right-8 z-40 rounded-lg bg-surface px-4 py-3 text-sm font-semibold text-text-secondary shadow-panel">
          Refreshing reservations
        </div>
      ) : null}

      {activeFilter === "late" && reservationsQuery.isSuccess && visibleReservations.length > 0 ? (
        <StatusMessage tone="warning" title="Late reservations">
          Late means scheduled time has passed and the reservation is not seated or terminal.
        </StatusMessage>
      ) : null}

      {selectedReservation?.status.raw === "PENDING" ? (
        <div className="flex items-center gap-2 text-sm font-semibold text-text-muted">
          <WarningCircle size={18} weight="bold" aria-hidden />
          <span>Pending reservations are read-only for waiters until a manager confirms them.</span>
        </div>
      ) : null}

      {selectedReservation?.seatedOrderId ? (
        <div className="sr-only" aria-live="polite">
          Reservation has a linked order.
        </div>
      ) : null}
    </PageShell>
  );
}
