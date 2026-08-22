import { useMemo, useState } from "react";

import {
  AccountingCheckboxField,
  AccountingRouteScopeNote,
  AccountingSelectField,
  AccountingTextField,
} from "@/components/manager/accounting/shared";
import { ManagerContentShell, ManagerControlPanel, ManagerListTable, type ManagerListColumn } from "@/components/manager/chrome";
import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { Badge, Button } from "@/components/ui";
import { titleCaseAccountingStatus } from "@/lib/accounting/model";
import { CHART_ACCOUNT_TYPES, type ChartAccountRow } from "@/lib/accounting/types";
import { useChartOfAccountsList, useCreateAccount } from "@/lib/manager/accounting-configuration-queries";

/**
 * Accounting → Configuration → Chart of accounts — Track B5.6 (2026-08-22).
 *
 * `GET /accounting/accounts` — `{data, total}`, a real server total
 * (`data-total-unpaged`). ORGANISATION data: `listAccounts` filters on
 * `orgId` alone, even though `branchId` is stamped on create. **Write-
 * enabled** (PERMS-2): `pos:accounting:accounts:create` creates a new GL
 * account. There is genuinely no edit/archive route for an account once
 * created — `AccountStatus` is stuck at the DB default `ACTIVE` for every
 * account this API creates — so this screen offers exactly Create, nothing
 * that would imply an edit or deactivate control.
 */
export function ChartOfAccountsScreen() {
  const listQuery = useChartOfAccountsList({ take: 100 });
  const createMutation = useCreateAccount();

  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<string>(CHART_ACCOUNT_TYPES[0]);
  const [parentAccountId, setParentAccountId] = useState("");
  const [allowManualPosting, setAllowManualPosting] = useState(true);
  const [taxRelevant, setTaxRelevant] = useState(false);
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const rows = useMemo(() => listQuery.data?.data || [], [listQuery.data]);
  const total = listQuery.data?.total ?? null;

  function resetForm() {
    setCode("");
    setName("");
    setAccountType(CHART_ACCOUNT_TYPES[0]);
    setParentAccountId("");
    setAllowManualPosting(true);
    setTaxRelevant(false);
    setNotes("");
    setFormError(null);
  }

  const formValid = code.trim().length > 0 && name.trim().length > 0;

  async function submitCreate() {
    setFormError(null);
    try {
      await createMutation.mutateAsync({
        code: code.trim(),
        name: name.trim(),
        accountType,
        parentAccountId: parentAccountId || undefined,
        allowManualPosting,
        taxRelevant,
        notes: notes.trim() || undefined,
      });
      setCreateOpen(false);
      resetForm();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "The account could not be created. Retry.",
      );
    }
  }

  const columns: ManagerListColumn<ChartAccountRow>[] = useMemo(
    () => [
      { key: "code", header: "Code", render: (row) => row.code },
      { key: "name", header: "Name", render: (row) => row.name },
      { key: "type", header: "Type", render: (row) => titleCaseAccountingStatus(row.accountType) },
      {
        key: "status",
        header: "Status",
        render: (row) => <Badge variant={row.status === "ACTIVE" ? "success" : "neutral"}>{titleCaseAccountingStatus(row.status)}</Badge>,
      },
      {
        key: "posting",
        header: "Manual posting",
        optional: true,
        render: (row) => (row.allowManualPosting ? "Allowed" : "Blocked"),
      },
      {
        key: "tax",
        header: "Tax relevant",
        optional: true,
        hideBelowLarge: true,
        render: (row) => (row.taxRelevant ? "Yes" : "No"),
      },
    ],
    [],
  );

  return (
    <ManagerContentShell>
      <ManagerControlPanel
        title="Chart of accounts"
        badge={
          <>
            <Badge variant="info">Read + write</Badge>
            <AccountingRouteScopeNote routeKey="accounting.chartOfAccounts" />
          </>
        }
        primaryAction={
          <Button
            variant="primary"
            size="compact"
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
          >
            New account
          </Button>
        }
      />

      <ManagerListTable
        caption="Chart of accounts"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        onRetry={() => void listQuery.refetch()}
        errorMessage="The chart of accounts could not be read. Retry."
        emptyTitle="No accounts"
        emptyMessage="No account has been created for this organisation yet."
      />

      <p className="text-xs leading-5 text-text-muted">
        {total !== null ? `${total} accounts on file for this organisation.` : "Account count unavailable."} There is no
        edit or archive route for an account once created — every account created through this API stays
        ACTIVE.
      </p>

      <ActionConfirmDialog
        open={createOpen}
        title="New account"
        consequence="Creates a new chart-of-accounts entry for this organisation. The account code must be unique — a repeat is refused."
        size="lg"
        tone="info"
        confirmLabel="Create account"
        pending={createMutation.isPending}
        confirmDisabled={!formValid}
        error={formError}
        onCancel={() => {
          setCreateOpen(false);
          resetForm();
        }}
        onConfirm={() => void submitCreate()}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <AccountingTextField label="Code" required value={code} onChange={(event) => setCode(event.target.value)} disabled={createMutation.isPending} />
          <AccountingTextField label="Name" required value={name} onChange={(event) => setName(event.target.value)} disabled={createMutation.isPending} />
          <AccountingSelectField
            label="Account type"
            value={accountType}
            onChange={(event) => setAccountType(event.target.value)}
            disabled={createMutation.isPending}
          >
            {CHART_ACCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>
                {titleCaseAccountingStatus(type)}
              </option>
            ))}
          </AccountingSelectField>
          <AccountingSelectField
            label="Parent account"
            placeholder="None"
            value={parentAccountId}
            onChange={(event) => setParentAccountId(event.target.value)}
            disabled={createMutation.isPending}
          >
            {rows.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} — {account.name}
              </option>
            ))}
          </AccountingSelectField>
        </div>
        <AccountingTextField label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} disabled={createMutation.isPending} />
        <div className="flex flex-col gap-2">
          <AccountingCheckboxField
            label="Allow manual posting"
            checked={allowManualPosting}
            onChange={setAllowManualPosting}
            disabled={createMutation.isPending}
          />
          <AccountingCheckboxField
            label="Tax relevant"
            checked={taxRelevant}
            onChange={setTaxRelevant}
            disabled={createMutation.isPending}
          />
        </div>
      </ActionConfirmDialog>
    </ManagerContentShell>
  );
}
