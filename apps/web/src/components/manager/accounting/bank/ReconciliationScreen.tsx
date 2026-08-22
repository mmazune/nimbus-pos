import { useRouter } from "next/router";
import { useMemo, useState } from "react";

import {
  AccountingBackLink,
  AccountingFieldRow,
  AccountingReadOnlyCard,
  AccountingRouteScopeNote,
  AccountingTextField,
  AccountingUnpaginatedNote,
} from "@/components/manager/accounting/shared";
import {
  ManagerBreadcrumbs,
  ManagerContentShell,
  ManagerControlPanel,
  ManagerFilterChip,
  ManagerListTable,
  ManagerSearchFilterMenu,
  ManagerStatusPipeline,
  type ManagerListColumn,
} from "@/components/manager/chrome";
import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { Badge, Button, ErrorState, LoadingState } from "@/components/ui";
import {
  accountingStatusTone,
  formatAccountingCount,
  formatAccountingDate,
  formatAccountingMoney,
  isReconciliationBalanced,
  reconciliationPipelineIndex,
  RECONCILIATION_PIPELINE,
  titleCaseAccountingStatus,
  unpaginatedCountLabel,
} from "@/lib/accounting/model";
import { ACCOUNTING_ROUTES } from "@/lib/accounting/routes";
import {
  BANK_RECONCILIATION_STATUSES,
  type BankReconciliationRow,
  type BankStatementLineRow,
} from "@/lib/accounting/types";
import { useBankReconciliationDetail, useBankReconciliationsList } from "@/lib/manager/accounting-surface-queries";
import { useManagerBranch } from "@/lib/manager/branch-context";
import { buildManagerListQuery, firstManagerQueryValue, readManagerEnum } from "@/lib/manager/accounting-route";
import {
  useCompleteReconciliation,
  useMatchReconciliationLine,
  useSkipReconciliationLine,
} from "@/lib/manager/accounting-transitions-queries";

const RECONCILIATION_PIPELINE_LABELS = RECONCILIATION_PIPELINE.map(titleCaseAccountingStatus);

/**
 * Bank → Reconciliation — Track B5.3 (list+detail read), **write-enabled by
 * Track B5.7** (2026-08-22). `GET /accounting/reconciliation` +
 * `GET /accounting/reconciliation/:id` + `PATCH .../:id/match` +
 * `PATCH .../:id/skip` + `POST .../:id/complete`.
 *
 * Nimbus's honest analogue of Odoo's match/skip/complete workbench — B5.3
 * shipped it read-only because Manager held `:read` but neither `:match` nor
 * `:create` (PC-01); PERMS-2 (2026-08-21) resolved that, and this phase is
 * the first authorised to build the workbench for real. Match/Skip act on an
 * individual UNMATCHED statement line; Complete acts on the whole
 * reconciliation and is disabled client-side while the balance difference is
 * non-zero (the backend 400s on a non-zero-difference complete — the form
 * disables rather than lets that happen).
 *
 * ⚠️ Match asks for a journal-line id or a manual-entry id directly — there
 * is no "browse available lines to match against" picker in this phase (no
 * such list endpoint was in scope); a Manager matching a line needs to
 * already know which journal line or manual entry it corresponds to.
 *
 * PC-06 applies to the list the same way it does to bank-statements: a bare
 * array, no server total, no server-side status filter — the status chip
 * filters the already-fetched complete array client-side.
 */
