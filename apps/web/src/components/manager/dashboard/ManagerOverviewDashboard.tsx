import { useState } from "react";

import { ManagerContentShell, ManagerControlPanel } from "@/components/manager/chrome";
import { ManagerApprovalsCard } from "@/components/manager/dashboard/cards/ManagerApprovalsCard";
import { ManagerCoverageCard } from "@/components/manager/dashboard/cards/ManagerCoverageCard";
import { ManagerLowStockCard } from "@/components/manager/dashboard/cards/ManagerLowStockCard";
import { ManagerOpenOrdersCard } from "@/components/manager/dashboard/cards/ManagerOpenOrdersCard";
import { ManagerOrdersTodayCard } from "@/components/manager/dashboard/cards/ManagerOrdersTodayCard";
import { ManagerPaymentMixCard } from "@/components/manager/dashboard/cards/ManagerPaymentMixCard";
import { ManagerReadinessCard } from "@/components/manager/dashboard/cards/ManagerReadinessCard";
import { ManagerSalesTodayCard } from "@/components/manager/dashboard/cards/ManagerSalesTodayCard";
import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import {
  operationalIcons,
  operationalIconSizes,
  operationalIconWeights,
} from "@/components/pos-shell/role-icons";
import { Badge, Button, EmptyState } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { useManagerBranch } from "@/lib/manager/branch-context";
import { MANAGER_DASHBOARD_POLL_MS, useManagerDashboard } from "@/lib/manager/dashboard-context";
import { formatManagerClockTime } from "@/lib/manager/dashboard-model";

/**
 * Manager Overview dashboard (Track B2).
 *
 * Composition follows the Odoo Accounting Dashboard (`02-accounting-dashboard.jpg`):
 * the control-panel row from B1, then a **3 × N grid of bordered cards with a
 * coloured left accent bar**, each carrying its own actions, KPI rows, and either
 * a mini chart, a checklist, or nothing at all. The grid does not force visual
 * symmetry — a card with no honest chart simply has none.
 *
 * Layout patterns were also studied across free admin kits (Tremor's
 * label → metric → micro-visualization card anatomy, Preline's top-accent card and
 * divider conventions, TailAdmin's metric-row-then-detail dashboard flow). Nothing
 * was imported or copied: every rule below is written in Nimbus's own tokens and
 * density system. See the completion report.
 *
 * **Polled, never streamed.** `/api/stream/metrics` needs `Authorization` and
 * `X-Branch-Id`, which `EventSource` cannot send, and this app has no SSE reader
 * (MP0-07 / NG-14 → Track C-04). The degraded-stream state is therefore permanent
 * and stated in plain words, not hidden behind a spinner that implies live data.
 */
export function ManagerOverviewDashboard() {
  const branch = useManagerBranch();
  const snapshot = useManagerDashboard();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const RefreshIcon = operationalIcons.refresh;
  const pollSeconds = Math.round(MANAGER_DASHBOARD_POLL_MS / 1000);

  const refreshError = snapshot.refresh.isError
    ? snapshot.refresh.error instanceof ApiError
      ? snapshot.refresh.error.message
      : "The recalculation could not be started."
    : null;

  return (
    <ManagerContentShell>
      <ManagerControlPanel
        title="Overview"
        badge={<Badge variant="neutral">Branch: {branch.branchName}</Badge>}
        primaryAction={
          <Button
            size="compact"
            disabled={!snapshot.isEnabled || snapshot.refresh.isPending}
            onClick={() => setConfirmOpen(true)}
            leadingIcon={
              <RefreshIcon
                size={operationalIconSizes.compactAction}
                weight={operationalIconWeights.default}
                aria-hidden
              />
            }
          >
            {snapshot.refresh.isPending ? "Recalculating…" : "Recalculate"}
          </Button>
        }
      />

      <ManagerDashboardStatusBar
        calculatedAt={snapshot.calculatedAt}
        lastRefreshedAt={snapshot.refresh.lastRefreshedAt}
        pollSeconds={pollSeconds}
        refreshError={refreshError}
      />

      {!branch.isReady ? (
        <EmptyState
          title="Select a branch to load the dashboard"
          description="Every figure on this page is scoped to one branch. Choose one in the top bar and the cards will load for it."
        />
      ) : (
        <div
          className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          data-manager-dashboard-grid
        >
          <ManagerSalesTodayCard snapshot={snapshot} />
          <ManagerOrdersTodayCard snapshot={snapshot} />
          <ManagerPaymentMixCard snapshot={snapshot} />
          <ManagerOpenOrdersCard snapshot={snapshot} />
          <ManagerLowStockCard snapshot={snapshot} />
          <ManagerApprovalsCard snapshot={snapshot} />
          <ManagerCoverageCard snapshot={snapshot} />
          <ManagerReadinessCard />
        </div>
      )}

      <ActionConfirmDialog
        open={confirmOpen}
        tone="info"
        title="Recalculate branch KPIs?"
        consequence={`This records a new KPI snapshot for ${branch.branchName} and writes an audit entry, then re-reads every card. It changes no order, payment, stock or staff record.`}
        confirmLabel="Recalculate"
        pending={snapshot.refresh.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          snapshot.refresh.run();
          setConfirmOpen(false);
        }}
      />
    </ManagerContentShell>
  );
}

/**
 * The data-provenance strip. Its whole job is to stop the dashboard from
 * *implying* liveness: it names the refresh mode, the last read time, and the
 * missing stream, in words.
 */
function ManagerDashboardStatusBar({
  calculatedAt,
  lastRefreshedAt,
  pollSeconds,
  refreshError,
}: {
  calculatedAt: string | null;
  lastRefreshedAt: string | null;
  pollSeconds: number;
  refreshError: string | null;
}) {
  const TimeIcon = operationalIcons.time;

  return (
    <div className="flex min-w-0 flex-col gap-2" data-manager-dashboard-status>
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
        <span className="inline-flex items-center gap-1.5">
          <TimeIcon
            size={operationalIconSizes.compactAction}
            weight={operationalIconWeights.default}
            className="text-text-muted"
            aria-hidden
          />
          <span>
            Read at{" "}
            <span className="font-semibold text-text-primary">
              {formatManagerClockTime(calculatedAt, "not yet")}
            </span>
          </span>
        </span>
        <span>Refreshes every {pollSeconds} seconds while this page is open.</span>
        <span data-manager-stream-state="degraded">
          Live stream unavailable — showing the latest fetched data.
        </span>
        {lastRefreshedAt ? (
          <span>
            KPI snapshot recorded at{" "}
            <span className="font-semibold text-text-primary">
              {formatManagerClockTime(lastRefreshedAt)}
            </span>
            .
          </span>
        ) : null}
      </div>

      {refreshError ? (
        <p
          role="alert"
          className="rounded-md bg-status-danger-surface px-3 py-2 text-sm font-semibold text-status-danger"
        >
          {refreshError}
        </p>
      ) : null}
    </div>
  );
}
