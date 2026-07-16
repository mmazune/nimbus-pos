import { ArrowClockwise, ShieldCheck, WarningCircle } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import type { GetServerSideProps } from "next";
import { useEffect, useMemo, useState } from "react";

import { Badge, Button, ErrorState, StatusMessage } from "@/components/ui";
import {
  SupervisorApprovalDetailPanel,
  SupervisorApprovalDomainCards,
  SupervisorApprovalQueue,
  SupervisorApprovalsSummary,
  SupervisorApprovalsToolbar,
} from "@/components/supervisor/approvals";
import { SupervisorShell } from "@/components/supervisor/shell";
import { SupervisorCaveatBanner } from "@/components/supervisor/states";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  countSupervisorApprovals,
  fetchSupervisorAnomalies,
  fetchSupervisorAnomalyDetail,
  fetchSupervisorDiscountDetail,
  fetchSupervisorLeaveRequests,
  fetchSupervisorPendingDiscounts,
  fetchSupervisorShiftSwaps,
  filterSupervisorApprovalItems,
  normalizeSupervisorApprovalItem,
  sortSupervisorApprovalItems,
  unavailableSupervisorApprovalDomains,
  type SupervisorApprovalDomainState,
  type SupervisorApprovalFilter,
  type SupervisorApprovalItem,
  type SupervisorApprovalSort,
} from "@/lib/supervisor/approvals";
import { useSupervisorContext, useSupervisorReadiness } from "@/lib/supervisor/context";
import { supervisorCaveats } from "@/lib/supervisor/state";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

function getErrorMessage(error: unknown) {
  if (!error) return null;
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : "Try again when the connection is stable.";
}

function hasAuthError(errors: unknown[]) {
  return errors.some((error) => error instanceof ApiError && error.isAuthError);
}

function domainState({
  available,
  count,
  endpoint,
  error,
  isLoading,
  label,
  permission,
  domain,
}: {
  domain: SupervisorApprovalDomainState["domain"];
  label: string;
  endpoint: string;
  permission: string;
  available: boolean;
  count: number | null;
  isLoading: boolean;
  error: unknown;
}): SupervisorApprovalDomainState {
  if (isLoading) {
    return {
      domain,
      label,
      endpoint,
      permission,
      available,
      readOnly: true,
      count: null,
      status: "loading",
    };
  }

  if (error) {
    return {
      domain,
      label,
      endpoint,
      permission,
      available,
      readOnly: true,
      count: null,
      status: "failed",
      error: getErrorMessage(error),
    };
  }

  return {
    domain,
    label,
    endpoint,
    permission,
    available,
    readOnly: true,
    count,
    status: "loaded",
  };
}