export function ReconciliationScreen() {
  const router = useRouter();
  const status = readManagerEnum(router.query.status, BANK_RECONCILIATION_STATUSES);
  const selectedReconciliationId = firstManagerQueryValue(router.query.reconciliationId);
  const { currencyCode } = useManagerBranch();

  const listQuery = useBankReconciliationsList();
  const allRows = useMemo(() => listQuery.data || [], [listQuery.data]);
  const rows = useMemo(
    () => (status ? allRows.filter((row) => (row.status || "").toUpperCase() === status) : allRows),
    [allRows, status],
  );
  const totalCount = Array.isArray(listQuery.data) ? listQuery.data.length : null;

  const patchQuery = (patch: Record<string, string | number | null>) =>
    void router.replace(
      { pathname: router.pathname, query: buildManagerListQuery(router.query, patch) },
      undefined,
      { shallow: true },
    );

  const openReconciliation = (reconciliationId: string | null) =>
    void router.push(
      { pathname: router.pathname, query: buildManagerListQuery(router.query, { reconciliationId }) },
      undefined,
      { shallow: true },
    );

  const columns: ManagerListColumn<BankReconciliationRow>[] = useMemo(
    () => [
      { key: "bankAccount", header: "Bank account", render: (row) => row.bankAccount?.name || "—" },
      { key: "bankStatement", header: "Statement", optional: true, render: (row) => row.bankStatement?.reference || "—" },
      {
        key: "statementBalance",
        header: "Statement balance",
        numeric: true,
        optional: true,
        render: (row) => formatAccountingMoney(row.statementBalance, currencyCode),
      },
      {
        key: "matchedTotal",
        header: "Matched",
        numeric: true,
        render: (row) => formatAccountingMoney(row.matchedTotal, currencyCode),
      },
      {
        key: "unmatchedCount",
        header: "Unmatched lines",
        numeric: true,
        render: (row) => formatAccountingCount(row.unmatchedCount ?? null),
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <Badge variant={accountingStatusTone(row.status)}>{titleCaseAccountingStatus(row.status)}</Badge>,
      },
    ],
    [currencyCode],
  );

  if (selectedReconciliationId) {
    return (
      <ReconciliationDetailPanel
        reconciliationId={selectedReconciliationId}
        pageRows={rows}
        onSelectReconciliation={openReconciliation}
      />
    );
  }

  return (
    <ManagerContentShell>
      <ManagerControlPanel
        title="Reconciliation"
        badge={
          <>
            <Badge variant="neutral">Read-only</Badge>
            <AccountingRouteScopeNote routeKey="bank.reconciliations" />
          </>
        }
        search={{
          emptyHint: "This endpoint has no text search — filter by status.",
          filterChips: status ? (
            <ManagerFilterChip label={titleCaseAccountingStatus(status)} onClear={() => patchQuery({ status: null })} />
          ) : null,
          filterMenu: (
            <ManagerSearchFilterMenu
              ariaLabel="Filter reconciliations"
              filters={BANK_RECONCILIATION_STATUSES.map((value) => ({ key: value, label: titleCaseAccountingStatus(value) }))}
              activeFilterKeys={status ? [status] : []}
              onToggleFilter={(key) => patchQuery({ status: status === key ? null : key })}
            />
          ),
        }}
      />

      <ManagerListTable
        caption="Reconciliations"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        onSelectRow={(row) => openReconciliation(row.id)}
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        onRetry={() => void listQuery.refetch()}
        errorMessage="Reconciliations could not be read for the selected branch. Retry, or change the filters."
        emptyTitle="No reconciliations match"
        emptyMessage="No bank reconciliation in this branch matches the current filter."
      />

      <p className="text-xs leading-5 text-text-muted">
        <AccountingUnpaginatedNote label={unpaginatedCountLabel(totalCount, "reconciliations")} />{" "}
        {status
          ? "The status filter is applied in the browser over the complete branch result — this endpoint accepts no server-side status parameter."
          : null}
      </p>

      <AccountingReadOnlyCard actions={["Starting a new reconciliation"]} />
    </ManagerContentShell>
  );
}

