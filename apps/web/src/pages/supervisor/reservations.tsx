import { ArrowClockwise, CalendarPlus, CaretLeft, CaretRight, WarningCircle } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  SupervisorConfirmReservationDialog,
  SupervisorCreateReservationDialog,
  SupervisorAssignTableDialog,
  SupervisorCancelReservationDialog,
  SupervisorCompleteReservationDialog,
  SupervisorNoShowReservationDialog,
  SupervisorReservationRow,
  SupervisorReservationViewSelector,
  SupervisorReservationWorkspace,
  SupervisorReservationsDateToolbar,
  SupervisorSeatReservationDialog,
  type SupervisorReservationActionKind,
  type SupervisorReservationHistoryStatus,
} from "@/components/supervisor/reservations";
import { SupervisorShell } from "@/components/supervisor/shell";
import { Badge, Button, ErrorState, Skeleton } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useSupervisorContext } from "@/lib/supervisor/context";
import {
  fetchSupervisorActiveReservations,
  fetchSupervisorReservationDetail,
  fetchSupervisorReservationEvents,
  fetchSupervisorReservationHistory,
  groupSupervisorActiveReservations,
  isSupervisorReservationView,
  normalizeSupervisorReservations,
  shiftSupervisorReservationDate,
  supervisorReservationKeys,
  todayIsoDate,
  type SupervisorReservation,
  type SupervisorReservationView,
  type SupervisorReservationViewModel,
} from "@/lib/supervisor/reservations";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

// Active operational set is inherently bounded (a branch has a limited number of
// non-terminal reservations at once). One `scope=active` request feeds Arriving/
// Seated/Attention via client derivation — this is the single active-views query
// that replaces the old all/today/upcoming triple-fetch + browser merge. History
// is a separate, lazy, server-paginated `scope=history` query.
const ACTIVE_PAGE_SIZE = 50;
const HISTORY_PAGE_SIZE = 25;

function getErrorCopy(error: unknown) {
  if (error instanceof ApiError) {
    if (error.isForbidden) {
      return {
        title: "Reservations access blocked",
        description: "This supervisor account cannot read branch reservations.",
      };
    }
    if (error.isAuthError) {
      return { title: "Session expired", description: "Please log in again to continue." };
    }
    return { title: "Could not load reservations", description: error.message };
  }
  return {
    title: "Could not load reservations",
    description: error instanceof Error ? error.message : "Try again when the connection is stable.",
  };
}

function queryString(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function filterBySearch(rows: SupervisorReservationViewModel[], search: string) {
  const needle = search.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => row.searchText.includes(needle));
}

