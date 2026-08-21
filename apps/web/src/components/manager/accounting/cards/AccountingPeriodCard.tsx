import {
  AccountingPeriodStatusBadge,
  AccountingPrimaryKpi,
  AccountingReadOnlyNote,
  AccountingRouteScopeNote,
  AccountingStatList,
  AccountingUnpaginatedNote,
} from "@/components/manager/accounting/shared";
import { ManagerDashboardCard } from "@/components/manager/dashboard/ManagerDashboardCard";
import {
  countPeriodsByStatus,
  currentFiscalPeriod,
  FISCAL_PERIOD_STATUS_META,
  formatAccountingCount,
  toFiscalPeriodStatus,
  unpaginatedCountLabel,
} from "@/lib/accounting/model";
import type { AccountingDashboardSnapshot } from "@/lib/manager/accounting-context";

/**
 * Fiscal period — Nimbus's honest analogue of Odoo's **Tax Returns** card, which
 * is a *status + checklist* card rather than a money card. Nimbus has no tax
 * return document (NG-17), but it does have a real period lifecycle, and that is
 * what a manager needs to know before reading any other figure on this page:
 * whether the books are still open.
 *
 * ⚠️ **ORGANISATION DATA, and it says so on the card.** `FiscalPeriod` has no
 * `branch_id` column at all, and `PeriodCloseRun.branchId` is nullable and never
 * stamped by the close path — backend gap batch 2 ruled both org-level BY DESIGN
 * and instructed B5 to **label** them rather than invent a column. Switching
 * branch therefore does NOT change these two figures, which is exactly why the
 * scope badge is not decorative.
 *
 * **PC-07: four states, not three.** `DRAFT → OPEN → CLOSED → LOCKED`. A period
 * is created DRAFT (not OPEN), and **`LOCKED` is terminal — this backend has no
 * unlock route.** The badge renders all four and never implies a fifth.
 *
 * The current period is resolved by DATE WINDOW, not by "the first OPEN row":
 * the demo dataset carries three simultaneously-open periods (a quarter and two
 * months), so picking the first would name the wrong one.
 */
export function AccountingPeriodCard({ snapshot }: { snapshot: AccountingDashboardSnapshot }) {
  const { fiscalPeriodsQuery, periodCloseRunsQuery } = snapshot;
  const periods = fiscalPeriodsQuery.data;
  const closeRuns = periodCloseRunsQuery.data;

  // `Date.now()` is read at render, not memoised: a period boundary crossing
  // while the tab is open should move the answer, and the poll re-renders anyway.
  const current = currentFiscalPeriod(periods, Date.now());
  const status = toFiscalPeriodStatus(current?.status);
  const openCount = countPeriodsByStatus(periods, "OPEN");
  const closeRunCount = Array.isArray(closeRuns) ? closeRuns.length : null;

  const isEmpty =
    !fiscalPeriodsQuery.isLoading && !fiscalPeriodsQuery.isError && (periods?.length ?? 0) === 0;

  return (
    <ManagerDashboardCard
      testId="accounting-period"
      title="Fiscal period"
      icon="time"
      accent="info"
      isLoading={fiscalPeriodsQuery.isLoading}
      isError={fiscalPeriodsQuery.isError}
      isEmpty={isEmpty}
      emptyMessage="No fiscal period has been created for this organisation."
      actions={<AccountingRouteScopeNote routeKey="accounting.periods" />}
      footnote={
        <>
          Fiscal periods and close runs are organisation-wide on this backend — neither model is
          scoped to a branch, so switching branch does not change these two figures.{" "}
          <AccountingUnpaginatedNote label={unpaginatedCountLabel(closeRunCount, "close runs")} />{" "}
          <AccountingReadOnlyNote actions={["Opening, closing and locking a period"]} />
        </>
      }
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <AccountingPrimaryKpi
          kpiKey="period.current"
          value={current?.name || "No period covers today"}
          hint={
            status
              ? FISCAL_PERIOD_STATUS_META[status].description
              : current
                ? "This period reports a status this UI does not recognise, so none is claimed."
                : "No period's start and end dates contain today's date."
          }
        />
        <AccountingPeriodStatusBadge status={status} />
      </div>
      <AccountingStatList
        rows={[
          { kpiKey: "period.open", value: formatAccountingCount(openCount) },
          {
            kpiKey: "period.closeRuns",
            value: periodCloseRunsQuery.isError ? "Unavailable" : formatAccountingCount(closeRunCount),
          },
        ]}
      />
      <p className="text-xs leading-5 text-text-muted">
        Lifecycle: Draft → Open → Closed → Locked. Locked is final — this backend has no unlock
        route.
      </p>
    </ManagerDashboardCard>
  );
}