function ReconciliationDetailPanel({
  onSelectReconciliation,
  pageRows,
  reconciliationId,
}: {
  onSelectReconciliation: (id: string | null) => void;
  pageRows: readonly BankReconciliationRow[];
  reconciliationId: string;
}) {
  const { currencyCode } = useManagerBranch();
  const detailQuery = useBankReconciliationDetail(reconciliationId);
  const rec = detailQuery.data;
  const position = pageRows.findIndex((row) => row.id === reconciliationId);
  const pipelineIndex = reconciliationPipelineIndex(rec?.status);
  const balanced = isReconciliationBalanced(rec?.difference);
  const lines = rec?.bankStatement?.lines || [];
  // B5.7 live QA finding: the backend auto-transitions OPEN → IN_PROGRESS on
  // the FIRST match/skip call — a fresh reconciliation is created OPEN, not
  // IN_PROGRESS. Gating line actions on IN_PROGRESS alone made the very first
  // match/skip on any reconciliation unreachable through this UI. Both
  // pre-COMPLETED statuses accept line actions; only COMPLETED/DISPUTED do not.
  const canActOnLines = ["OPEN", "IN_PROGRESS"].includes((rec?.status || "").toUpperCase());

  const matchMutation = useMatchReconciliationLine();
  const skipMutation = useSkipReconciliationLine();
  const completeMutation = useCompleteReconciliation();

  const [lineDialog, setLineDialog] = useState<{ kind: "match" | "skip"; line: BankStatementLineRow } | null>(null);
  const [journalLineId, setJournalLineId] = useState("");
  const [manualEntryId, setManualEntryId] = useState("");
  const [lineNotes, setLineNotes] = useState("");
  const [lineError, setLineError] = useState<string | null>(null);

  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  function openLineDialog(kind: "match" | "skip", line: BankStatementLineRow) {
    setJournalLineId("");
    setManualEntryId("");
    setLineNotes("");
    setLineError(null);
    setLineDialog({ kind, line });
  }

  const lineMutation = lineDialog?.kind === "match" ? matchMutation : skipMutation;
  const matchFormValid = lineDialog?.kind !== "match" || journalLineId.trim().length > 0 || manualEntryId.trim().length > 0;

  async function submitLineDecision() {
    if (!lineDialog || !rec) return;
    setLineError(null);
    try {
      if (lineDialog.kind === "match") {
        await matchMutation.mutateAsync({
          id: rec.id,
          payload: {
            bankStatementLineId: lineDialog.line.id,
            journalLineId: journalLineId.trim() || undefined,
            manualEntryId: manualEntryId.trim() || undefined,
            notes: lineNotes.trim() || undefined,
          },
        });
      } else {
        await skipMutation.mutateAsync({
          id: rec.id,
          payload: { bankStatementLineId: lineDialog.line.id, notes: lineNotes.trim() || undefined },
        });
      }
      setLineDialog(null);
    } catch (error) {
      setLineError(
        error instanceof Error ? error.message : `The line could not be ${lineDialog.kind}ed. Retry.`,
      );
    }
  }

  async function submitComplete() {
    if (!rec) return;
    setCompleteError(null);
    try {
      await completeMutation.mutateAsync(rec.id);
      setCompleteOpen(false);
    } catch (error) {
      setCompleteError(
        error instanceof Error ? error.message : "This reconciliation could not be completed. Retry.",
      );
    }
  }

  const lineColumns: ManagerListColumn<BankStatementLineRow>[] = [
    { key: "txDate", header: "Date", render: (line) => formatAccountingDate(line.txDate) },
    { key: "description", header: "Description", render: (line) => line.description || "—" },
    {
      key: "direction",
      header: "Direction",
      render: (line) => (line.direction ? titleCaseAccountingStatus(line.direction) : "—"),
    },
    { key: "amount", header: "Amount", numeric: true, render: (line) => formatAccountingMoney(line.amount, currencyCode) },
    {
      key: "matchEvidence",
      header: "Matched via",
      render: (line) => {
        if (line.status !== "MATCHED") return "—";
        if (line.matchedJournalLineId) return "Journal line";
        if (line.matchedManualEntryId) return "Manual entry";
        return "—";
      },
    },
    { key: "matchedAt", header: "Matched", optional: true, render: (line) => formatAccountingDate(line.matchedAt) },
    {
      key: "status",
      header: "State",
      render: (line) => <Badge variant={accountingStatusTone(line.status)}>{titleCaseAccountingStatus(line.status)}</Badge>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (line) => {
        if (!canActOnLines || (line.status || "").toUpperCase() !== "UNMATCHED") {
          return <span className="text-xs text-text-muted">—</span>;
        }
        return (
          <div className="flex gap-2">
            <Button variant="secondary" size="compact" onClick={() => openLineDialog("match", line)}>
              Match
            </Button>
            <Button variant="secondary" size="compact" onClick={() => openLineDialog("skip", line)}>
              Skip
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <ManagerBreadcrumbs
        parent={{ label: "Reconciliation", href: ACCOUNTING_ROUTES.bankReconciliation }}
        recordLabel={rec?.bankAccount?.name ? `Reconciliation — ${rec.bankAccount.name}` : "Reconciliation"}
        pager={
          position >= 0
            ? {
                position: position + 1,
                total: pageRows.length,
                hasPrevious: position > 0,
                hasNext: position < pageRows.length - 1,
                onPrevious: () => onSelectReconciliation(pageRows[position - 1].id),
                onNext: () => onSelectReconciliation(pageRows[position + 1].id),
              }
            : undefined
        }
      />

      {detailQuery.isLoading ? (
        <LoadingState title="Loading reconciliation…" />
      ) : detailQuery.isError || !rec ? (
        <div className="flex flex-col items-start gap-3">
          <ErrorState
            title="Reconciliation unavailable"
            description="This reconciliation could not be read for the selected branch. It may belong to another branch, or the request failed."
          />
          <AccountingBackLink href={ACCOUNTING_ROUTES.bankReconciliation} label="Back to reconciliation" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ManagerStatusPipeline
              ariaLabel="Reconciliation lifecycle"
              stages={RECONCILIATION_PIPELINE_LABELS}
              currentIndex={pipelineIndex}
              exitLabel={`${titleCaseAccountingStatus(rec.status)} — left the reconciliation lifecycle`}
              exitTone="warning"
            />
          </div>

          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.5fr)]">
            <div className="min-w-0 rounded-lg bg-surface p-5 shadow-subtle">
              <h2 className="text-2xl font-bold tracking-tight text-text-primary">
                {rec.bankAccount?.name || "Bank account"}
              </h2>

              <dl className="mt-4 grid gap-x-8 sm:grid-cols-2">
                <AccountingFieldRow label="Statement">{rec.bankStatement?.reference || "—"}</AccountingFieldRow>
                <AccountingFieldRow label="Fiscal period">{rec.fiscalPeriod?.name || "—"}</AccountingFieldRow>
                <AccountingFieldRow label="Started by">
                  {rec.startedBy ? `${rec.startedBy.firstName || ""} ${rec.startedBy.lastName || ""}`.trim() || "—" : "—"}
                </AccountingFieldRow>
                <AccountingFieldRow label="Completed by">
                  {rec.completedBy
                    ? `${rec.completedBy.firstName || ""} ${rec.completedBy.lastName || ""}`.trim() || "—"
                    : "—"}
                </AccountingFieldRow>
                <AccountingFieldRow label="Started">{formatAccountingDate(rec.createdAt)}</AccountingFieldRow>
                <AccountingFieldRow label="Completed">{formatAccountingDate(rec.completedAt)}</AccountingFieldRow>
              </dl>

              {rec.notes ? <p className="mt-3 text-sm leading-6 text-text-secondary">{rec.notes}</p> : null}

              <h3 className="mt-6 text-xs font-bold uppercase tracking-[0.1em] text-text-muted">
                Statement lines{lines.length ? ` (${lines.length})` : ""}
              </h3>
              <div className="mt-2">
                <ManagerListTable
                  caption="Reconciliation statement lines"
                  columns={lineColumns}
                  rows={lines}
                  getRowId={(line) => line.id}
                  emptyTitle="No lines"
                  emptyMessage="This reconciliation has no linked statement, or its statement has no lines."
                />
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-5">
              <div className="min-w-0 rounded-lg bg-surface p-5 shadow-subtle">
                <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Balance</h3>
                <dl className="mt-3">
                  <AccountingFieldRow label="Statement balance">
                    {formatAccountingMoney(rec.statementBalance, currencyCode)}
                  </AccountingFieldRow>
                  <AccountingFieldRow label="Matched total">
                    {formatAccountingMoney(rec.matchedTotal, currencyCode)}
                  </AccountingFieldRow>
                  <AccountingFieldRow label="Difference">
                    <span
                      className={
                        balanced === true
                          ? "text-status-success"
                          : balanced === false
                            ? "text-status-warning"
                            : undefined
                      }
                    >
                      {formatAccountingMoney(rec.difference, currencyCode)}
                    </span>
                  </AccountingFieldRow>
                  <AccountingFieldRow label="Matched / Unmatched lines">
                    {formatAccountingCount(rec.matchedCount ?? null)} / {formatAccountingCount(rec.unmatchedCount ?? null)}
                  </AccountingFieldRow>
                </dl>
                {balanced === false ? (
                  <p className="mt-3 text-xs leading-5 text-text-secondary">
                    Completion requires this difference to be exactly zero — a non-zero difference is the endpoint
                    working as designed, not a defect, until every line is matched or skipped.
                  </p>
                ) : null}
              </div>

              {canActOnLines ? (
                <div className="min-w-0 rounded-lg bg-surface p-5 shadow-subtle">
                  <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Complete</h3>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    Requires every line to be matched or skipped and the difference to be exactly zero.
                  </p>
                  <Button
                    variant="primary"
                    size="compact"
                    className="mt-3"
                    disabled={balanced !== true}
                    onClick={() => {
                      setCompleteError(null);
                      setCompleteOpen(true);
                    }}
                  >
                    Complete reconciliation
                  </Button>
                </div>
              ) : (
                <AccountingReadOnlyCard actions={["Starting a new reconciliation"]} />
              )}
            </div>
          </div>
        </>
      )}

      <ActionConfirmDialog
        open={lineDialog !== null}
        title={lineDialog?.kind === "match" ? "Match statement line" : "Skip statement line"}
        consequence={
          lineDialog?.kind === "match"
            ? "Marks this statement line MATCHED against the journal line or manual entry you name below."
            : "Marks this statement line SKIPPED — it will not count toward the matched total."
        }
        tone="info"
        confirmLabel={lineDialog?.kind === "match" ? "Match" : "Skip"}
        pending={lineMutation.isPending}
        confirmDisabled={!matchFormValid}
        error={lineError}
        onCancel={() => setLineDialog(null)}
        onConfirm={() => void submitLineDecision()}
      >
        {lineDialog?.kind === "match" ? (
          <>
            <AccountingTextField
              label="Journal line ID"
              hint="Provide this OR a manual-entry ID."
              value={journalLineId}
              onChange={(event) => setJournalLineId(event.target.value)}
              disabled={matchMutation.isPending}
            />
            <AccountingTextField
              label="Manual entry ID"
              hint="Provide this OR a journal-line ID."
              value={manualEntryId}
              onChange={(event) => setManualEntryId(event.target.value)}
              disabled={matchMutation.isPending}
            />
          </>
        ) : null}
        <AccountingTextField
          label="Notes"
          hint="Optional."
          value={lineNotes}
          onChange={(event) => setLineNotes(event.target.value)}
          disabled={lineMutation.isPending}
        />
      </ActionConfirmDialog>

      <ActionConfirmDialog
        open={completeOpen}
        title="Complete reconciliation"
        consequence={`Marks this reconciliation COMPLETED. ${rec?.bankAccount?.name || ""}`.trim()}
        tone="info"
        confirmLabel="Complete"
        pending={completeMutation.isPending}
        error={completeError}
        onCancel={() => setCompleteOpen(false)}
        onConfirm={() => void submitComplete()}
      />
    </>
  );
}
