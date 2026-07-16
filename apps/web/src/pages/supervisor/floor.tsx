import { ArrowClockwise, GridFour, MapTrifold, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import { Badge, Button, Card, ErrorState, StatusMessage } from "@/components/ui";
import { SupervisorShell } from "@/components/supervisor/shell";
import { SupervisorCaveatBanner, SupervisorEmptyState } from "@/components/supervisor/states";
import {
  SupervisorFloorSummary,
  SupervisorFloorToolbar,
  SupervisorTableDetailPanel,
  SupervisorTableGrid,
} from "@/components/supervisor/floor";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  fetchSupervisorFloorAvailability,
  fetchSupervisorFloorPlanDetail,
  fetchSupervisorFloorPlans,
  fetchSupervisorTableDetail,
  fetchSupervisorTables,
  updateSupervisorTableStatus,
  type SupervisorTableStatus,
} from "@/lib/supervisor/floor";
import {
  countSupervisorTables,
  filterSupervisorTables,
  getFloorPlanDataSummary,
  normalizeSupervisorTables,
  type SupervisorFloorFilter,
  type SupervisorTableViewModel,
} from "@/lib/supervisor/floor-model";
import { useSupervisorContext, useSupervisorReadiness } from "@/lib/supervisor/context";
import { supervisorCaveats } from "@/lib/supervisor/state";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

function getErrorCopy(error: unknown) {
  if (error instanceof ApiError) {
    if (error.isForbidden) {
      return {
        title: "Floor access blocked",
        description: "This supervisor account does not have permission to read branch floor data.",
      };
    }

    if (error.isAuthError) {
      return {
        title: "Session expired",
        description: "Please log in again to continue.",
      };
    }

    return {
      title: "Could Not Load Floor",
      description: error.message,
    };
  }

  return {
    title: "Could Not Load Floor",
    description: error instanceof Error ? error.message : "Try again when the connection is stable.",
  };
}

function availabilityTone({
  availabilityFailed,
  loading,
  tableCount,
}: {
  availabilityFailed: boolean;
  loading: boolean;
  tableCount: number;
}) {
  if (loading) return { label: "Floor Loading", tone: "neutral" as const };
  if (availabilityFailed) return { label: "Availability Partial", tone: "warning" as const };
  if (tableCount === 0) return { label: "No Tables Loaded", tone: "warning" as const };
  return { label: `${tableCount} Tables Loaded`, tone: "success" as const };
}