export default function SupervisorReservationsPage() {
  const router = useRouter();
  const { accessToken, branchId, clearSession, isAuthenticated, isSupervisor } = useAuth();
  const context = useSupervisorContext();

  const canQuery = Boolean(accessToken && branchId && isAuthenticated && isSupervisor);

  // ── URL-derived page state (Back/Forward/refresh stable) ──
  const view: SupervisorReservationView = isSupervisorReservationView(router.query.view)
    ? router.query.view
    : "arriving";
  const dateParam = queryString(router.query.date);
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayIsoDate();
  const page = Math.max(1, Number.parseInt(queryString(router.query.page) || "1", 10) || 1);
  const historyStatusParam = queryString(router.query.status);
  const historyStatus: SupervisorReservationHistoryStatus =
    historyStatusParam === "COMPLETED" ||
    historyStatusParam === "CANCELLED" ||
    historyStatusParam === "NO_SHOW"
      ? historyStatusParam
      : "all";
  const historyFrom = queryString(router.query.from) || "";
  const historyTo = queryString(router.query.to) || "";
  const selectedReservationId = queryString(router.query.selected);
  const tableId = queryString(router.query.tableId);

  const [search, setSearch] = useState("");
  const [activeAction, setActiveAction] = useState<SupervisorReservationActionKind | "create" | null>(
    null,
  );

  const updateQuery = useCallback(
    (patch: Record<string, string | undefined>) => {
      const nextQuery: Record<string, string | string[] | undefined> = { ...router.query };
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === "") delete nextQuery[key];
        else nextQuery[key] = value;
      }
      void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
    },
    [router],
  );

  const selectView = useCallback(
    (nextView: SupervisorReservationView) => {
      setSearch("");
      updateQuery({ view: nextView, page: undefined });
    },
    [updateQuery],
  );

  const selectReservation = useCallback(
    (id: string | null) => updateQuery({ selected: id || undefined }),
    [updateQuery],
  );

  // ── Active query (Arriving / Seated / Attention + tab counts) ──
  const activeQuery = useQuery({
    queryKey: supervisorReservationKeys.active({ pageSize: ACTIVE_PAGE_SIZE, tableId: tableId || undefined }),
    enabled: canQuery,
    queryFn: () =>
      fetchSupervisorActiveReservations(accessToken as string, branchId as string, {
        pageSize: ACTIVE_PAGE_SIZE,
        tableId: tableId || undefined,
      }),
    retry: 1,
    staleTime: 10_000,
  });

  // ── History query (lazy — only on the History view) ──
  const historyQuery = useQuery({
    queryKey: supervisorReservationKeys.history({
      page,
      pageSize: HISTORY_PAGE_SIZE,
      status: historyStatus === "all" ? undefined : historyStatus,
      from: historyFrom || undefined,
      to: historyTo || undefined,
      tableId: tableId || undefined,
    }),
    enabled: canQuery && view === "history",
    queryFn: () =>
      fetchSupervisorReservationHistory(accessToken as string, branchId as string, {
        page,
        pageSize: HISTORY_PAGE_SIZE,
        status: historyStatus === "all" ? undefined : historyStatus,
        from: historyFrom || undefined,
        to: historyTo || undefined,
        tableId: tableId || undefined,
      }),
    retry: 1,
    staleTime: 10_000,
  });

  // ── Detail + events (selected reservation) ──
  const detailQuery = useQuery({
    queryKey: supervisorReservationKeys.detail(selectedReservationId || "none"),
    enabled: canQuery && Boolean(selectedReservationId),
    queryFn: () =>
      fetchSupervisorReservationDetail(accessToken as string, branchId as string, selectedReservationId as string),
    retry: 1,
    staleTime: 8_000,
  });

  const eventsQuery = useQuery({
    queryKey: supervisorReservationKeys.events(selectedReservationId || "none"),
    enabled: canQuery && Boolean(selectedReservationId),
    queryFn: () =>
      fetchSupervisorReservationEvents(accessToken as string, branchId as string, selectedReservationId as string),
    retry: 1,
    staleTime: 8_000,
  });

  // ── Session expiry ──
  useEffect(() => {
    const errors = [activeQuery.error, historyQuery.error, detailQuery.error, eventsQuery.error];
    if (errors.some((error) => error instanceof ApiError && error.isAuthError)) clearSession();
  }, [activeQuery.error, historyQuery.error, detailQuery.error, eventsQuery.error, clearSession]);

  // ── Derived groupings ──
  const activeModels = useMemo(
    () => normalizeSupervisorReservations(activeQuery.data?.data || []),
    [activeQuery.data],
  );
  const groups = useMemo(
    () => groupSupervisorActiveReservations(activeModels, date),
    [activeModels, date],
  );
  const historyModels = useMemo(
    () => normalizeSupervisorReservations(historyQuery.data?.data || []),
    [historyQuery.data],
  );

  const listRows = useMemo(() => {
    if (view === "history") return filterBySearch(historyModels, search);
    if (view === "seated") return filterBySearch(groups.seated, search);
    if (view === "attention") return filterBySearch(groups.attention, search);
    return filterBySearch(groups.arriving, search);
  }, [view, historyModels, groups, search]);

  const counts = useMemo(
    () => ({
      arriving: groups.counts.arriving,
      seated: groups.counts.seated,
      attention: groups.counts.attention,
      history: view === "history" ? historyQuery.data?.total ?? null : null,
    }),
    [groups.counts, view, historyQuery.data],
  );

  const historyTotalPages = historyQuery.data?.totalPages ?? 1;

  // Recover from an out-of-range page after the last row on a page transitions.
  useEffect(() => {
    if (view === "history" && historyQuery.data && page > historyTotalPages) {
      updateQuery({ page: String(historyTotalPages) });
    }
  }, [view, historyQuery.data, page, historyTotalPages, updateQuery]);

  const selectedRaw = useMemo<SupervisorReservation | null>(() => {
    if (!selectedReservationId) return null;
    const fromList = [...activeModels, ...historyModels].find((row) => row.id === selectedReservationId);
    return fromList?.raw || null;
  }, [selectedReservationId, activeModels, historyModels]);

  const selectedReservation = detailQuery.data || selectedRaw;

  const listLoading = view === "history" ? historyQuery.isLoading : activeQuery.isLoading;
  const listFetching = view === "history" ? historyQuery.isFetching : activeQuery.isFetching;
  const blockingError = view === "history" ? historyQuery.error : activeQuery.error;
  const errorCopy = blockingError ? getErrorCopy(blockingError) : null;

  const activeTruncated =
    view !== "history" &&
    activeQuery.data &&
    activeQuery.data.total > (activeQuery.data.data?.length || 0);

  const hasActiveFilters =
    Boolean(search) ||
    (view === "arriving" && date !== todayIsoDate()) ||
    (view === "history" && (historyStatus !== "all" || Boolean(historyFrom) || Boolean(historyTo)));

  function clearFilters() {
    setSearch("");
    updateQuery({ date: undefined, status: undefined, from: undefined, to: undefined, page: undefined });
  }

  function handleActionCompleted(result: SupervisorReservation) {
    setActiveAction(null);
    // Keep the selected reservation open; its detail cache already holds the
    // canonical row. Terminal transitions simply render read-only here.
    selectReservation(result.id);
  }

  function handleCreated(reservation: SupervisorReservation) {
    setActiveAction(null);
    const created = reservation.reservationAt?.slice(0, 10);
    updateQuery({
      view: "arriving",
      date: created && /^\d{4}-\d{2}-\d{2}$/.test(created) ? created : date,
      selected: reservation.id,
      page: undefined,
    });
  }

  const emptyCopy: Record<SupervisorReservationView, string> = {
    arriving: "No arrivals for this date.",
    seated: "No seated reservations.",
    attention: "No reservations need attention.",
    history: "No reservation history matches these filters.",
  };

  return (
    <SupervisorShell>
      <section className="space-y-5" aria-labelledby="supervisor-reservations-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-normal text-text-muted">
              Front-door control
            </p>
            <h1
              id="supervisor-reservations-title"
              className="mt-1 text-3xl font-bold tracking-normal text-text-primary"
            >
              Reservations
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="info">{context.branchName}</Badge>
              {tableId ? (
                <button
                  type="button"
                  onClick={() => updateQuery({ tableId: undefined })}
                  className="inline-flex items-center gap-1 rounded-full bg-status-neutral-surface px-2.5 py-1 text-xs font-semibold text-status-neutral hover:bg-brand-white focus-visible:shadow-focus focus-visible:outline-none"
                >
                  Filtered to one table · clear
                </button>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="compact"
              leadingIcon={<ArrowClockwise size={18} weight="bold" aria-hidden />}
              onClick={() => (view === "history" ? historyQuery.refetch() : activeQuery.refetch())}
              disabled={listFetching}
            >
              Refresh
            </Button>
            <Button
              size="compact"
              leadingIcon={<CalendarPlus size={18} weight="bold" aria-hidden />}
              onClick={() => setActiveAction("create")}
            >
              Create reservation
            </Button>
          </div>
        </div>

        <SupervisorReservationViewSelector view={view} counts={counts} onSelect={selectView} />

        <SupervisorReservationsDateToolbar
          view={view}
          date={date}
          search={search}
          historyStatus={historyStatus}
          historyFrom={historyFrom}
          historyTo={historyTo}
          hasActiveFilters={hasActiveFilters}
          onDateChange={(next) => updateQuery({ date: next, page: undefined })}
          onShiftDay={(delta) => updateQuery({ date: shiftSupervisorReservationDate(date, delta), page: undefined })}
          onToday={() => updateQuery({ date: undefined, page: undefined })}
          onSearchChange={setSearch}
          onHistoryStatusChange={(next) => updateQuery({ status: next === "all" ? undefined : next, page: undefined })}
          onHistoryFromChange={(next) => updateQuery({ from: next || undefined, page: undefined })}
          onHistoryToChange={(next) => updateQuery({ to: next || undefined, page: undefined })}
          onClearFilters={clearFilters}
        />

        {errorCopy ? (
          <div className="space-y-3">
            <ErrorState title={errorCopy.title} description={errorCopy.description} />
            <Button
              variant="secondary"
              onClick={() => (view === "history" ? historyQuery.refetch() : activeQuery.refetch())}
            >
              Retry
            </Button>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_480px] xl:items-start">
            <div
              id="supervisor-reservation-list-region"
              role="tabpanel"
              aria-labelledby={`supervisor-reservation-tab-${view}`}
              className="space-y-3"
            >
              {activeTruncated ? (
                <div className="flex items-center gap-2 rounded-md bg-status-info-surface px-3 py-2 text-sm font-semibold text-status-info">
                  <WarningCircle size={16} weight="bold" aria-hidden />
                  Showing the first {activeQuery.data?.data?.length} active reservations of {activeQuery.data?.total}.
                </div>
              ) : null}

              {listLoading ? (
                <div className="space-y-2" aria-busy>
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="h-24 w-full rounded-lg" />
                  ))}
                </div>
              ) : listRows.length === 0 ? (
                <div className="rounded-lg bg-surface-muted px-4 py-10 text-center">
                  <p className="text-base font-semibold text-text-primary">{emptyCopy[view]}</p>
                  {search ? (
                    <p className="mt-1 text-sm text-text-secondary">
                      No reservations on this page match “{search}”.
                    </p>
                  ) : null}
                </div>
              ) : (
                <ul className="space-y-2">
                  {listRows.map((reservation) => (
                    <li key={reservation.id}>
                      <SupervisorReservationRow
                        reservation={reservation}
                        view={view}
                        selected={reservation.id === selectedReservationId}
                        onSelect={(row) => selectReservation(row.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}

              {view === "history" && historyQuery.data && historyTotalPages > 1 ? (
                <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-muted px-3 py-2">
                  <Button
                    variant="tertiary"
                    size="compact"
                    leadingIcon={<CaretLeft size={16} weight="bold" aria-hidden />}
                    disabled={page <= 1 || historyQuery.isFetching}
                    onClick={() => updateQuery({ page: String(Math.max(1, page - 1)) })}
                  >
                    Previous
                  </Button>
                  <span className="text-sm font-semibold text-text-secondary">
                    Page {page} of {historyTotalPages}
                  </span>
                  <Button
                    variant="tertiary"
                    size="compact"
                    disabled={page >= historyTotalPages || historyQuery.isFetching}
                    onClick={() => updateQuery({ page: String(Math.min(historyTotalPages, page + 1)) })}
                  >
                    Next
                    <CaretRight size={16} weight="bold" aria-hidden />
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="xl:sticky xl:top-24">
              <SupervisorReservationWorkspace
                reservation={selectedReservation}
                detail={detailQuery.data}
                events={eventsQuery.data}
                deposits={detailQuery.data?.deposits}
                isLoading={detailQuery.isLoading}
                eventsLoading={eventsQuery.isLoading}
                detailError={
                  detailQuery.error instanceof Error && !detailQuery.data ? detailQuery.error.message : null
                }
                onClose={() => selectReservation(null)}
                onRequestAction={(action) => setActiveAction(action)}
              />
            </div>
          </div>
        )}
      </section>

      {activeAction === "create" && accessToken && branchId ? (
        <SupervisorCreateReservationDialog
          token={accessToken}
          branchId={branchId}
          defaultDate={date}
          onClose={() => setActiveAction(null)}
          onCreated={handleCreated}
        />
      ) : null}

      {activeAction && activeAction !== "create" && selectedReservation && accessToken && branchId ? (
        <ReservationActionDialog
          action={activeAction}
          reservation={selectedReservation}
          token={accessToken}
          branchId={branchId}
          onClose={() => setActiveAction(null)}
          onCompleted={handleActionCompleted}
        />
      ) : null}
    </SupervisorShell>
  );
}

function ReservationActionDialog({
  action,
  branchId,
  onClose,
  onCompleted,
  reservation,
  token,
}: {
  action: SupervisorReservationActionKind;
  reservation: SupervisorReservation;
  token: string;
  branchId: string;
  onClose: () => void;
  onCompleted: (result: SupervisorReservation) => void;
}) {
  const shared = { reservation, token, branchId, onClose, onCompleted };
  switch (action) {
    case "confirm":
      return <SupervisorConfirmReservationDialog {...shared} />;
    case "seat":
      return <SupervisorSeatReservationDialog {...shared} />;
    case "assign-table":
      return <SupervisorAssignTableDialog {...shared} mode="assign" />;
    case "change-table":
      return <SupervisorAssignTableDialog {...shared} mode="change" />;
    case "cancel":
      return <SupervisorCancelReservationDialog {...shared} />;
    case "no-show":
      return <SupervisorNoShowReservationDialog {...shared} />;
    case "complete":
      return <SupervisorCompleteReservationDialog {...shared} />;
    default:
      return null;
  }
}
