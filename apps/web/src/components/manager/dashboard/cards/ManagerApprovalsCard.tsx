import {
  ManagerCardActionLink,
  ManagerCardPrimaryKpi,
  ManagerCardStatList,
  ManagerDashboardCard,
} from "@/components/manager/dashboard/ManagerDashboardCard";
import type { ManagerDashboardSnapshot } from "@/lib/manager/dashboard-context";
import { formatManagerCount, MANAGER_APPROVAL_DOMAINS } from "@/lib/manager/dashboard-model";

const DOMAIN_KPI_KEYS = {
  discount: "approvals.discount",
  leave: "approvals.leave",
  "shift-swap": "approvals.shiftSwap",
  anomaly: "approvals.anomaly",
} as const;

/**
 * Approvals needing action.
 *
 * **Overview decides nothing** (roadmap B2 "Out of scope"): every number here is a
 * count with a drill-in into the surface that owns the decision. There is no
 * Approve, Reject, Acknowledge or Resolve control on this card, and there will not
 * be one — those live in Operations/Staff from B3.
 *
 * Counts come from the four **canonical domain endpoints**, never the generic
 * `GET /api/approvals`. That inbox is only partly branch-scoped: `leave_request`,
 * `vendor_bill` and `inter_branch_transfer` are org-scoped, and live it returned
 * `total: 16` spanning five branches including one the Manager is not a member of
 * (MP0-05). Each domain endpoint filters on `orgId + branchId` in its own service,
 * so these counts are branch-true at the source.
 *
 * A failing domain shows "Unavailable" for that row only — the total then says how
 * many domains it could read, instead of silently under-counting.
 */
export function ManagerApprovalsCard({ snapshot }: { snapshot: ManagerDashboardSnapshot }) {
  const { approvalQueries, managerQuery } = snapshot;
  const queries = MANAGER_APPROVAL_DOMAINS.map((domain) => ({
    domain,
    query: approvalQueries[domain.key],
  }));

  const isLoading = queries.every(({ query }) => query.isLoading);
  const failedCount = queries.filter(({ query }) => query.isError).length;
  const readable = queries.filter(({ query }) => !query.isError && query.data);
  const total = readable.reduce((sum, { query }) => sum + (query.data?.count || 0), 0);

  return (
    <ManagerDashboardCard
      testId="approvals"
      title="Needs a decision"
      icon="approvals"
      accent="danger"
      isLoading={isLoading}
      isError={failedCount === queries.length}
      errorMessage="None of the four approval queues could be read, so no count is shown."
      actions={
        <>
          <ManagerCardActionLink href="/manager/operations">Operations</ManagerCardActionLink>
          <ManagerCardActionLink href="/manager/staff">Staff</ManagerCardActionLink>
        </>
      }
      footnote={
        failedCount > 0 && failedCount < queries.length
          ? `${failedCount} of ${queries.length} queues could not be read; the total covers the rest. Overview shows counts only — decisions are made on the surface that owns them.`
          : "Counted through each domain's own branch-scoped endpoint, not the shared approvals inbox (which spans branches). Overview shows counts only — decisions are made on the surface that owns them."
      }
    >
      <ManagerCardPrimaryKpi
        kpiKey="approvals.needsDecision"
        value={formatManagerCount(readable.length ? total : null)}
        hint={
          failedCount > 0
            ? `Across ${readable.length} of ${queries.length} queues that could be read.`
            : "Across discounts, leave, shift swaps and open anomalies."
        }
      />
      <ManagerCardStatList
        rows={queries.map(({ domain, query }) => ({
          kpiKey: DOMAIN_KPI_KEYS[domain.key],
          label: domain.label,
          value: query.isError ? "Unavailable" : formatManagerCount(query.data?.count),
          href: domain.drillIn,
          tone: !query.isError && (query.data?.count || 0) > 0 ? "danger" : "default",
        }))}
      />
      <ManagerCardStatList
        rows={[
          {
            kpiKey: "anomalies.high",
            value: managerQuery.isError
              ? "Unavailable"
              : formatManagerCount(managerQuery.data?.anomalySummary?.highCount),
            href: "/manager/operations",
            tone:
              !managerQuery.isError && (managerQuery.data?.anomalySummary?.highCount || 0) > 0
                ? "danger"
                : "default",
          },
        ]}
      />
    </ManagerDashboardCard>
  );
}
