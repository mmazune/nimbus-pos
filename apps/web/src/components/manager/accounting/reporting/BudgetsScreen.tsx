import { useMemo, useState } from "react";

import {
  AccountingFormError,
  AccountingSelectField,
  AccountingTextField,
  AccountingUnpaginatedNote,
} from "@/components/manager/accounting/shared";
import {
  ManagerContentShell,
  ManagerControlPanel,
  ManagerListTable,
  type ManagerListColumn,
} from "@/components/manager/chrome";
import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { Badge, Button } from "@/components/ui";
import {
  formatAccountingDate,
  formatAccountingMoney,
  isBudgetArchived,
  titleCaseAccountingStatus,
  accountingStatusTone,
} from "@/lib/accounting/model";
import { BUDGET_TYPES, type BudgetRow } from "@/lib/accounting/types";
import { useManagerBranch } from "@/lib/manager/branch-context";
import {
  useBudgetsList,
  useChartOfAccountsList,
  useCostCentersList,
  useCreateBudget,
  useRefreshBudgetActuals,
} from "@/lib/manager/accounting-configuration-queries";

type DraftLine = {
  category: string;
  accountId: string;
  costCenterId: string;
  budgetAmount: string;
};

const EMPTY_LINE: DraftLine = { category: "", accountId: "", costCenterId: "", budgetAmount: "" };

/**
 * Accounting → Reporting → Budgets vs actuals — Track B5.6 (2026-08-22).
 *
 * `GET /finance/budgets` is a PC-06 bare array (`budget.service.ts`'s
 * `listBudgets` is a plain `findMany`, never `{data,total}`) — this screen
 * fetches the complete branch result set and labels the count honestly, the
 * same pattern every other bare-array B5 surface uses.
 *
 * **Write-enabled** (PERMS-2, 2026-08-21): `finance:budget:write` creates a
 * balanced budget with line items; `finance:budget:update-actuals` recomputes
 * each line's actual/variance from POSTED journal lines. There is genuinely
 * no edit or delete route for a budget once created — only create and
 * refresh-actuals exist at the API layer, so this screen offers exactly
 * those two actions and nothing that would imply a third.
 *
 * "Refresh actuals" 400s server-side on an ARCHIVED budget — disabled here
 * before the request rather than after a failed round-trip.
 */
