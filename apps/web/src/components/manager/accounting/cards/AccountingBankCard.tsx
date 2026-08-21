import {
  AccountingPrimaryKpi,
  AccountingReadOnlyNote,
  AccountingRouteScopeNote,
  AccountingStatList,
  AccountingUnpaginatedNote,
} from "@/components/manager/accounting/shared";
import { ManagerDashboardCard } from "@/components/manager/dashboard/ManagerDashboardCard";
import {
  countActiveReconciliations,
  formatAccountingCount,
  unpaginatedCountLabel,
} from "@/lib/accounting/model";
import type { AccountingDashboardSnapshot } from "@/lib/manager/accounting-context";

/**
 * Bank — Nimbus's analogue of Odoo's **Bank** card, minus its `Bank Setup`,
 * `Transactions` and `N to reconcile` buttons: creating a bank account,
 * importing a statement and matching a line are all writes this role does not
 * hold.
 *
 * **PC-06 applies to both reads.** `bank-accounts` and `reconciliation` return
 * bare JSON arrays: no envelope, no `total`, no server-side pagination bound.
 * The array IS the complete result set, so counting it is exact — but it is a
 * CLIENT count, and B4-D1's rule stands that a page length is never dressed up
 * as a server total. The footnote says which kind of count this is, in words.
 *
 * **No balance is shown.** Odoo's card leads with a bank balance; Nimbus's
 * `BankAccount` rows were not verified to carry a reconciled balance on this
 * dataset (zero rows exist), so leading with one would be a figure this pass
 * cannot stand behind. B5.3 owns the workbench and can add it once real rows
 * exist to verify against.
 */
export function AccountingBankCard({ snapshot }: { snapshot: AccountingDashboardSnapshot }) {
  const { bankAccountsQuery, reconciliationsQuery } = snapshot;
  const accounts = bankAccountsQuery.data;
  const reconciliations = reconciliationsQuery.data;
  const accountCount = Array.isArray(accounts) ? accounts.length : null;
  const reconciliationCount = Array.isArray(reconciliations) ? reconciliations.length : null;
  const active = countActiveReconciliations(reconciliations);

  const isEmpty =
    !bankAccountsQuery.isLoading &&
    !bankAccountsQuery.isError &&
    !reconciliationsQuery.isError &&
    accountCount === 0 &&
    reconciliationCount === 0;

  return (
    <ManagerDashboardCard
      testId="accounting-bank"
      title="Bank"
      icon="cashierTill"
      accent="info"
      isLoading={bankAccountsQuery.isLoading || reconciliationsQuery.isLoading}
      isError={bankAccountsQuery.isError || reconciliationsQuery.isError}
      isEmpty={isEmpty}
      emptyMessage="No bank account is on file for this branch, so there is nothing to reconcile yet. The reconciliation workbench arrives in B5.3."
      actions={<AccountingRouteScopeNote routeKey="bank.reconciliations" />}
      footnote={
        <>
          <AccountingUnpaginatedNote
            label={unpaginatedCountLabel(reconciliationCount, "reconciliations")}
          />{" "}
          <AccountingReadOnlyNote
            actions={["Importing a statement", "matching or skipping a line", "completing a reconciliation"]}
          />
        </>
      }
    >
      <AccountingPrimaryKpi
        kpiKey="bank.activeReconciliations"
        value={formatAccountingCount(active)}
        hint="Open or in progress."
        tone={(active ?? 0) > 0 ? "warning" : "default"}
      />
      <AccountingStatList
        rows={[
          { kpiKey: "bank.reconciliations", value: formatAccountingCount(reconciliationCount) },
          {
            kpiKey: "bank.accounts",
            value: bankAccountsQuery.isError ? "Unavailable" : formatAccountingCount(accountCount),
          },
        ]}
      />
    </ManagerDashboardCard>
  );
}
