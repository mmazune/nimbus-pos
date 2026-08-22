import { useMemo, useState } from "react";

import { AccountingRouteScopeNote, AccountingTextField, AccountingUnpaginatedNote } from "@/components/manager/accounting/shared";
import { ManagerContentShell, ManagerControlPanel, ManagerListTable, type ManagerListColumn } from "@/components/manager/chrome";
import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { Badge, Button } from "@/components/ui";
import type { CostCenterRow } from "@/lib/accounting/types";
import { useCostCentersList, useCreateCostCenter } from "@/lib/manager/accounting-configuration-queries";

/**
 * Accounting → Configuration → Cost centres — Track B5.6 (2026-08-22).
 *
 * `GET /accounting/cost-centers` — a PC-06 bare array, `where: {active:
 * true}` only, no filter or pagination params exist server-side. ORGANISATION
 * data. **Write-enabled** (PERMS-2): `pos:accounting:cost-centers:create`
 * creates a new cost centre. There is genuinely no edit/deactivate route —
 * only Create exists at the API layer.
 */
export function CostCentresScreen() {
  const listQuery = useCostCentersList();
  const createMutation = useCreateCostCenter();

  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const rows = useMemo(() => listQuery.data || [], [listQuery.data]);
  const count = Array.isArray(listQuery.data) ? listQuery.data.length : null;

  function resetForm() {
    setCode("");
    setName("");
    setDescription("");
    setFormError(null);
  }

  const formValid = code.trim().length > 0 && name.trim().length > 0;

  async function submitCreate() {
    setFormError(null);
    try {
      await createMutation.mutateAsync({
        code: code.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setCreateOpen(false);
      resetForm();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "The cost centre could not be created. Retry.",
      );
    }
  }

  const columns: ManagerListColumn<CostCenterRow>[] = useMemo(
    () => [
      { key: "code", header: "Code", render: (row) => row.code },
      { key: "name", header: "Name", render: (row) => row.name },
      { key: "description", header: "Description", optional: true, render: (row) => row.description || "—" },
      {
        key: "active",
        header: "Status",
        render: (row) => <Badge variant={row.active ? "success" : "neutral"}>{row.active ? "Active" : "Inactive"}</Badge>,
      },
    ],
    [],
  );

  return (
    <ManagerContentShell>
      <ManagerControlPanel
        title="Cost centres"
        badge={
          <>
            <Badge variant="info">Read + write</Badge>
            <AccountingRouteScopeNote routeKey="accounting.costCenters" />
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
            New cost centre
          </Button>
        }
      />

      <ManagerListTable
        caption="Cost centres"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        onRetry={() => void listQuery.refetch()}
        errorMessage="Cost centres could not be read. Retry."
        emptyTitle="No cost centres"
        emptyMessage="No cost centre has been created for this organisation yet."
      />

      <p className="text-xs leading-5 text-text-muted">
        <AccountingUnpaginatedNote label={`Showing all ${count ?? "?"} active cost centres`} /> There is no
        edit or deactivate route for a cost centre once created.
      </p>

      <ActionConfirmDialog
        open={createOpen}
        title="New cost centre"
        consequence="Creates a new cost centre for this organisation. The code must be unique — a repeat is refused."
        tone="info"
        confirmLabel="Create cost centre"
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
        </div>
        <AccountingTextField
          label="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={createMutation.isPending}
        />
      </ActionConfirmDialog>
    </ManagerContentShell>
  );
}