export function BudgetsScreen() {
  const branch = useManagerBranch();
  const listQuery = useBudgetsList({});
  const accountsQuery = useChartOfAccountsList({ take: 100 });
  const costCentersQuery = useCostCentersList();
  const createMutation = useCreateBudget();
  const refreshMutation = useRefreshBudgetActuals();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [budgetType, setBudgetType] = useState<string>("OPERATIONAL");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([{ ...EMPTY_LINE }]);
  const [formError, setFormError] = useState<string | null>(null);

  const [refreshTarget, setRefreshTarget] = useState<BudgetRow | null>(null);

  const rows = useMemo(() => listQuery.data || [], [listQuery.data]);
  const count = Array.isArray(listQuery.data) ? listQuery.data.length : null;
  const accounts = accountsQuery.data?.data || [];
  const costCenters = costCentersQuery.data || [];

  function resetForm() {
    setName("");
    setPeriodStart("");
    setPeriodEnd("");
    setBudgetType("OPERATIONAL");
    setNotes("");
    setLines([{ ...EMPTY_LINE }]);
    setFormError(null);
  }

  const linesValid =
    lines.length > 0 &&
    lines.every((line) => line.category.trim().length > 0 && Number(line.budgetAmount) >= 0 && line.budgetAmount !== "");
  const formValid = name.trim().length > 0 && Boolean(periodStart) && Boolean(periodEnd) && linesValid;

  async function submitCreate() {
    setFormError(null);
    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        periodStart,
        periodEnd,
        budgetType: budgetType as "OPERATIONAL" | "FINANCIAL",
        notes: notes.trim() || undefined,
        lines: lines.map((line) => ({
          category: line.category.trim(),
          accountId: line.accountId || undefined,
          costCenterId: line.costCenterId || undefined,
          budgetAmount: Number(line.budgetAmount),
        })),
      });
      setCreateOpen(false);
      resetForm();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "The budget could not be created. Retry.",
      );
    }
  }

  async function submitRefresh() {
    if (!refreshTarget) return;
    try {
      await refreshMutation.mutateAsync({ id: refreshTarget.id, payload: {} });
      setRefreshTarget(null);
    } catch {
      // Error surfaces via refreshMutation.error, rendered inside the dialog below.
    }
  }

  const columns: ManagerListColumn<BudgetRow>[] = useMemo(
    () => [
      { key: "name", header: "Name", render: (row) => row.name },
      {
        key: "type",
        header: "Type",
        render: (row) => titleCaseAccountingStatus(row.budgetType),
      },
      {
        key: "status",
        header: "Status",
        render: (row) => (
          <Badge variant={accountingStatusTone(row.status)}>{titleCaseAccountingStatus(row.status)}</Badge>
        ),
      },
      {
        key: "window",
        header: "Period",
        render: (row) => `${formatAccountingDate(row.periodStart)} – ${formatAccountingDate(row.periodEnd)}`,
      },
      {
        key: "total",
        header: "Total budget",
        numeric: true,
        render: (row) => formatAccountingMoney(row.totalBudget, branch.currencyCode),
      },
      {
        key: "lines",
        header: "Lines",
        optional: true,
        hideBelowLarge: true,
        render: (row) => String(row.lines?.length ?? 0),
      },
      {
        key: "actions",
        header: "Actions",
        render: (row) => (
          <Button
            variant="secondary"
            size="compact"
            disabled={isBudgetArchived(row.status)}
            onClick={() => setRefreshTarget(row)}
          >
            Refresh actuals
          </Button>
        ),
      },
    ],
    [branch.currencyCode],
  );

  return (
    <ManagerContentShell>
      <ManagerControlPanel
        title="Budgets vs actuals"
        badge={<Badge variant="info">Read + write</Badge>}
        primaryAction={
          <Button
            variant="primary"
            size="compact"
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
          >
            New budget
          </Button>
        }
      />

      <ManagerListTable
        caption="Budgets"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        onRetry={() => void listQuery.refetch()}
        errorMessage="Budgets could not be read for this branch. Retry."
        emptyTitle="No budgets"
        emptyMessage="No budget has been created for this branch yet."
      />

      <p className="text-xs leading-5 text-text-muted">
        <AccountingUnpaginatedNote label={`Showing all ${count ?? "?"} budgets`} /> There is no edit or
        delete route for a budget once created — only Create and Refresh actuals exist at the API layer.
      </p>

      <ActionConfirmDialog
        open={createOpen}
        title="New budget"
        consequence="Creates a DRAFT budget with the line items below. A repeat submission for the same fiscal period, type and version is refused."
        size="lg"
        tone="info"
        confirmLabel="Create budget"
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
          <AccountingTextField
            label="Name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={createMutation.isPending}
          />
          <AccountingSelectField
            label="Budget type"
            value={budgetType}
            onChange={(event) => setBudgetType(event.target.value)}
            disabled={createMutation.isPending}
          >
            {BUDGET_TYPES.map((type) => (
              <option key={type} value={type}>
                {titleCaseAccountingStatus(type)}
              </option>
            ))}
          </AccountingSelectField>
          <AccountingTextField
            label="Period start"
            required
            type="date"
            value={periodStart}
            onChange={(event) => setPeriodStart(event.target.value)}
            disabled={createMutation.isPending}
          />
          <AccountingTextField
            label="Period end"
            required
            type="date"
            value={periodEnd}
            onChange={(event) => setPeriodEnd(event.target.value)}
            disabled={createMutation.isPending}
          />
        </div>

        <AccountingTextField
          label="Notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          disabled={createMutation.isPending}
        />

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-text-primary">Lines</h3>
            <Button
              variant="tertiary"
              size="compact"
              type="button"
              disabled={createMutation.isPending}
              onClick={() => setLines((current) => [...current, { ...EMPTY_LINE }])}
            >
              + Add line
            </Button>
          </div>

          {lines.map((line, index) => (
            <div key={index} className="grid gap-3 rounded-md bg-surface-muted p-3 sm:grid-cols-[2fr_2fr_2fr_1fr_auto]">
              <AccountingTextField
                label="Category"
                required
                value={line.category}
                onChange={(event) =>
                  setLines((current) =>
                    current.map((l, i) => (i === index ? { ...l, category: event.target.value } : l)),
                  )
                }
                disabled={createMutation.isPending}
              />
              <AccountingSelectField
                label="GL account"
                placeholder="None"
                value={line.accountId}
                onChange={(event) =>
                  setLines((current) =>
                    current.map((l, i) => (i === index ? { ...l, accountId: event.target.value } : l)),
                  )
                }
                disabled={createMutation.isPending}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} — {account.name}
                  </option>
                ))}
              </AccountingSelectField>
              <AccountingSelectField
                label="Cost centre"
                placeholder="None"
                value={line.costCenterId}
                onChange={(event) =>
                  setLines((current) =>
                    current.map((l, i) => (i === index ? { ...l, costCenterId: event.target.value } : l)),
                  )
                }
                disabled={createMutation.isPending}
              >
                {costCenters.map((cc) => (
                  <option key={cc.id} value={cc.id}>
                    {cc.code} — {cc.name}
                  </option>
                ))}
              </AccountingSelectField>
              <AccountingTextField
                label="Amount"
                required
                type="number"
                min="0"
                step="0.01"
                value={line.budgetAmount}
                onChange={(event) =>
                  setLines((current) =>
                    current.map((l, i) => (i === index ? { ...l, budgetAmount: event.target.value } : l)),
                  )
                }
                disabled={createMutation.isPending}
              />
              <Button
                variant="tertiary"
                size="compact"
                type="button"
                disabled={createMutation.isPending || lines.length === 1}
                onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                className="self-end"
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </ActionConfirmDialog>

      <ActionConfirmDialog
        open={Boolean(refreshTarget)}
        title="Refresh actuals?"
        consequence={`Pulls POSTED journal-line sums for every line in "${refreshTarget?.name || "this budget"}" and recomputes each line's actual and variance. This does not change the planned budget amounts.`}
        tone="warning"
        confirmLabel="Refresh actuals"
        pending={refreshMutation.isPending}
        error={refreshMutation.error instanceof Error ? refreshMutation.error.message : null}
        onCancel={() => setRefreshTarget(null)}
        onConfirm={() => void submitRefresh()}
      />
    </ManagerContentShell>
  );
}