function selectedTableIdFromQuery(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

export default function SupervisorFloorPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, branchId, clearSession, isAuthenticated, isSupervisor } = useAuth();
  const context = useSupervisorContext();
  const readiness = useSupervisorReadiness();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SupervisorFloorFilter>("all");
  const [selectedFloorPlanId, setSelectedFloorPlanId] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const canQuery = Boolean(accessToken && branchId && isAuthenticated && isSupervisor);
  const canUpdateStatus = context.permissions.includes("pos:table:write");

  const floorPlansQuery = useQuery({
    queryKey: ["supervisor", "floor-plans", branchId],
    enabled: canQuery,
    queryFn: () => fetchSupervisorFloorPlans(accessToken as string, branchId as string),
    retry: 1,
    staleTime: 20_000,
  });

  const tablesQuery = useQuery({
    queryKey: ["supervisor", "tables", branchId],
    enabled: canQuery,
    queryFn: () => fetchSupervisorTables(accessToken as string, branchId as string),
    retry: 1,
    staleTime: 15_000,
  });

  const availabilityQuery = useQuery({
    queryKey: ["supervisor", "floor-availability", branchId],
    enabled: canQuery,
    queryFn: () => fetchSupervisorFloorAvailability(accessToken as string, branchId as string),
    retry: 1,
    staleTime: 15_000,
  });

  const floorPlanDetailQuery = useQuery({
    queryKey: ["supervisor", "floor-plan-detail", branchId, selectedFloorPlanId],
    enabled: canQuery && Boolean(selectedFloorPlanId),
    queryFn: () =>
      fetchSupervisorFloorPlanDetail(
        accessToken as string,
        branchId as string,
        selectedFloorPlanId as string,
      ),
    retry: 1,
    staleTime: 20_000,
  });

  const tableDetailQuery = useQuery({
    queryKey: ["supervisor", "table-detail", branchId, selectedTableId],
    enabled: canQuery && Boolean(selectedTableId),
    queryFn: () =>
      fetchSupervisorTableDetail(accessToken as string, branchId as string, selectedTableId as string),
    retry: 1,
    staleTime: 10_000,
  });

  useEffect(() => {
    const errors = [
      floorPlansQuery.error,
      tablesQuery.error,
      availabilityQuery.error,
      floorPlanDetailQuery.error,
      tableDetailQuery.error,
    ];

    if (errors.some((error) => error instanceof ApiError && error.isAuthError)) {
      clearSession();
    }
  }, [
    availabilityQuery.error,
    clearSession,
    floorPlanDetailQuery.error,
    floorPlansQuery.error,
    tableDetailQuery.error,
    tablesQuery.error,
  ]);

  useEffect(() => {
    const plans = floorPlansQuery.data || [];
    if (!selectedFloorPlanId && plans.length === 1) {
      setSelectedFloorPlanId(plans[0].id);
    }
  }, [floorPlansQuery.data, selectedFloorPlanId]);

  useEffect(() => {
    if (!router.isReady) return;
    const routeTableId = selectedTableIdFromQuery(router.query.tableId);
    if (routeTableId && routeTableId !== selectedTableId) {
      setSelectedTableId(routeTableId);
      setStatusMessage(null);
    }
  }, [router.isReady, router.query.tableId, selectedTableId]);

  const tables = useMemo(
    () => normalizeSupervisorTables(tablesQuery.data || []),
    [tablesQuery.data],
  );

  const counts = useMemo(
    () => countSupervisorTables(tables, availabilityQuery.data),
    [availabilityQuery.data, tables],
  );

  const filteredTables = useMemo(
    () =>
      filterSupervisorTables({
        floorPlanId: selectedFloorPlanId,
        filter,
        query,
        tables,
      }),
    [filter, query, selectedFloorPlanId, tables],
  );

  const selectedTable = useMemo<SupervisorTableViewModel | null>(
    () => tables.find((table) => table.id === selectedTableId) || null,
    [selectedTableId, tables],
  );

  const floorLoad = availabilityTone({
    availabilityFailed: availabilityQuery.isError,
    loading: floorPlansQuery.isLoading || tablesQuery.isLoading,
    tableCount: tables.length,
  });

  const statusMutation = useMutation({
    mutationFn: (status: SupervisorTableStatus) =>
      updateSupervisorTableStatus({
        token: accessToken as string,
        branchId: branchId as string,
        tableId: selectedTableId as string,
        status,
      }),
    onSuccess: (updated) => {
      setStatusMessage(`${updated.label || "Table"} is now ${updated.status || "updated"}.`);
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "tables", branchId] });
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "floor-availability", branchId] });
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "table-detail", branchId, selectedTableId] });
    },
  });

  function refreshFloor() {
    void floorPlansQuery.refetch();
    void tablesQuery.refetch();
    void availabilityQuery.refetch();
    if (selectedFloorPlanId) void floorPlanDetailQuery.refetch();
    if (selectedTableId) void tableDetailQuery.refetch();
  }

  function handleSelectTable(table: SupervisorTableViewModel) {
    setSelectedTableId(table.id);
    setStatusMessage(null);
  }

  const blockingError = floorPlansQuery.error || tablesQuery.error;
  const errorCopy = blockingError ? getErrorCopy(blockingError) : null;
  const hasNoFloorPlans = !floorPlansQuery.isLoading && !floorPlansQuery.isError && (floorPlansQuery.data || []).length === 0;
  const hasNoTables = !tablesQuery.isLoading && !tablesQuery.isError && tables.length === 0;

  return (
    <SupervisorShell>
      <section className="space-y-6" aria-labelledby="supervisor-floor-title">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-normal text-text-muted">
              Supervisor workspace
            </p>
            <h1
              id="supervisor-floor-title"
              className="mt-2 text-balance text-3xl font-bold tracking-normal text-text-primary"
            >
              Floor Control
            </h1>
            <p className="mt-2 max-w-3xl text-base leading-7 text-text-secondary">
              Monitor tables, availability, reservations, and service exceptions for this branch.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant="info">{context.branchName}</Badge>
              <Badge variant={readiness.shift.tone === "success" ? "success" : readiness.shift.tone === "warning" ? "warning" : "neutral"}>
                {readiness.shift.label}
              </Badge>
              <Badge variant={floorLoad.tone}>{floorLoad.label}</Badge>
            </div>
          </div>
          <Button
            className="shrink-0"
            variant="secondary"
            size="pos"
            leadingIcon={<ArrowClockwise size={22} weight="bold" aria-hidden />}
            onClick={refreshFloor}
            disabled={floorPlansQuery.isFetching || tablesQuery.isFetching || availabilityQuery.isFetching}
          >
            Refresh floor
          </Button>
        </div>

        <StatusMessage tone="info" title="Supervisor floor control uses live table and floor APIs.">
          Order and reservation handoffs open their dedicated read surfaces.
        </StatusMessage>

        <SupervisorFloorSummary counts={counts} />

        {availabilityQuery.isError && !tablesQuery.isError ? (
          <StatusMessage tone="warning" title="Availability load failed">
            Table data loaded, but `/api/floor/availability` did not. Counts fall back to the table list.
          </StatusMessage>
        ) : null}

        {errorCopy ? (
          <ErrorState title={errorCopy.title} description={errorCopy.description} />
        ) : hasNoFloorPlans ? (
          <SupervisorEmptyState
            icon={<MapTrifold size={28} weight="duotone" aria-hidden />}
            title="No floor plan is available for this branch."
            description="The backend returned zero floor plans. Tables will appear below if they exist without a floor plan."
            note="No fake map or floor geometry is shown."
          />
        ) : null}

        {!errorCopy ? (
          <>
            <SupervisorFloorToolbar
              query={query}
              filter={filter}
              counts={counts}
              floorPlans={floorPlansQuery.data || []}
              selectedFloorPlanId={selectedFloorPlanId}
              onQueryChange={setQuery}
              onFilterChange={setFilter}
              onFloorPlanChange={setSelectedFloorPlanId}
            />

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
              <div className="space-y-4">
                {selectedFloorPlanId ? (
                  <Card className="bg-surface-muted">
                    <div className="flex items-start gap-3">
                      <GridFour size={22} weight="bold" className="shrink-0 text-brand-navy-900" aria-hidden />
                      <div className="min-w-0">
                        <h2 className="text-lg font-bold tracking-normal text-text-primary">
                          {floorPlanDetailQuery.data?.name || "Selected Floor Plan"}
                        </h2>
                        <p className="mt-1 text-sm leading-6 text-text-secondary">
                          {getFloorPlanDataSummary(floorPlanDetailQuery.data)}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-text-secondary">
                          Coordinate-driven map rendering is deferred unless backend metadata provides reliable positions.
                        </p>
                      </div>
                    </div>
                  </Card>
                ) : null}

                <SupervisorTableGrid
                  tables={filteredTables}
                  selectedTableId={selectedTableId}
                  isLoading={tablesQuery.isLoading}
                  onSelectTable={handleSelectTable}
                />

                {hasNoTables ? (
                  <div className="flex items-center gap-2 text-sm font-medium text-text-muted">
                    <WarningCircle size={18} weight="bold" aria-hidden />
                    <span>No active tables were returned for this branch.</span>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4 xl:sticky xl:top-36">
                <SupervisorTableDetailPanel
                  table={selectedTable}
                  detail={tableDetailQuery.data}
                  isDetailLoading={tableDetailQuery.isLoading}
                  canUpdateStatus={canUpdateStatus}
                  isUpdatingStatus={statusMutation.isPending}
                  updateError={statusMutation.error instanceof Error ? statusMutation.error.message : null}
                  updateSuccess={statusMessage}
                  ordersHref={
                    selectedTableId
                      ? `/supervisor/orders?tableId=${encodeURIComponent(selectedTableId)}`
                      : null
                  }
                  reservationsHref={
                    selectedTableId
                      ? `/supervisor/reservations?tableId=${encodeURIComponent(selectedTableId)}`
                      : null
                  }
                  onUpdateStatus={(status) => statusMutation.mutate(status)}
                  onClose={() => setSelectedTableId(null)}
                />
                <SupervisorCaveatBanner
                  title={supervisorCaveats.receiptsDevices}
                  description="Receipt, device, printer, terminal, accounting, billing, franchise, and developer surfaces stay outside Supervisor Floor."
                  icon="excluded"
                  tone="neutral"
                />
              </div>
            </div>
          </>
        ) : null}
      </section>
    </SupervisorShell>
  );
}
