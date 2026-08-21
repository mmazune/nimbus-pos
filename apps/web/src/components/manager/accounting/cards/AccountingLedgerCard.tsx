import {
  AccountingPrimaryKpi,
  AccountingReadOnlyNote,
  AccountingRouteScopeNote,
  AccountingStatList,
} from "@/components/manager/accounting/shared";
import { ManagerDashboardCard } from "@/components/manager/dashboard/ManagerDashboardCard";
import { formatAccountingCount } from "@/lib/accounting/model";
import type { AccountingDashboardSnapshot } from "@/lib/manager/accounting-context";

/**
 * General ledger — journals and posting health.
 *
 * **There is no trial balance here and there must not be one.** Odoo's Reporting
 * menu offers Trial Balance, General Ledger, Partner Ledger and eight more
 * statements; Nimbus has **no financial-statement endpoint at all** (NG-07 →
 * C-11), so this card reports what the ledger endpoints actually publish —
 * how many journal entries exist in this branch, and whether the posting
 * pipeline is clean — and nothing that would imply a statement.
 *
 * **Read-only, verified.** B0 §3.4 checked the claim in
 * `docs/GL_POSTING_ENGINE_GUIDE.md` that Manager holds `journals:read` but not
 * `journals:create` / `journals:reverse` / `posting:replay`; the guides were
 * right, and this pass re-confirmed `POST /accounting/journals` → **403**. So
 * the card names those actions rather than offering them.
 *
 * Posting errors are the one figure here that is bad news when non-zero, so it
 * carries a danger tone only when it is.
 */
export function AccountingLedgerCard({ snapshot }: { snapshot: AccountingDashboardSnapshot }) {
  const { journalCountQuery, postingErrorCountQuery, postingRunCountQuery } = snapshot;
  const journals = journalCountQuery.data ?? null;
  const postingErrors = postingErrorCountQuery.data ?? null;
  const postingRuns = postingRunCountQuery.data ?? null;

  return (
    <ManagerDashboardCard
      testId="accounting-ledger"
      title="General ledger"
      icon="reports"
      accent="brand"
      isLoading={journalCountQuery.isLoading}
      isError={journalCountQuery.isError}
      actions={<AccountingRouteScopeNote routeKey="accounting.journals" />}
      footnote={
        <AccountingReadOnlyNote
          actions={["Posting a journal entry", "reversing one", "replaying a posting run"]}
        />
      }
    >
      <AccountingPrimaryKpi
        kpiKey="ledger.journals"
        value={formatAccountingCount(journals)}
        hint="Counted by the endpoint itself, not by a page length."
      />
      <AccountingStatList
        rows={[
          {
            kpiKey: "ledger.postingRuns",
            value: postingRunCountQuery.isError ? "Unavailable" : formatAccountingCount(postingRuns),
          },
          {
            kpiKey: "ledger.postingErrors",
            value: postingErrorCountQuery.isError
              ? "Unavailable"
              : formatAccountingCount(postingErrors),
            tone: (postingErrors ?? 0) > 0 ? "danger" : "default",
          },
        ]}
      />
      <p className="text-xs leading-5 text-text-muted">
        This backend produces no balance sheet, profit and loss, cash flow statement or trial
        balance — no endpoint exists for any of them, so none is offered.
      </p>
    </ManagerDashboardCard>
  );
}
