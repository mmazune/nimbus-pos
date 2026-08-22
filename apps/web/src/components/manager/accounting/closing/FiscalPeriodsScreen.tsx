import { useMemo, useState } from "react";

import { AccountingPeriodStatusBadge, AccountingRouteScopeNote, AccountingTextField, AccountingUnpaginatedNote } from "@/components/manager/accounting/shared";
import { ManagerContentShell, ManagerControlPanel, ManagerListTable, ManagerStatusPipeline, type ManagerListColumn } from "@/components/manager/chrome";
import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { Badge, Button } from "@/components/ui";
import {
  FISCAL_PERIOD_STATUSES,
  fiscalPeriodPipelineIndex,
  formatAccountingDate,
  toFiscalPeriodStatus,
  unpaginatedCountLabel,
} from "@/lib/accounting/model";
import type { FiscalPeriodRow } from "@/lib/accounting/types";
import { useFiscalPeriodsList } from "@/lib/manager/accounting-surface-queries";
import {
  useCloseFiscalPeriod,
  useCreateFiscalPeriod,
  useLockFiscalPeriod,
  useOpenFiscalPeriod,
} from "@/lib/manager/accounting-transitions-queries";

const PIPELINE_STAGES = FISCAL_PERIOD_STATUSES.map((status) => status.charAt(0) + status.slice(1).toLowerCase());

/**
 * Accounting → Fiscal periods — Track B5.5 (Closing, list-only read).
 * **Write-enabled by Track B5.7** (2026-08-22): `POST /accounting/periods`
 * (create) + `PATCH .../:id/open` + `.../close` + `.../lock`.
 *
 * Still list-only for READS, the same shape B5.4 shipped Posting runs in:
 * `accounting.controller.ts` declares no `GET /periods/:id`, so there is
 * nothing to drill into and no `?periodId=` state on this screen — every
 * field this page renders already arrives on the list row
 * (`listFiscalPeriods()` runs a plain `findMany` with no `select`, so the
 * full scalar row is on the wire). Lifecycle actions are therefore rendered
 * inline in the row, not behind a detail view.
 *
 * ⚠️ **ORGANISATION DATA.** `FiscalPeriod` has no `branch_id` column at all
 * (backend gap batch 2) — switching branch does NOT change this list, and the
 * scope badge says so. This is proven, not asserted: B5.5's own QA re-fetched
 * this route under two different `X-Branch-Id` headers and diffed the
 * response. Creating/opening/closing/locking a period is therefore an
 * organisation-wide action too, not scoped to the active branch.
 *
 * 🟢 **C-27 resolved by owner decision (PERMS-2) and built here.** Every
 * prior B5 phase disclosed that Manager's token held a stray
 * `pos:accounting:periods:create` grant but deliberately built no UI for it.
 * PERMS-2 (2026-08-21) turned that into a deliberate full grant
 * (`:open`/`:close`/`:lock` too), and Track B5.7 is the first phase
 * authorised to build on it.
 *
 * **PC-07: `DRAFT → OPEN → CLOSED → LOCKED`, four real stages, no side-branch
 * and no unlock route.** Unlike bank reconciliation's `DISPUTED` exit chip,
 * there is nothing here for a period to be diverted OFF the pipeline to — the
 * exit-chip mechanism is reused for exactly one thing: a status value this UI
 * does not recognise (`fiscalPeriodPipelineIndex` returns `-1` only then),
 * rendered as "Status unavailable" rather than guessed onto a real stage.
 * Because LOCK is genuinely irreversible (no unlock route exists anywhere in
 * this API), the Lock dialog requires the acting Manager to type the
 * period's own name before Lock enables — a generic "Are you sure?" is not
 * enough friction for a one-way door.
 */
type TransitionKind = "open" | "close" | "lock";

