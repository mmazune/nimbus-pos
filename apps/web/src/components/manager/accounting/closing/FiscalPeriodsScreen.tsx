import { useMemo } from "react";

import { AccountingPeriodStatusBadge, AccountingRouteScopeNote, AccountingUnpaginatedNote } from "@/components/manager/accounting/shared";
import { ManagerContentShell, ManagerControlPanel, ManagerListTable, ManagerStatusPipeline, type ManagerListColumn } from "@/components/manager/chrome";
import { Badge } from "@/components/ui";
import {
  FISCAL_PERIOD_STATUSES,
  fiscalPeriodPipelineIndex,
  formatAccountingDate,
  toFiscalPeriodStatus,
  unpaginatedCountLabel,
} from "@/lib/accounting/model";
import type { FiscalPeriodRow } from "@/lib/accounting/types";
import { useFiscalPeriodsList } from "@/lib/manager/accounting-surface-queries";

const PIPELINE_STAGES = FISCAL_PERIOD_STATUSES.map((status) => status.charAt(0) + status.slice(1).toLowerCase());

/**
 * Accounting → Fiscal periods — Track B5.5 (Closing). `GET /accounting/periods`.
 *
 * List-only, the same shape B5.4 shipped Posting runs in: `accounting.controller.ts`
 * declares no `GET /periods/:id`, so there is nothing to drill into and no
 * `?periodId=` state on this screen — every field this page renders already
 * arrives on the list row (`listFiscalPeriods()` runs a plain `findMany` with
 * no `select`, so the full scalar row is on the wire).
 *
 * ⚠️ **ORGANISATION DATA.** `FiscalPeriod` has no `branch_id` column at all
 * (backend gap batch 2) — switching branch does NOT change this list, and the
 * scope badge says so. This is proven, not asserted: B5.5's own QA re-fetched
 * this route under two different `X-Branch-Id` headers and diffed the
 * response.
 *
 * **PC-07: `DRAFT → OPEN → CLOSED → LOCKED`, four real stages, no side-branch
 * and no unlock route.** Unlike bank reconciliation's `DISPUTED` exit chip,
 * there is nothing here for a period to be diverted OFF the pipeline to — the
 * exit-chip mechanism is reused for exactly one thing: a status value this UI
 * does not recognise (`fiscalPeriodPipelineIndex` returns `-1` only then),
 * rendered as "Status unavailable" rather than guessed onto a real stage.
 */
export function FiscalPeriodsScreen() {
  const listQuery = useFiscalPeriodsList();
  const rows = useMemo(() => listQuery.data || [], [listQuery.data]);
  const count = Array.isArray(listQuery.data) ? listQuery.data.length : null;

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
    ],
    [],
  );

  return (
    <ManagerContentShell>
      <ManagerControlPanel
        title="Fiscal periods"
        badge={
          <>
            <Badge variant="neutral">Read-only</Badge>
            <AccountingRouteScopeNote routeKey="accounting.periods" />
          </>
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
        emptyMessage="No fiscal period has been created for this organisation."
      />

      <p className="text-xs leading-5 text-text-muted">
        <AccountingUnpaginatedNote label={unpaginatedCountLabel(count, "fiscal periods")} /> Fiscal periods are
        organisation-wide on this backend — the model has no branch column, so this list is identical
        under every branch. Locked is final: this backend has no unlock route.{" "}
        <span className="font-semibold text-text-primary">Opening, closing and locking a fiscal period</span> is
        performed by an Owner or Accountant — re-verified live, both return 403 for this role.
      </p>
      <p className="text-xs leading-5 text-text-muted" data-accounting-finding="C-27">
        ⚠️ <span className="font-semibold text-text-primary">C-27:</span> unlike every other accounting
        surface in this module, this screen renders no create control not because the role cannot write
        here, but despite it holding a genuine write it is deliberately not offered. Manager&rsquo;s own
        token additionally carries <code className="font-mono">pos:accounting:periods:create</code> — a
        pre-existing grant the 2026-08-20 permissions cutover never revoked — so a direct API call could
        create a DRAFT period even though this UI does not expose one, matching the same read-first
        posture every other B5 surface holds pending an explicit owner grant.
      </p>
    </ManagerContentShell>
  );
}