export default function SupervisorApprovalsPage() {
  const { accessToken, branchId, clearSession, isAuthenticated, isSupervisor } = useAuth();
  const context = useSupervisorContext();
  const readiness = useSupervisorReadiness();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SupervisorApprovalFilter>("all");
  const [sort, setSort] = useState<SupervisorApprovalSort>("newest");
  const [selectedItem, setSelectedItem] = useState<SupervisorApprovalItem | null>(null);

  const canQuery = Boolean(accessToken && branchId && isAuthenticated && isSupervisor);

  const discountsQuery = useQuery({
    queryKey: ["supervisor", "approvals", "discounts", branchId],
    enabled: canQuery,
    queryFn: () => fetchSupervisorPendingDiscounts(accessToken as string, branchId as string),
    retry: 1,
    staleTime: 10_000,
  });

  const leaveQuery = useQuery({
    queryKey: ["supervisor", "approvals", "leave", branchId],
    enabled: canQuery,
    queryFn: () => fetchSupervisorLeaveRequests(accessToken as string, branchId as string),
    retry: 1,
    staleTime: 10_000,
  });

  const shiftSwapsQuery = useQuery({
    queryKey: ["supervisor", "approvals", "shift-swaps", branchId],
    enabled: canQuery,
    queryFn: () => fetchSupervisorShiftSwaps(accessToken as string, branchId as string),
    retry: 1,
    staleTime: 10_000,
  });

  const anomaliesQuery = useQuery({
    queryKey: ["supervisor", "approvals", "anomalies", branchId],
    enabled: canQuery,
    queryFn: () => fetchSupervisorAnomalies(accessToken as string, branchId as string),
    retry: 1,
    staleTime: 10_000,
  });

  const discountDetailQuery = useQuery({
    queryKey: ["supervisor", "approval-detail", "discount", branchId, selectedItem?.id],
    enabled: canQuery && selectedItem?.domain === "discount",
    queryFn: () =>
      fetchSupervisorDiscountDetail(accessToken as string, branchId as string, selectedItem?.id as string),
    retry: 1,
    staleTime: 8_000,
  });

  const anomalyDetailQuery = useQuery({
    queryKey: ["supervisor", "approval-detail", "anomaly", branchId, selectedItem?.id],
    enabled: canQuery && selectedItem?.domain === "anomaly",
    queryFn: () =>
      fetchSupervisorAnomalyDetail(accessToken as string, branchId as string, selectedItem?.id as string),
    retry: 1,
    staleTime: 8_000,
  });

  useEffect(() => {
    const errors = [
      discountsQuery.error,
      leaveQuery.error,
      shiftSwapsQuery.error,
      anomaliesQuery.error,
      discountDetailQuery.error,
      anomalyDetailQuery.error,
    ];

    if (hasAuthError(errors)) {
      clearSession();
    }
  }, [
    anomaliesQuery.error,
    anomalyDetailQuery.error,
    clearSession,
    discountDetailQuery.error,
    discountsQuery.error,
    leaveQuery.error,
    shiftSwapsQuery.error,
  ]);

  const approvalItems = useMemo(() => {
    const discounts = (discountsQuery.data || []).map((discount) =>
      normalizeSupervisorApprovalItem("discount", discount),
    );
    const leave = (leaveQuery.data?.data || []).map((request) =>
      normalizeSupervisorApprovalItem("leave", request),
    );
    const shiftSwaps = (shiftSwapsQuery.data?.data || []).map((swap) =>
      normalizeSupervisorApprovalItem("shift-swap", swap),
    );
    const anomalies = (anomaliesQuery.data?.data || []).map((anomaly) =>
      normalizeSupervisorApprovalItem("anomaly", anomaly),
    );

    return [...discounts, ...leave, ...shiftSwaps, ...anomalies];
  }, [anomaliesQuery.data, discountsQuery.data, leaveQuery.data, shiftSwapsQuery.data]);

  useEffect(() => {
    if (selectedItem && !approvalItems.some((item) => item.id === selectedItem.id && item.domain === selectedItem.domain)) {
      setSelectedItem(null);
    }
  }, [approvalItems, selectedItem]);

  const counts = useMemo(() => countSupervisorApprovals(approvalItems), [approvalItems]);

  const domainStates = useMemo<SupervisorApprovalDomainState[]>(
    () => [
      domainState({
        domain: "discount",
        label: "Discount approvals",
        endpoint: "GET /api/pos/discounts/pending",
        permission: "pos:discount:approve",
        available: true,
        count: discountsQuery.data?.length ?? 0,
        isLoading: discountsQuery.isLoading,
        error: discountsQuery.error,
      }),
      ...unavailableSupervisorApprovalDomains,
      domainState({
        domain: "leave",
        label: "Leave review queue",
        endpoint: "GET /api/hr/leave?status=PENDING&take=50",
        permission: "pos:hr:leave:read",
        available: true,
        count: leaveQuery.data?.total ?? 0,
        isLoading: leaveQuery.isLoading,
        error: leaveQuery.error,
      }),
      domainState({
        domain: "shift-swap",
        label: "Shift swap queue",
        endpoint: "GET /api/hr/shift-swaps?status=PENDING&take=50",
        permission: "pos:hr:shift-swaps:read",
        available: true,
        count: shiftSwapsQuery.data?.total ?? 0,
        isLoading: shiftSwapsQuery.isLoading,
        error: shiftSwapsQuery.error,
      }),
      domainState({
        domain: "anomaly",
        label: "Anomaly acknowledgement queue",
        endpoint: "GET /api/analytics/anomalies?status=OPEN&limit=50",
        permission: "pos:analytics:anomalies:read",
        available: true,
        count: anomaliesQuery.data?.total ?? 0,
        isLoading: anomaliesQuery.isLoading,
        error: anomaliesQuery.error,
      }),
    ],
    [
      anomaliesQuery.data,
      anomaliesQuery.error,
      anomaliesQuery.isLoading,
      discountsQuery.data,
      discountsQuery.error,
      discountsQuery.isLoading,
      leaveQuery.data,
      leaveQuery.error,
      leaveQuery.isLoading,
      shiftSwapsQuery.data,
      shiftSwapsQuery.error,
      shiftSwapsQuery.isLoading,
    ],
  );

  const filteredItems = useMemo(
    () =>
      sortSupervisorApprovalItems(
        filterSupervisorApprovalItems({
          filter,
          items: approvalItems,
          query,
        }),
        sort,
      ),
    [approvalItems, filter, query, sort],
  );

  const anyLoading =
    discountsQuery.isLoading || leaveQuery.isLoading || shiftSwapsQuery.isLoading || anomaliesQuery.isLoading;
  const anyFetching =
    discountsQuery.isFetching || leaveQuery.isFetching || shiftSwapsQuery.isFetching || anomaliesQuery.isFetching;
  const allFailed =
    discountsQuery.isError && leaveQuery.isError && shiftSwapsQuery.isError && anomaliesQuery.isError;
  const detailLoading = discountDetailQuery.isLoading || anomalyDetailQuery.isLoading;
  const detailError = getErrorMessage(discountDetailQuery.error || anomalyDetailQuery.error);

  function refreshApprovals() {
    void discountsQuery.refetch();
    void leaveQuery.refetch();
    void shiftSwapsQuery.refetch();
    void anomaliesQuery.refetch();
    if (selectedItem?.domain === "discount") void discountDetailQuery.refetch();
    if (selectedItem?.domain === "anomaly") void anomalyDetailQuery.refetch();
  }

  return (
    <SupervisorShell>
      <section className="space-y-6" aria-labelledby="supervisor-approvals-title">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-normal text-text-muted">
              Controlled exception desk
            </p>
            <h1
              id="supervisor-approvals-title"
              className="mt-2 text-balance text-3xl font-bold tracking-normal text-text-primary"
            >
              Approvals
            </h1>
            <p className="mt-2 max-w-4xl text-base leading-7 text-text-secondary">
              Review domain-specific approval queues for discounts, refunds, voids, workforce requests, and anomalies.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant="info">{context.branchName}</Badge>
              <Badge variant={readiness.shift.tone === "success" ? "success" : readiness.shift.tone === "warning" ? "warning" : "neutral"}>
                {readiness.shift.label}
              </Badge>
              <Badge variant={counts.total > 0 ? "warning" : "neutral"}>
                {counts.total} available rows
              </Badge>
            </div>
          </div>
          <Button
            className="shrink-0"
            variant="secondary"
            size="pos"
            leadingIcon={<ArrowClockwise size={22} weight="bold" aria-hidden />}
            onClick={refreshApprovals}
            disabled={anyFetching}
          >
            Refresh approvals
          </Button>
        </div>

        <StatusMessage tone="info" title="Supervisor uses domain-specific approval APIs only">
          Supervisor does not use global /api/approvals in v1. This page uses domain-specific APIs only.
        </StatusMessage>

        <SupervisorApprovalsSummary counts={counts} domainStates={domainStates} />

        <SupervisorApprovalDomainCards states={domainStates} />

        <SupervisorCaveatBanner
          title={supervisorCaveats.globalApprovals}
          description="Global approvals inbox is unavailable for Supervisor v1. This role uses domain-specific queues only."
          icon="approval"
          tone="warning"
        />

        {allFailed ? (
          <ErrorState
            title="Approval queues could not load"
            description="Every verified domain read endpoint failed. The page did not fall back to global approvals."
          />
        ) : (
          <>
            <SupervisorApprovalsToolbar
              query={query}
              filter={filter}
              sort={sort}
              onQueryChange={setQuery}
              onFilterChange={setFilter}
              onSortChange={setSort}
            />

            {filter === "unavailable" ? (
              <StatusMessage tone="warning" title="Unavailable domains">
                Refunds and post-close voids are shown in the domain cards with exact reasons. They do not create queue rows.
              </StatusMessage>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_460px] xl:items-start">
              <div className="space-y-4">
                {domainStates.some((state) => state.status === "failed") ? (
                  <StatusMessage tone="warning" title="Partial approval data">
                    One or more domain queues failed. Loaded domains remain visible and failed domains keep their own error state.
                  </StatusMessage>
                ) : null}

                <SupervisorApprovalQueue
                  items={filteredItems}
                  selectedItemId={selectedItem?.id}
                  isLoading={anyLoading}
                  onSelectItem={setSelectedItem}
                />

                {!anyLoading && approvalItems.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm font-medium text-text-muted">
                    <WarningCircle size={18} weight="bold" aria-hidden />
                    <span>No available approval rows were returned for this branch scope.</span>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4 xl:sticky xl:top-36">
                <SupervisorApprovalDetailPanel
                  item={selectedItem}
                  discountDetail={discountDetailQuery.data}
                  anomalyDetail={anomalyDetailQuery.data}
                  isLoading={detailLoading}
                  detailError={detailError}
                  onClose={() => setSelectedItem(null)}
                />
                <SupervisorCaveatBanner
                  title={supervisorCaveats.receiptsDevices}
                  description="No receipt, device, accounting, billing, franchise, developer, manager PIN, or override execution is added here."
                  icon="excluded"
                  tone="neutral"
                />
              </div>
            </div>
          </>
        )}

        <StatusMessage tone="info" title="Decision actions are unavailable">
          Approve, reject, execute, review, acknowledge, and resolve actions require a separate verified action workflow.
        </StatusMessage>

        <div className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
          <ShieldCheck size={18} weight="bold" aria-hidden />
          <span>No global approvals call, no fake rows, and no approval mutation handlers are attached.</span>
        </div>
      </section>
    </SupervisorShell>
  );
}