export function FiscalPeriodsScreen() {
  const listQuery = useFiscalPeriodsList();
  const rows = useMemo(() => listQuery.data || [], [listQuery.data]);
  const count = Array.isArray(listQuery.data) ? listQuery.data.length : null;

  const createMutation = useCreateFiscalPeriod();
  const openMutation = useOpenFiscalPeriod();
  const closeMutation = useCloseFiscalPeriod();
  const lockMutation = useLockFiscalPeriod();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const [transition, setTransition] = useState<{ kind: TransitionKind; period: FiscalPeriodRow } | null>(null);
  const [closeNotes, setCloseNotes] = useState("");
  const [lockConfirmName, setLockConfirmName] = useState("");
  const [transitionError, setTransitionError] = useState<string | null>(null);

  function resetCreateForm() {
    setName("");
    setStartsAt("");
    setEndsAt("");
    setCreateError(null);
  }

  const createFormValid = name.trim().length > 0 && startsAt.length > 0 && endsAt.length > 0;

  async function submitCreate() {
    setCreateError(null);
    try {
      await createMutation.mutateAsync({ name: name.trim(), startsAt, endsAt });
      setCreateOpen(false);
      resetCreateForm();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "The fiscal period could not be created. Retry.");
    }
  }

  function openTransition(kind: TransitionKind, period: FiscalPeriodRow) {
    setCloseNotes("");
    setLockConfirmName("");
    setTransitionError(null);
    setTransition({ kind, period });
  }

  const transitionMutation =
    transition?.kind === "open" ? openMutation : transition?.kind === "close" ? closeMutation : lockMutation;

  const lockConfirmMatches = transition?.kind !== "lock" || lockConfirmName.trim() === (transition.period.name || "");

  async function submitTransition() {
    if (!transition) return;
    setTransitionError(null);
    try {
      if (transition.kind === "open") {
        await openMutation.mutateAsync(transition.period.id);
      } else if (transition.kind === "close") {
        await closeMutation.mutateAsync({
          id: transition.period.id,
          payload: closeNotes.trim() ? { notes: closeNotes.trim() } : undefined,
        });
      } else {
        await lockMutation.mutateAsync(transition.period.id);
      }
      setTransition(null);
    } catch (error) {
      setTransitionError(
        error instanceof Error ? error.message : `The period could not be ${transition.kind}d. Retry.`,
      );
    }
  }

  const columns: ManagerListColumn<FiscalPeriodRow>[] = useMemo(
    () => [
      { key: "name", header: "Period", render: (row) => row.name || row.id },
      {
        key: "window",
        header: "Window",
        render: (row) => `${formatAccountingDate(row.startsAt)} – ${formatAccountingDate(row.endsAt)}`,
      },
      {
        key: "pipeline",
        header: "Lifecycle",
        render: (row) => {
          const status = toFiscalPeriodStatus(row.status);
          const index = fiscalPeriodPipelineIndex(status);
          return (
            <ManagerStatusPipeline
              ariaLabel={`${row.name || row.id} lifecycle`}
              stages={PIPELINE_STAGES}
              currentIndex={index}
              exitLabel="Status unavailable"
              exitTone="neutral"
            />
          );
        },
      },
      {
        key: "status",
        header: "Status",
        optional: true,
        defaultHidden: true,
        render: (row) => <AccountingPeriodStatusBadge status={toFiscalPeriodStatus(row.status)} />,
      },
      { key: "openedAt", header: "Opened", optional: true, hideBelowLarge: true, render: (row) => formatAccountingDate(row.openedAt) },
      { key: "closedAt", header: "Closed", optional: true, hideBelowLarge: true, render: (row) => formatAccountingDate(row.closedAt) },
      { key: "lockedAt", header: "Locked", optional: true, hideBelowLarge: true, render: (row) => formatAccountingDate(row.lockedAt) },
      {
        key: "actions",
        header: "Actions",
        render: (row) => {
          const status = toFiscalPeriodStatus(row.status);
          if (status === "DRAFT") {
            return (
              <Button variant="secondary" size="compact" onClick={() => openTransition("open", row)}>
                Open
              </Button>
            );
          }
          if (status === "OPEN") {
            return (
              <Button variant="secondary" size="compact" onClick={() => openTransition("close", row)}>
                Close
              </Button>
            );
          }
          if (status === "CLOSED") {
            return (
              <Button variant="danger" size="compact" onClick={() => openTransition("lock", row)}>
                Lock
              </Button>
            );
          }
          return <span className="text-xs text-text-muted">—</span>;
        },
      },
    ],
    [],
  );

  return (
    <ManagerContentShell>
      <ManagerControlPanel
        title="Fiscal periods"
        badge={
          <>
            <Badge variant="info">Read + write</Badge>
            <AccountingRouteScopeNote routeKey="accounting.periods" />
          </>
        }
        primaryAction={
          <Button
            variant="primary"
            size="compact"
            onClick={() => {
              resetCreateForm();
              setCreateOpen(true);
            }}
          >
            New period
          </Button>
        }
      />

      <ManagerListTable
        caption="Fiscal periods"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        onRetry={() => void listQuery.refetch()}
        errorMessage="Fiscal periods could not be read for this organisation. Retry."
        emptyTitle="No fiscal periods"
        emptyMessage="No fiscal period has been created for this organisation yet. Use New period to create one."
      />

      <p className="text-xs leading-5 text-text-muted">
        <AccountingUnpaginatedNote label={unpaginatedCountLabel(count, "fiscal periods")} /> Fiscal periods are
        organisation-wide on this backend — the model has no branch column, so this list (and every action
        below) is identical under every branch. Locked is final: this backend has no unlock route.
      </p>
      <p className="text-xs leading-5 text-text-muted" data-accounting-finding="C-27">
        Create builds on the C-27 grant (<code className="font-mono">pos:accounting:periods:create</code>) —
        a pre-existing permission Track B5.5 disclosed but deliberately did not build a control for. PERMS-2
        made it, and Open/Close/Lock, deliberate for Manager; Track B5.7 built the controls on top of it.
      </p>

      <ActionConfirmDialog
        open={createOpen}
        title="New fiscal period"
        consequence="Creates a new DRAFT fiscal period for this organisation."
        tone="info"
        confirmLabel="Create period"
        pending={createMutation.isPending}
        confirmDisabled={!createFormValid}
        error={createError}
        onCancel={() => {
          setCreateOpen(false);
          resetCreateForm();
        }}
        onConfirm={() => void submitCreate()}
      >
        <AccountingTextField label="Name" required value={name} onChange={(event) => setName(event.target.value)} disabled={createMutation.isPending} />
        <div className="grid gap-4 sm:grid-cols-2">
          <AccountingTextField
            label="Starts"
            type="date"
            required
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            disabled={createMutation.isPending}
          />
          <AccountingTextField
            label="Ends"
            type="date"
            required
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            disabled={createMutation.isPending}
          />
        </div>
      </ActionConfirmDialog>

      <ActionConfirmDialog
        open={transition !== null}
        title={
          transition?.kind === "open"
            ? "Open fiscal period"
            : transition?.kind === "close"
              ? "Close fiscal period"
              : "Lock fiscal period"
        }
        consequence={
          transition?.kind === "open"
            ? `Opens "${transition.period.name}" (DRAFT → OPEN). Postings can then land in this period.`
            : transition?.kind === "close"
              ? `Closes "${transition?.period.name}" (OPEN → CLOSED) and creates a period-close run computing retained earnings.`
              : `Locks "${transition?.period.name}" (CLOSED → LOCKED). This cannot be undone — there is no unlock route in this API.`
        }
        tone={transition?.kind === "lock" ? "danger" : "warning"}
        confirmLabel={transition?.kind === "open" ? "Open" : transition?.kind === "close" ? "Close" : "Lock permanently"}
        pending={transitionMutation.isPending}
        confirmDisabled={!lockConfirmMatches}
        error={transitionError}
        onCancel={() => setTransition(null)}
        onConfirm={() => void submitTransition()}
      >
        {transition?.kind === "close" ? (
          <AccountingTextField
            label="Notes"
            hint="Optional — recorded on the period-close run."
            value={closeNotes}
            onChange={(event) => setCloseNotes(event.target.value)}
            disabled={closeMutation.isPending}
          />
        ) : null}
        {transition?.kind === "lock" ? (
          <AccountingTextField
            label={`Type "${transition.period.name}" to confirm`}
            required
            value={lockConfirmName}
            onChange={(event) => setLockConfirmName(event.target.value)}
            disabled={lockMutation.isPending}
          />
        ) : null}
      </ActionConfirmDialog>
    </ManagerContentShell>
  );
}
