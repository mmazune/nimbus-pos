import { ArrowClockwise, ArrowLeft } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/providers/ToastProvider";
import { Badge, Button, Card, ErrorState, StatusMessage } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  approvalKeys,
  approvalCountsFromTotals,
  approvalDecisionInvalidationKeys,
  mapApprovalErrorToMessage,
  type ApprovalQueueScope,
  type ApprovalWorkspaceDomain,
} from "@/lib/supervisor/approvals-contract";
import {
  APPROVAL_DOMAIN_LABEL,
  acknowledgeAnomaly,
  approveDiscount,
  fetchAnomalyDetail,
  fetchDiscountDetail,
  fetchNeedsAction,
  fetchTerminalPage,
  rejectDiscount,
  rejectShiftSwap,
  resolveAnomaly,
  reviewLeave,
  scopeSupportsDomain,
  sortQueueItems,
  type ApprovalQueueItem,
} from "@/lib/supervisor/approvals-workspace";
import { fetchSupervisorOrderPayments } from "@/lib/supervisor/orders";
import type {
  SupervisorAnomaly,
  SupervisorLeaveRequest,
  SupervisorPendingDiscount,
  SupervisorShiftSwap,
} from "@/lib/supervisor/approvals";
import { useSupervisorContext } from "@/lib/supervisor/context";

import { ApprovalScopeTabs } from "./ApprovalScopeTabs";
import { ApprovalDomainFilter, type DomainFilterValue } from "./ApprovalDomainFilter";
import { ApprovalQueueList } from "./ApprovalQueueList";
import { ApprovalFilterToolbar } from "./ApprovalFilterToolbar";
import { ApprovalDiscountDetail } from "./ApprovalDiscountDetail";
import { ApprovalLeaveDetail } from "./ApprovalLeaveDetail";
import { ApprovalShiftSwapDetail } from "./ApprovalShiftSwapDetail";
import { ApprovalAnomalyDetail } from "./ApprovalAnomalyDetail";

const PAGE_SIZE = 25;
const SCOPES: ApprovalQueueScope[] = ["needs-action", "resolved", "history"];

const READ_PERMISSION: Record<ApprovalWorkspaceDomain, string> = {
  discount: "pos:discount:read",
  leave: "pos:hr:leave:read",
  "shift-swap": "pos:hr:shift-swaps:read",
  anomaly: "pos:analytics:anomalies:read",
};

