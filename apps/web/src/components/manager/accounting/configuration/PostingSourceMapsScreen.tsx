import { useMemo, useState } from "react";

import {
  AccountingCheckboxField,
  AccountingFormError,
  AccountingRouteScopeNote,
  AccountingSelectField,
  AccountingTextField,
  AccountingUnpaginatedNote,
} from "@/components/manager/accounting/shared";
import { ManagerContentShell, ManagerControlPanel, ManagerListTable, type ManagerListColumn } from "@/components/manager/chrome";
import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { Badge, Button } from "@/components/ui";
import { isPostingSourceMapValid } from "@/lib/accounting/model";
import type { PostingSourceMapRow } from "@/lib/accounting/types";
import {
  useChartOfAccountsList,
  usePostingSourceMapsList,
  useUpdatePostingSourceMap,
} from "@/lib/manager/accounting-configuration-queries";

/**
 * Accounting → Configuration → Posting source maps — Track B5.6 (2026-08-22).
 *
 * `GET /accounting/posting-source-maps` — a PC-06 bare array. ORGANISATION
 * data. **Write-enabled** (PERMS-2): `pos:accounting:posting-source-maps:
 * update` edits an existing row (debit/credit account, cost-centre
 * requirement, active, notes). **There is no create route** — rows are
 * seed/system-created against a fixed `sourceKey` (e.g. `POS_SALE`,
 * `AP_BILL`) that this UI never edits, so this screen is edit-only over a
 * fixed row set, and `costCenterRequired`/`active` are ALWAYS sent
 * explicitly in the PATCH body — the service treats an omitted boolean as
 * "don't touch this field", so an unchecked-but-omitted checkbox would
 * silently fail to take effect.
 */
export function PostingSourceMapsScreen() {
  const listQuery = usePostingSourceMapsList();
  const accountsQuery = useChartOfAccountsList({ take: 100 });
  const updateMutation = useUpdatePostingSourceMap();

  const [editing, setEditing] = useState<PostingSourceMapRow | null>(null);
  const [debitAccountId, setDebitAccountId] = useState("");
  const [creditAccountId, setCreditAccountId] = useState("");
  const [costCenterRequired, setCostCenterRequired] = useState(false);
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const rows = useMemo(() => listQuery.data || [], [listQuery.data]);
  const count = Array.isArray(listQuery.data) ? listQuery.data.length : null;
  const accounts = accountsQuery.data?.data || [];

  const validity = isPostingSourceMapValid(debitAccountId, creditAccountId);
  const formValid = validity !== false;

  function openEdit(row: PostingSourceMapRow) {
    setEditing(row);
    setDebitAccountId(row.debitAccountId || "");
    setCreditAccountId(row.creditAccountId || "");
    setCostCenterRequired(Boolean(row.costCenterRequired));
    setActive(row.active !== false);
    setNotes(row.notes || "");
    setFormError(null);
  }

  async function submit() {
    if (!editing) return;
    setFormError(null);
    try {
      await updateMutation.mutateAsync({
        id: editing.id,
        payload: {
          debitAccountId: debitAccountId || undefined,
          creditAccountId: creditAccountId || undefined,
          costCenterRequired,
          active,
          notes: notes.trim() || undefined,
        },
      });
      setEditing(null);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "This posting source map could not be saved. Retry.",
      );
    }
  }

  const columns: ManagerListColumn<PostingSourceMapRow>[] = useMemo(
    () => [
      { key: "sourceKey", header: "Source key", render: (row) => row.sourceKey },
      {
        key: "debit",
        header: "Debit account",
        render: (row) => (row.debitAccount ? `${row.debitAccount.code} — ${row.debitAccount.name}` : "Not set"),
      },
      {
        key: "credit",
        header: "Credit account",
        render: (row) => (row.creditAccount ? `${row.creditAccount.code} — ${row.creditAccount.name}` : "Not set"),
      },
      {
        key: "costCentre",
        header: "Cost centre required",
        optional: true,
        render: (row) => (row.costCenterRequired ? "Yes" : "No"),
      },
      {
        key: "active",
        header: "Status",
        render: (row) => <Badge variant={row.active ? "success" : "neutral"}>{row.active ? "Active" : "Inactive"}</Badge>,
      },
      {
        key: "actions",
        header: "Actions",
        render: (row) => (
          <Button variant="secondary" size="compact" onClick={() => openEdit(row)}>
            Edit
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <ManagerContentShell>
      <ManagerControlPanel
        title="Posting source maps"
        badge={
          <>
            <Badge variant="info">Read + write</Badge>
            <AccountingRouteScopeNote routeKey="accounting.postingSourceMaps" />
          </>
        }
      />

      <ManagerListTable
        caption="Posting source maps"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        onRetry={() => void listQuery.refetch()}
        errorMessage="Posting source maps could not be read. Retry."
        emptyTitle="No posting source maps"
        emptyMessage="No posting source map is seeded for this organisation."
      />

      <p className="text-xs leading-5 text-text-muted">
        <AccountingUnpaginatedNote label={`Showing all ${count ?? "?"} maps`} /> There is no create route
        — rows are seed/system-created against a fixed source key this screen never edits.
      </p>

      <ActionConfirmDialog
        open={Boolean(editing)}
        title={editing ? `Edit "${editing.sourceKey}"` : "Edit posting source map"}
        consequence="Saves the debit/credit account mapping, cost-centre requirement, active flag and notes for this posting source."
        size="lg"
        tone="info"
        confirmLabel="Save changes"
        pending={updateMutation.isPending}
        confirmDisabled={!formValid}
        error={formError}
        onCancel={() => setEditing(null)}
        onConfirm={() => void submit()}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <AccountingSelectField
            label="Debit account"
            placeholder="Not set"
            value={debitAccountId}
            onChange={(event) => setDebitAccountId(event.target.value)}
            disabled={updateMutation.isPending}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} — {account.name}
              </option>
            ))}
          </AccountingSelectField>
          <AccountingSelectField
            label="Credit account"
            placeholder="Not set"
            value={creditAccountId}
            onChange={(event) => setCreditAccountId(event.target.value)}
            disabled={updateMutation.isPending}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} — {account.name}
              </option>
            ))}
          </AccountingSelectField>
        </div>
        {validity === false ? (
          <AccountingFormError message="Debit and credit account must be different." />
        ) : null}
        <AccountingTextField label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} disabled={updateMutation.isPending} />
        <div className="flex flex-col gap-2">
          <AccountingCheckboxField
            label="Cost centre required"
            checked={costCenterRequired}
            onChange={setCostCenterRequired}
            disabled={updateMutation.isPending}
          />
          <AccountingCheckboxField label="Active" checked={active} onChange={setActive} disabled={updateMutation.isPending} />
        </div>
      </ActionConfirmDialog>
    </ManagerContentShell>
  );
}
