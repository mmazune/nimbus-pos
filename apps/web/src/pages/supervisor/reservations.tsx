import { ArrowClockwise, CalendarCheck, WarningCircle } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import { Button, ErrorState, StatusMessage } from "@/components/ui";
import {
  SupervisorReservationDetailPanel,
  SupervisorReservationList,
  SupervisorReservationsSummary,
  SupervisorReservationsToolbar,
} from "@/components/supervisor/reservations";
import { SupervisorShell } from "@/components/supervisor/shell";
import { SupervisorCaveatBanner } from "@/components/supervisor/states";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useSupervisorContext, useSupervisorReadiness } from "@/lib/supervisor/context";
import {
  countSupervisorReservations,
  fetchSupervisorReservationDeposits,
  fetchSupervisorReservationDetail,
  fetchSupervisorReservationEvents,
  fetchSupervisorReservations,
  fetchSupervisorUpcomingReservations,
  filterSupervisorReservations,
  mergeSupervisorReservationRows,
  normalizeSupervisorReservations,
  sortSupervisorReservations,
  todayIsoDate,
  type SupervisorReservation,
  type SupervisorReservationFilter,
  type SupervisorReservationSort,
} from "@/lib/supervisor/reservations";
import { supervisorCaveats } from "@/lib/supervisor/state";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

function getErrorCopy(error: unknown) {
  if (error instanceof ApiError) {
    if (error.isForbidden) {
      return {
        title: "Reservations access blocked",
        description: "This supervisor account does not have permission to read branch reservations.",
      };
    }

    if (error.isAuthError) {
      return {
        title: "Session expired",
        description: "Please log in again to continue.",
      };
    }

    return {
      title: "Could Not Load Reservations",
      description: error.message,
    };
  }

  return {
    title: "Could Not Load Reservations",
    description: error instanceof Error ? error.message : "Try again when the connection is stable.",
  };
}

