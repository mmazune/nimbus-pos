import {
  ManagerCardActionLink,
  ManagerCardPrimaryKpi,
  ManagerCardStatList,
  ManagerDashboardCard,
} from "@/components/manager/dashboard/ManagerDashboardCard";
import type { ManagerDashboardSnapshot } from "@/lib/manager/dashboard-context";
import { formatManagerCount } from "@/lib/manager/dashboard-model";

/**
 * Shift & till coverage — **counts only, by hard constraint**.
 *
 * MP0-02: `GET /api/tills` and `GET /api/shifts` return 404 — they do not exist —
 * and `/tills/active` + `/shifts/active` are OPERATOR-scoped, so they return the
 * Manager's own row, not the branch's. Live, `/shifts/active` returned the
 * Manager's own shift while `/dash/manager` reported `activeShifts: 2`.
 *
 * The only branch-true till/shift data on this backend is
 * `/dash/manager.shiftSummary`, whose two numbers are genuine branch-scoped
 * `count()`s (`orgId + branchId + status: 'OPEN'`). So this card renders those two
 * counts, states in the card itself that no list exists, and offers **no drill-in
 * for them** — a link to a surface that cannot exist would be the fake success the
 * standing rules forbid. Reservations, which do have a real surface, keep theirs.
 */
export function ManagerCoverageCard({ snapshot }: { snapshot: ManagerDashboardSnapshot }) {
  const { managerQuery } = snapshot;
  const shiftSummary = managerQuery.data?.shiftSummary;

  return (
    <ManagerDashboardCard
      testId="coverage"
      title="Shift & till coverage"
      icon="staff"
      accent="info"
      isLoading={managerQuery.isLoading}
      isError={managerQuery.isError}
      actions={<ManagerCardActionLink href="/manager/staff">Staff</ManagerCardActionLink>}
      footnote="Counts only: this backend has no branch-wide tills or shifts list, and its “active” routes return the signed-in user's own row rather than the branch's — so there is nothing to open."
    >
      <ManagerCardPrimaryKpi
        kpiKey="coverage.shifts"
        value={formatManagerCount(shiftSummary?.activeShifts)}
        hint="Shifts currently OPEN on this branch."
      />
      <ManagerCardStatList
        rows={[
          { kpiKey: "coverage.tills", value: formatManagerCount(shiftSummary?.activeTills) },
          {
            kpiKey: "coverage.reservations",
            value: formatManagerCount(managerQuery.data?.reservationsTodayCount),
            href: "/manager/operations",
          },
        ]}
      />
    </ManagerDashboardCard>
  );
}
