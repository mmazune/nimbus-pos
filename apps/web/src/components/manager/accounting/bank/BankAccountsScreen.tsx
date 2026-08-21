import { useMemo } from "react";

import { AccountingRouteScopeNote, AccountingUnpaginatedNote } from "@/components/manager/accounting/shared";
import { ManagerContentShell, ManagerControlPanel, ManagerListTable, type ManagerListColumn } from "@/components/manager/chrome";
import { Badge } from "@/components/ui";
import { unpaginatedCountLabel } from "@/lib/accounting/model";
import type { BankAccountRow } from "@/lib/accounting/types";
import { useBankAccountsList } from "@/lib/manager/accounting-surface-queries";

/**
 * Bank → Bank accounts — Track B5.3. `GET /accounting/bank-accounts`.
 *
 * List-only, like B5.2's Credit notes surfaces: the route registry carries no
 * `bank.account` detail key (there is no `GET /bank-accounts/:id`), so a row
 * click would have nowhere real to go. PC-06: this is a bare array with no
 * server total and no server-side filter of any kind — the array IS the
 * complete branch result set, counted and labelled as a client count.
 */
export function BankAccountsScreen() {
  const listQuery = useBankAccountsList();
  const rows = useMemo(() => listQuery.data || [], [listQuery.data]);
  const count = Array.isArray(listQuery.data) ? listQuery.data.length : null;

  const columns: ManagerListColumn<BankAccountRow>[] = useMemo(
    () => [
      { key: "name", header: "Bank account", render: (row) => row.name || row.id },
      { key: "accountCode", header: "Code", render: (row) => row.accountCode || "—" },
      { key: "bankName", header: "Bank", optional: true, render: (row) => row.bankName || "—" },
      { key: "currencyCode", header: "Currency", optional: true, render: (row) => row.currencyCode || "—" },
      {
        key: "isActive",
        header: "Active",
        render: (row) => (row.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Inactive</Badge>),
      },
    ],
    [],
  );

  return (
    <ManagerContentShell>
      <ManagerControlPanel
        title="Bank accounts"
        badge={
          <>
            <Badge variant="neutral">Read-only</Badge>
            <AccountingRouteScopeNote routeKey="bank.accounts" />
          </>
        }
      />

      <ManagerListTable
        caption="Bank accounts"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        onRetry={() => void listQuery.refetch()}
        errorMessage="Bank accounts could not be read for the selected branch. Retry, or change branch."
        emptyTitle="No bank accounts"
        emptyMessage="No bank account is on file for this branch."
      />

      <p className="text-xs leading-5 text-text-muted">
        <AccountingUnpaginatedNote label={unpaginatedCountLabel(count, "bank accounts")} /> There is no balance
        column on this record — see Bank statements for balances and Reconciliation for match state.
      </p>
    </ManagerContentShell>
  );
}