function selectedTableIdFromQuery(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
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

export default function SupervisorReservationsPage() {
  const router = useRouter();
  const { accessToken, branchId, clearSession, isAuthenticated, isSupervisor } = useAuth();
  const context = useSupervisorContext();
  const readiness = useSupervisorReadiness();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SupervisorReservationFilter>("all");
  const [sort, setSort] = useState<SupervisorReservationSort>("time-asc");
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);

  const tableId = selectedTableIdFromQuery(router.query.tableId);
  const canQuery = Boolean(accessToken && branchId && isAuthenticated && isSupervisor);

  const allReservationsQuery = useQuery({
    queryKey: ["supervisor", "reservations", branchId, tableId],
    enabled: canQuery,
    queryFn: () =>
      fetchSupervisorReservations(accessToken as string, branchId as string, {
        page: 1,
        pageSize: 100,
        tableId: tableId || undefined,
      }),
    retry: 1,
    staleTime: 10_000,
  });

  const todayReservationsQuery = useQuery({
    queryKey: ["supervisor", "reservations-today", branchId, tableId],
    enabled: canQuery,
    queryFn: () =>
      fetchSupervisorReservations(accessToken as string, branchId as string, {
        date: todayIsoDate(),
        page: 1,
        pageSize: 100,
        tableId: tableId || undefined,
      }),
    retry: 1,
    staleTime: 10_000,
  });

  const upcomingReservationsQuery = useQuery({
    queryKey: ["supervisor", "reservations-upcoming", branchId, tableId],
    enabled: canQuery,
    queryFn: async () => {
      if (tableId) {
        const response = await fetchSupervisorReservations(accessToken as string, branchId as string, {
          upcoming: true,
          page: 1,
          pageSize: 100,
          tableId,
        });
        return response.data;
      }

      return fetchSupervisorUpcomingReservations(accessToken as string, branchId as string);
    },
    retry: 1,
    staleTime: 10_000,
  });

  const reservations = useMemo(() => {
    const rows = mergeSupervisorReservationRows(
      allReservationsQuery.data?.data || [],
      todayReservationsQuery.data?.data || [],
      upcomingReservationsQuery.data || [],
    );
    return normalizeSupervisorReservations(rows);
  }, [allReservationsQuery.data, todayReservationsQuery.data, upcomingReservationsQuery.data]);

  const selectedReservation = useMemo(
    () => reservations.find((reservation) => reservation.id === selectedReservationId) || null,
    [reservations, selectedReservationId],
  );

  const selectedReservationDetailQuery = useQuery({
    queryKey: ["supervisor", "reservation-detail", branchId, selectedReservationId],
    enabled: canQuery && Boolean(selectedReservationId),
    queryFn: () =>
      fetchSupervisorReservationDetail(
        accessToken as string,
        branchId as string,
        selectedReservationId as string,
      ),
    retry: 1,
    staleTime: 8_000,
  });

  const selectedReservationDepositsQuery = useQuery({
    queryKey: ["supervisor", "reservation-deposits", branchId, selectedReservationId],
    enabled: canQuery && Boolean(selectedReservationId),
    queryFn: () =>
      fetchSupervisorReservationDeposits(
        accessToken as string,
        branchId as string,
        selectedReservationId as string,
      ),
    retry: 1,
    staleTime: 8_000,
  });

  const selectedReservationEventsQuery = useQuery({
    queryKey: ["supervisor", "reservation-events", branchId, selectedReservationId],
    enabled: canQuery && Boolean(selectedReservationId),
    queryFn: () =>
      fetchSupervisorReservationEvents(
        accessToken as string,
        branchId as string,
        selectedReservationId as string,
      ),
    retry: 1,
    staleTime: 8_000,
  });

  useEffect(() => {
    const errors = [
      allReservationsQuery.error,
      todayReservationsQuery.error,
      upcomingReservationsQuery.error,
      selectedReservationDetailQuery.error,
      selectedReservationDepositsQuery.error,
      selectedReservationEventsQuery.error,
    ];

    if (errors.some((error) => error instanceof ApiError && error.isAuthError)) {
      clearSession();
    }
  }, [
    allReservationsQuery.error,
    clearSession,
    selectedReservationDepositsQuery.error,
    selectedReservationDetailQuery.error,
    selectedReservationEventsQuery.error,
    todayReservationsQuery.error,
    upcomingReservationsQuery.error,
  ]);

  useEffect(() => {
    if (selectedReservationId && !reservations.some((reservation) => reservation.id === selectedReservationId)) {
      setSelectedReservationId(null);
    }
  }, [reservations, selectedReservationId]);

  const filteredReservations = useMemo(
    () =>
      sortSupervisorReservations(
        filterSupervisorReservations({
          filter,
          query,
          reservations,
          tableId,
        }),
        sort,
      ),
    [filter, query, reservations, sort, tableId],
  );

  const counts = useMemo(() => countSupervisorReservations(reservations), [reservations]);

  const tableFilterLabel = useMemo(() => {
    if (!tableId) return null;
    const tableReservation = reservations.find((reservation) => reservation.tableId === tableId);
    return tableReservation ? tableReservation.tableLabel : tableId;
  }, [reservations, tableId]);

  function refreshReservations() {
    void allReservationsQuery.refetch();
    void todayReservationsQuery.refetch();
    void upcomingReservationsQuery.refetch();
    if (selectedReservationId) {
      void selectedReservationDetailQuery.refetch();
      void selectedReservationDepositsQuery.refetch();
      void selectedReservationEventsQuery.refetch();
    }
  }

  function clearTableFilter() {
    const nextQuery = { ...router.query };
    delete nextQuery.tableId;
    void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
  }

  const blockingError = allReservationsQuery.error || todayReservationsQuery.error || upcomingReservationsQuery.error;
  const errorCopy = blockingError ? getErrorCopy(blockingError) : null;
  const reservationsLoading =
    allReservationsQuery.isLoading || todayReservationsQuery.isLoading || upcomingReservationsQuery.isLoading;
  const reservationsFetching =
    allReservationsQuery.isFetching || todayReservationsQuery.isFetching || upcomingReservationsQuery.isFetching;

  return (
    <SupervisorShell>
      <section className="space-y-6" aria-labelledby="supervisor-reservations-title">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-normal text-text-muted">
              Front-door control
            </p>
            <h1
              id="supervisor-reservations-title"
              className="mt-2 text-balance text-3xl font-bold tracking-normal text-text-primary"
            >
              Reservations
            </h1>
            <p className="mt-2 max-w-4xl text-base leading-7 text-text-secondary">
              Monitor today&apos;s reservations, seating readiness, and table assignment without running deposit or admin workflows.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <StatusPill label={context.branchName} tone="info" />
              <StatusPill
                label={readiness.shift.label}
                tone={readiness.shift.tone === "success" ? "success" : readiness.shift.tone === "warning" ? "warning" : "neutral"}
              />
              <StatusPill
                label={`${reservations.length} reservation rows`}
                tone={reservations.length > 0 ? "success" : "neutral"}
              />
            </div>
          </div>
          <Button
            className="shrink-0"
            variant="secondary"
            size="pos"
            leadingIcon={<ArrowClockwise size={22} weight="bold" aria-hidden />}
            onClick={refreshReservations}
            disabled={reservationsFetching}
          >
            Refresh reservations
          </Button>
        </div>

        <StatusMessage tone="info" title="Read-only reservation oversight">
          Reservation actions and deposit recording remain unavailable on this Supervisor surface.
        </StatusMessage>

        <SupervisorReservationsSummary counts={counts} />

        {errorCopy ? (
          <ErrorState title={errorCopy.title} description={errorCopy.description} />
        ) : (
          <>
            {(selectedReservationDepositsQuery.error instanceof ApiError &&
              selectedReservationDepositsQuery.error.isForbidden) ||
            (selectedReservationEventsQuery.error instanceof ApiError &&
              selectedReservationEventsQuery.error.isForbidden) ? (
              <StatusMessage tone="warning" title="Reservation detail is partial">
                Reservation rows loaded, but this session cannot read at least one selected deposit or event feed.
              </StatusMessage>
            ) : null}

            <SupervisorReservationsToolbar
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
                <SupervisorReservationList
                  reservations={filteredReservations}
                  selectedReservationId={selectedReservationId}
                  isLoading={reservationsLoading}
                  onSelectReservation={(reservation) => setSelectedReservationId(reservation.id)}
                />

                {!reservationsLoading && reservations.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm font-medium text-text-muted">
                    <WarningCircle size={18} weight="bold" aria-hidden />
                    <span>No reservation rows were returned for this branch scope.</span>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4 xl:sticky xl:top-36">
                <SupervisorReservationDetailPanel
                  reservation={(selectedReservation?.raw as SupervisorReservation | undefined) || null}
                  detail={selectedReservationDetailQuery.data}
                  deposits={selectedReservationDepositsQuery.data}
                  events={selectedReservationEventsQuery.data}
                  isLoading={selectedReservationDetailQuery.isLoading}
                  depositsLoading={selectedReservationDepositsQuery.isLoading}
                  eventsLoading={selectedReservationEventsQuery.isLoading}
                  detailError={
                    selectedReservationDetailQuery.error instanceof Error
                      ? selectedReservationDetailQuery.error.message
                      : null
                  }
                  depositsError={
                    selectedReservationDepositsQuery.error instanceof Error
                      ? selectedReservationDepositsQuery.error.message
                      : null
                  }
                  eventsError={
                    selectedReservationEventsQuery.error instanceof Error
                      ? selectedReservationEventsQuery.error.message
                      : null
                  }
                  onClose={() => setSelectedReservationId(null)}
                />
                <SupervisorCaveatBanner
                  title={supervisorCaveats.receiptsDevices}
                  description="Reservation create, edit, confirm, assign table, seat, cancel, no-show, deposit, accounting, billing, franchise, device, and developer surfaces stay outside Supervisor Reservations."
                  icon="excluded"
                  tone="neutral"
                />
              </div>
            </div>
          </>
        )}

        {!errorCopy && !reservationsLoading && filteredReservations.length === 0 && reservations.length > 0 ? (
          <div className="flex items-center gap-2 text-sm font-medium text-text-muted">
            <CalendarCheck size={18} weight="bold" aria-hidden />
            <span>No loaded reservations match the current filter, search, and table scope.</span>
          </div>
        ) : null}
      </section>
    </SupervisorShell>
  );
}