function isScope(v: unknown): v is ApprovalQueueScope {
  return typeof v === "string" && (SCOPES as string[]).includes(v);
}
function isDomainFilter(v: unknown): v is DomainFilterValue {
  return v === "all" || v === "discount" || v === "leave" || v === "shift-swap" || v === "anomaly";
}
function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function SupervisorApprovalsWorkspace() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { accessToken, branchId, user, isAuthenticated, isSupervisor, clearSession } = useAuth();
  const context = useSupervisorContext();

  const canQuery = Boolean(accessToken && branchId && isAuthenticated && isSupervisor);
  const token = accessToken as string;
  const branch = branchId as string;
  const permissions = useMemo(() => new Set(user?.permissions ?? []), [user?.permissions]);
  const can = useCallback((perm: string) => permissions.has(perm), [permissions]);
  const canReadDomain = useCallback(
    (domain: ApprovalWorkspaceDomain) => can(READ_PERMISSION[domain]),
    [can],
  );

  // ── URL state ───────────────────────────────────────────────────────────────
  const scope = isScope(firstParam(router.query.scope)) ? (firstParam(router.query.scope) as ApprovalQueueScope) : "needs-action";
  const domainParam = firstParam(router.query.domain);
  const domainFilter: DomainFilterValue = isDomainFilter(domainParam) ? domainParam : "all";
  const page = Math.max(parseInt(firstParam(router.query.page) || "1", 10) || 1, 1);
  const dateFrom = firstParam(router.query.from);
  const dateTo = firstParam(router.query.to);
  const selDomain = firstParam(router.query.selDomain);
  const selId = firstParam(router.query.selId);
  const selected = useMemo(
    () =>
      selId && isDomainFilter(selDomain) && selDomain !== "all"
        ? { domain: selDomain as ApprovalWorkspaceDomain, id: selId }
        : null,
    [selId, selDomain],
  );

  const patchQuery = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = { ...router.query, ...patch };
      Object.keys(patch).forEach((k) => {
        if (patch[k] === undefined) delete next[k];
      });
      void router.replace({ pathname: router.pathname, query: next }, undefined, { shallow: true });
    },
    [router],
  );

  const setScope = (s: ApprovalQueueScope) =>
    patchQuery({ scope: s === "needs-action" ? undefined : s, page: undefined, from: undefined, to: undefined });
  const setDomain = (d: DomainFilterValue) =>
    patchQuery({ domain: d === "all" ? undefined : d, page: undefined });
  const setPage = (p: number) => patchQuery({ page: p <= 1 ? undefined : String(p) });
  const select = (item: ApprovalQueueItem) => patchQuery({ selDomain: item.domain, selId: item.id });
  const clearSelection = () => patchQuery({ selDomain: undefined, selId: undefined });

  // ── Needs-action queries (always on for counts + the needs-action queue) ─────
  const naDiscount = useQuery({
    queryKey: approvalKeys.queue(branch, "discount", "needs-action"),
    enabled: canQuery && canReadDomain("discount"),
    queryFn: () => fetchNeedsAction("discount", token, branch),
    staleTime: 10_000,
  });
  const naLeave = useQuery({
    queryKey: approvalKeys.queue(branch, "leave", "needs-action"),
    enabled: canQuery && canReadDomain("leave"),
    queryFn: () => fetchNeedsAction("leave", token, branch),
    staleTime: 10_000,
  });
  const naSwap = useQuery({
    queryKey: approvalKeys.queue(branch, "shift-swap", "needs-action"),
    enabled: canQuery && canReadDomain("shift-swap"),
    queryFn: () => fetchNeedsAction("shift-swap", token, branch),
    staleTime: 10_000,
  });
  const naAnomaly = useQuery({
    queryKey: approvalKeys.queue(branch, "anomaly", "needs-action"),
    enabled: canQuery && canReadDomain("anomaly"),
    queryFn: () => fetchNeedsAction("anomaly", token, branch),
    staleTime: 10_000,
  });

  const needsActionByDomain: Record<ApprovalWorkspaceDomain, ApprovalQueueItem[]> = useMemo(
    () => ({
      discount: naDiscount.data?.items ?? [],
      leave: naLeave.data?.items ?? [],
      "shift-swap": naSwap.data?.items ?? [],
      anomaly: naAnomaly.data?.items ?? [],
    }),
    [naDiscount.data, naLeave.data, naSwap.data, naAnomaly.data],
  );

  const counts = useMemo(
    () =>
      approvalCountsFromTotals({
        discount: naDiscount.data?.total ?? 0,
        leave: naLeave.data?.total ?? 0,
        shiftSwap: naSwap.data?.total ?? 0,
        anomaly: naAnomaly.data?.total ?? 0,
      }),
    [naDiscount.data, naLeave.data, naSwap.data, naAnomaly.data],
  );

  // ── Terminal queries (Resolved / History) for leave / shift-swap / anomaly ───
  const terminalEnabled = (domain: ApprovalWorkspaceDomain) =>
    canQuery &&
    scope !== "needs-action" &&
    scopeSupportsDomain(scope, domain) &&
    canReadDomain(domain) &&
    (domainFilter === "all" || domainFilter === domain);

  const termParams = { scope: scope as "resolved" | "history", page, dateFrom, dateTo };
  const tLeave = useQuery({
    queryKey: approvalKeys.queue(branch, "leave", scope, { scope, page, dateFrom, dateTo } as never),
    enabled: terminalEnabled("leave"),
    queryFn: () => fetchTerminalPage("leave", token, branch, termParams),
    staleTime: 10_000,
  });
  const tSwap = useQuery({
    queryKey: approvalKeys.queue(branch, "shift-swap", scope, { scope, page, dateFrom, dateTo } as never),
    enabled: terminalEnabled("shift-swap"),
    queryFn: () => fetchTerminalPage("shift-swap", token, branch, termParams),
    staleTime: 10_000,
  });
  const tAnomaly = useQuery({
    queryKey: approvalKeys.queue(branch, "anomaly", scope, { scope, page, dateFrom, dateTo } as never),
    enabled: terminalEnabled("anomaly"),
    queryFn: () => fetchTerminalPage("anomaly", token, branch, termParams),
    staleTime: 10_000,
  });

  // ── Detail queries ────────────────────────────────────────────────────────────
  const discountDetail = useQuery({
    queryKey: approvalKeys.detail(branch, "discount", selected?.id ?? "none"),
    enabled: canQuery && selected?.domain === "discount",
    queryFn: () => fetchDiscountDetail(token, branch, selected!.id),
    staleTime: 8_000,
  });
  const discountOrderId = (discountDetail.data as SupervisorPendingDiscount | undefined)?.order?.id
    ?? (discountDetail.data as SupervisorPendingDiscount | undefined)?.orderId
    ?? null;
  const discountPayments = useQuery({
    queryKey: ["supervisor", "approval-order-payments", branch, discountOrderId],
    enabled: canQuery && selected?.domain === "discount" && Boolean(discountOrderId),
    queryFn: () => fetchSupervisorOrderPayments(token, branch, discountOrderId as string),
    staleTime: 8_000,
  });
  const anomalyDetail = useQuery({
    queryKey: approvalKeys.detail(branch, "anomaly", selected?.id ?? "none"),
    enabled: canQuery && selected?.domain === "anomaly",
    queryFn: () => fetchAnomalyDetail(token, branch, selected!.id),
    staleTime: 8_000,
  });

  // ── Auth-error handling ────────────────────────────────────────────────────────
  useEffect(() => {
    const errs = [naDiscount.error, naLeave.error, naSwap.error, naAnomaly.error, tLeave.error, tSwap.error, tAnomaly.error, discountDetail.error, anomalyDetail.error];
    if (errs.some((e) => e instanceof ApiError && e.isAuthError)) clearSession();
  }, [naDiscount.error, naLeave.error, naSwap.error, naAnomaly.error, tLeave.error, tSwap.error, tAnomaly.error, discountDetail.error, anomalyDetail.error, clearSession]);

  // ── Displayed queue (client-paginate needs-action; server-page terminal) ──────
  const allLoadedItems = useMemo(
    () => [
      ...needsActionByDomain.discount,
      ...needsActionByDomain.leave,
      ...needsActionByDomain["shift-swap"],
      ...needsActionByDomain.anomaly,
      ...(tLeave.data?.items ?? []),
      ...(tSwap.data?.items ?? []),
      ...(tAnomaly.data?.items ?? []),
    ],
    [needsActionByDomain, tLeave.data, tSwap.data, tAnomaly.data],
  );

  const scopeSupportsSelectedDomain = domainFilter === "all" || scopeSupportsDomain(scope, domainFilter);

  const { pageItems, totalPages, queueLoading } = useMemo(() => {
    if (scope === "needs-action") {
      const merged =
        domainFilter === "all"
          ? sortQueueItems([
              ...needsActionByDomain.discount,
              ...needsActionByDomain.leave,
              ...needsActionByDomain["shift-swap"],
              ...needsActionByDomain.anomaly,
            ])
          : needsActionByDomain[domainFilter];
      const pages = Math.max(1, Math.ceil(merged.length / PAGE_SIZE));
      const start = (Math.min(page, pages) - 1) * PAGE_SIZE;
      const loading =
        (domainFilter === "all" &&
          (naDiscount.isLoading || naLeave.isLoading || naSwap.isLoading || naAnomaly.isLoading)) ||
        (domainFilter === "discount" && naDiscount.isLoading) ||
        (domainFilter === "leave" && naLeave.isLoading) ||
        (domainFilter === "shift-swap" && naSwap.isLoading) ||
        (domainFilter === "anomaly" && naAnomaly.isLoading);
      return { pageItems: merged.slice(start, start + PAGE_SIZE), totalPages: pages, queueLoading: loading };
    }
    // Resolved / History
    if (!scopeSupportsSelectedDomain) return { pageItems: [], totalPages: 1, queueLoading: false };
    const merged =
      domainFilter === "all"
        ? sortQueueItems([...(tLeave.data?.items ?? []), ...(tSwap.data?.items ?? []), ...(tAnomaly.data?.items ?? [])])
        : domainFilter === "leave"
        ? tLeave.data?.items ?? []
        : domainFilter === "shift-swap"
        ? tSwap.data?.items ?? []
        : tAnomaly.data?.items ?? [];
    const totals =
      domainFilter === "all"
        ? Math.max(tLeave.data?.total ?? 0, tSwap.data?.total ?? 0, tAnomaly.data?.total ?? 0)
        : domainFilter === "leave"
        ? tLeave.data?.total ?? 0
        : domainFilter === "shift-swap"
        ? tSwap.data?.total ?? 0
        : tAnomaly.data?.total ?? 0;
    const pages = Math.max(1, Math.ceil(totals / PAGE_SIZE));
    const loading =
      (domainFilter === "all" && (tLeave.isLoading || tSwap.isLoading || tAnomaly.isLoading)) ||
      (domainFilter === "leave" && tLeave.isLoading) ||
      (domainFilter === "shift-swap" && tSwap.isLoading) ||
      (domainFilter === "anomaly" && tAnomaly.isLoading);
    return { pageItems: merged, totalPages: pages, queueLoading: loading };
  }, [scope, domainFilter, page, needsActionByDomain, naDiscount.isLoading, naLeave.isLoading, naSwap.isLoading, naAnomaly.isLoading, tLeave.data, tSwap.data, tAnomaly.data, tLeave.isLoading, tSwap.isLoading, tAnomaly.isLoading, scopeSupportsSelectedDomain]);

  const selectedItem = useMemo(
    () => (selected ? allLoadedItems.find((it) => it.domain === selected.domain && it.id === selected.id) ?? null : null),
    [selected, allLoadedItems],
  );

  const anyFetching =
    naDiscount.isFetching || naLeave.isFetching || naSwap.isFetching || naAnomaly.isFetching ||
    tLeave.isFetching || tSwap.isFetching || tAnomaly.isFetching;
  const allNeedsActionFailed =
    scope === "needs-action" && naDiscount.isError && naLeave.isError && naSwap.isError && naAnomaly.isError;

  function refreshAll() {
    void naDiscount.refetch();
    void naLeave.refetch();
    void naSwap.refetch();
    void naAnomaly.refetch();
    if (scope !== "needs-action") {
      void tLeave.refetch();
      void tSwap.refetch();
      void tAnomaly.refetch();
    }
    if (selected?.domain === "discount") void discountDetail.refetch();
    if (selected?.domain === "anomaly") void anomalyDetail.refetch();
  }

  // ── Invalidation helpers ────────────────────────────────────────────────────
  const invalidateDomain = useCallback(
    (domain: ApprovalWorkspaceDomain, id?: string) => {
      approvalDecisionInvalidationKeys(branch, domain, id).forEach((key) => {
        void queryClient.invalidateQueries({ queryKey: key });
      });
    },
    [branch, queryClient],
  );
  const invalidateDiscountCrossRole = useCallback(
    (orderId: string | null, totalsChanged: boolean) => {
      if (!orderId) return;
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "order-discounts", branch, orderId] });
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "approval-order-payments", branch, orderId] });
      if (totalsChanged) {
        void queryClient.invalidateQueries({ queryKey: ["supervisor", "order-detail", branch, orderId] });
        void queryClient.invalidateQueries({ queryKey: ["supervisor", "order-payments", branch, orderId] });
        void queryClient.invalidateQueries({ queryKey: ["supervisor", "floor", branch] });
      }
    },
    [branch, queryClient],
  );

  // ── Decision handlers ──────────────────────────────────────────────────────
  async function onDiscountApprove(managerPin?: string) {
    if (!selected) return;
    await approveDiscount(token, branch, selected.id, managerPin);
    invalidateDomain("discount", selected.id);
    invalidateDiscountCrossRole(discountOrderId, true);
    await discountDetail.refetch();
    showToast({ tone: "success", title: "Discount approved", description: "The order total has been recalculated." });
  }
  async function onDiscountReject(reason: string) {
    if (!selected) return;
    await rejectDiscount(token, branch, selected.id, reason);
    invalidateDomain("discount", selected.id);
    invalidateDiscountCrossRole(discountOrderId, false);
    await discountDetail.refetch();
    showToast({ tone: "success", title: "Discount rejected", description: "The order total is unchanged." });
  }
  async function onLeaveApprove(notes?: string) {
    if (!selected) return;
    await reviewLeave(token, branch, selected.id, "APPROVED", notes);
    invalidateDomain("leave", selected.id);
    showToast({ tone: "success", title: "Leave approved", description: "The decision has been recorded." });
    clearSelection();
  }
  async function onLeaveReject(notes?: string) {
    if (!selected) return;
    await reviewLeave(token, branch, selected.id, "REJECTED", notes);
    invalidateDomain("leave", selected.id);
    showToast({ tone: "success", title: "Leave rejected", description: "The decision has been recorded." });
    clearSelection();
  }
  async function onShiftSwapReject(notes?: string) {
    if (!selected) return;
    await rejectShiftSwap(token, branch, selected.id, notes);
    invalidateDomain("shift-swap", selected.id);
    showToast({ tone: "success", title: "Shift swap rejected", description: "No schedule was changed." });
    clearSelection();
  }
  async function onAnomalyAcknowledge(notes?: string) {
    if (!selected) return;
    await acknowledgeAnomaly(token, branch, selected.id, notes);
    invalidateDomain("anomaly", selected.id);
    await anomalyDetail.refetch(); // row stays in Needs action (still needs resolution) → keep selection
    showToast({ tone: "success", title: "Anomaly acknowledged", description: "It stays actionable until resolved." });
  }
  async function onAnomalyResolve(notes: string) {
    if (!selected) return;
    await resolveAnomaly(token, branch, selected.id, notes);
    invalidateDomain("anomaly", selected.id);
    showToast({ tone: "success", title: "Anomaly resolved", description: "The original evidence is preserved." });
    clearSelection();
  }

  // ── Empty-state copy ────────────────────────────────────────────────────────
  const emptyCopy = useMemo(() => {
    if (scope === "needs-action") return { title: "No approvals need action", description: "New requests will appear here as they arrive." };
    if (scope === "resolved") return { title: "No recent decisions", description: "Decisions from the last two weeks will appear here." };
    return { title: "No approval history matches these filters", description: "Adjust the domain or date range to see more." };
  }, [scope]);

  const showDiscountHistoryNotice = scope !== "needs-action" && domainFilter === "discount";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <section className="space-y-5" aria-labelledby="supervisor-approvals-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-normal text-text-muted">Controlled exception desk</p>
          <h1 id="supervisor-approvals-title" className="mt-1 text-3xl font-bold tracking-normal text-text-primary">
            Approvals
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="info">{context.branchName}</Badge>
            <Badge variant={counts.total > 0 ? "warning" : "neutral"}>{counts.total} awaiting action</Badge>
          </div>
        </div>
        <Button
          variant="secondary"
          size="pos"
          leadingIcon={<ArrowClockwise size={20} weight="bold" aria-hidden />}
          onClick={refreshAll}
          disabled={anyFetching}
        >
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ApprovalScopeTabs scope={scope} needsActionCount={canQuery ? counts.total : null} onSelect={setScope} />
      </div>
      <ApprovalDomainFilter scope={scope} value={domainFilter} counts={counts} onSelect={setDomain} />

      {scope === "history" ? (
        <ApprovalFilterToolbar
          dateFrom={dateFrom ?? ""}
          dateTo={dateTo ?? ""}
          onDateFrom={(v) => patchQuery({ from: v || undefined, page: undefined })}
          onDateTo={(v) => patchQuery({ to: v || undefined, page: undefined })}
          onClear={() => patchQuery({ from: undefined, to: undefined, page: undefined })}
        />
      ) : null}

      {allNeedsActionFailed ? (
        <ErrorState title="Approvals could not load" description="The approval queues failed to load. Refresh to try again." />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_460px] xl:items-start">
          {/* LEFT — queue */}
          <div id="approval-queue-panel" role="tabpanel" className="space-y-3">
            {!showDiscountHistoryNotice && !scopeSupportsSelectedDomain ? (
              <StatusMessage tone="info" title="Not available in this view">
                This domain isn’t shown here. Switch to Needs action to review it.
              </StatusMessage>
            ) : null}

            {showDiscountHistoryNotice ? (
              <StatusMessage tone="info" title="Discount history">
                Historical discount decisions are available from the related order.
              </StatusMessage>
            ) : (
              <>
                <ApprovalQueueList
                  items={pageItems}
                  selectedId={selected?.id ?? null}
                  isLoading={queueLoading}
                  emptyTitle={emptyCopy.title}
                  emptyDescription={emptyCopy.description}
                  onSelect={select}
                />
                {totalPages > 1 ? (
                  <nav className="flex items-center justify-between gap-3" aria-label="Queue pagination">
                    <Button variant="tertiary" size="compact" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      Previous
                    </Button>
                    <span className="text-sm text-text-muted">
                      Page {Math.min(page, totalPages)} of {totalPages}
                    </span>
                    <Button variant="tertiary" size="compact" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                      Next
                    </Button>
                  </nav>
                ) : null}
              </>
            )}
          </div>

          {/* RIGHT — detail */}
          <div className="xl:sticky xl:top-24">
            <Card className="p-5">
              {!selectedItem ? (
                <div className="py-10 text-center">
                  <p className="text-sm font-semibold text-text-primary">Select an approval</p>
                  <p className="mt-1 text-sm text-text-secondary">Choose a request from the queue to review its details.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-bold tracking-normal text-text-primary">
                      {APPROVAL_DOMAIN_LABEL[selectedItem.domain]}
                    </h2>
                    <Button
                      variant="tertiary"
                      size="compact"
                      leadingIcon={<ArrowLeft size={16} weight="bold" aria-hidden />}
                      onClick={clearSelection}
                    >
                      Back to list
                    </Button>
                  </div>

                  {selectedItem.domain === "discount" ? (
                    <ApprovalDiscountDetail
                      item={selectedItem}
                      detail={discountDetail.data as SupervisorPendingDiscount | undefined}
                      detailLoading={discountDetail.isLoading}
                      detailError={discountDetail.isError ? mapApprovalErrorToMessage((discountDetail.error as ApiError)?.status) : null}
                      payments={discountPayments.data}
                      paymentsLoading={discountPayments.isLoading}
                      currentUserId={user?.id ?? null}
                      canDecide={can("pos:discount:approve")}
                      onApprove={onDiscountApprove}
                      onReject={onDiscountReject}
                      onRetry={() => void discountDetail.refetch()}
                    />
                  ) : null}

                  {selectedItem.domain === "leave" ? (
                    <ApprovalLeaveDetail
                      leave={selectedItem.raw as SupervisorLeaveRequest}
                      canDecide={can("pos:hr:leave:review")}
                      onApprove={onLeaveApprove}
                      onReject={onLeaveReject}
                    />
                  ) : null}

                  {selectedItem.domain === "shift-swap" ? (
                    <ApprovalShiftSwapDetail
                      swap={selectedItem.raw as SupervisorShiftSwap}
                      canDecide={can("pos:hr:shift-swaps:approve")}
                      onReject={onShiftSwapReject}
                    />
                  ) : null}

                  {selectedItem.domain === "anomaly" ? (
                    <ApprovalAnomalyDetail
                      detail={anomalyDetail.data as SupervisorAnomaly | undefined}
                      fallback={selectedItem.raw as SupervisorAnomaly}
                      loading={anomalyDetail.isLoading}
                      error={anomalyDetail.isError ? mapApprovalErrorToMessage((anomalyDetail.error as ApiError)?.status) : null}
                      canDecide={can("pos:analytics:anomalies:acknowledge")}
                      onAcknowledge={onAnomalyAcknowledge}
                      onResolve={onAnomalyResolve}
                      onRetry={() => void anomalyDetail.refetch()}
                    />
                  ) : null}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </section>
  );
}
