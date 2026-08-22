import { useMemo, useState } from "react";

import { AccountingSelectField } from "@/components/manager/accounting/shared";
import { ManagerContentShell, ManagerControlPanel, ManagerListTable, type ManagerListColumn } from "@/components/manager/chrome";
import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { Badge, Button, Card, ErrorState, LoadingState } from "@/components/ui";
import {
  accountingStatusTone,
  formatAccountingDate,
  formatAccountingMoney,
  titleCaseAccountingStatus,
} from "@/lib/accounting/model";
import {
  FORECAST_HORIZONS,
  FORECAST_TYPES,
  type ForecastProcurementSuggestionRow,
} from "@/lib/accounting/types";
import { useManagerBranch } from "@/lib/manager/branch-context";
import { useForecast, useRefreshForecast } from "@/lib/manager/accounting-configuration-queries";

/**
 * Accounting → Reporting → Forecast — Track B5.6 (2026-08-22).
 *
 * `GET /franchise/forecast` returns a single `ForecastRun` object. **This is
 * the one B5.6 surface with no POST/PATCH anywhere** — the mutation this
 * screen offers ("Refresh forecast") is the SAME GET, re-issued with
 * `?refresh=true`, which the service uses to decide whether to regenerate
 * (`forecast.service.ts`). There is no separate write permission for it: the
 * read permission (`franchise:forecast:read`) gates the whole thing, and the
 * registry names this a `sideEffect: true` read, never a write route.
 *
 * `assumptions`/`demandSignals`/`daypartSummaries`/`outputs` are free-form
 * `Json` columns with no governing DTO — rendered as a structured but
 * generically-typed dump rather than guessed field-by-field.
 */
export function ForecastScreen() {
  const branch = useManagerBranch();
  const [forecastType, setForecastType] = useState<string>("BRANCH");
  const [horizon, setHorizon] = useState<string>("THREE_DAY");
  const [refreshOpen, setRefreshOpen] = useState(false);

  const params = { forecastType, horizon };
  const forecastQuery = useForecast(params);
  const refreshMutation = useRefreshForecast(params);

  const run = forecastQuery.data;
  const suggestions = useMemo(() => run?.procurementSuggestions || [], [run]);

  async function submitRefresh() {
    try {
      await refreshMutation.mutateAsync();
      setRefreshOpen(false);
    } catch {
      // Error surfaces via refreshMutation.error, rendered inside the dialog below.
    }
  }

  const suggestionColumns: ManagerListColumn<ForecastProcurementSuggestionRow>[] = useMemo(
    () => [
      { key: "rationale", header: "Rationale", render: (row) => row.rationale || "—" },
      {
        key: "urgency",
        header: "Urgency",
        render: (row) => <Badge variant={accountingStatusTone(row.urgency)}>{titleCaseAccountingStatus(row.urgency)}</Badge>,
      },
      { key: "qty", header: "Suggested qty", numeric: true, render: (row) => (row.suggestedQty != null ? String(row.suggestedQty) : "—") },
      {
        key: "cost",
        header: "Estimated cost",
        numeric: true,
        render: (row) => formatAccountingMoney(row.estimatedTotalCost, branch.currencyCode),
      },
      { key: "action", header: "Suggested action", optional: true, render: (row) => row.suggestedAction || "—" },
    ],
    [branch.currencyCode],
  );

  return (
    <ManagerContentShell>
      <ManagerControlPanel
        title="Forecast"
        badge={<Badge variant="info">Read + refresh</Badge>}
        primaryAction={
          <Button variant="primary" size="compact" onClick={() => setRefreshOpen(true)}>
            Refresh forecast
          </Button>
        }
      />

      <div className="flex flex-wrap gap-4">
        <AccountingSelectField label="Forecast type" value={forecastType} onChange={(event) => setForecastType(event.target.value)}>
          {FORECAST_TYPES.map((type) => (
            <option key={type} value={type}>
              {titleCaseAccountingStatus(type)}
            </option>
          ))}
        </AccountingSelectField>
        <AccountingSelectField label="Horizon" value={horizon} onChange={(event) => setHorizon(event.target.value)}>
          {FORECAST_HORIZONS.map((h) => (
            <option key={h} value={h}>
              {titleCaseAccountingStatus(h)}
            </option>
          ))}
        </AccountingSelectField>
      </div>

      {forecastQuery.isLoading ? (
        <LoadingState title="Generating forecast…" />
      ) : forecastQuery.isError ? (
        <div className="flex flex-col items-start gap-3">
          <ErrorState title="Forecast unavailable" description="The forecast could not be read for this branch. Retry." />
          <Button variant="secondary" onClick={() => void forecastQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : run ? (
        <>
          <Card className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-text-primary">Latest run</h2>
              <Badge variant={accountingStatusTone(run.status)}>{titleCaseAccountingStatus(run.status)}</Badge>
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Horizon</dt>
                <dd className="font-semibold text-text-primary">
                  {formatAccountingDate(run.forecastHorizonStart)} – {formatAccountingDate(run.forecastHorizonEnd)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Source window</dt>
                <dd className="font-semibold text-text-primary">
                  {formatAccountingDate(run.sourceWindowStart)} – {formatAccountingDate(run.sourceWindowEnd)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Generated</dt>
                <dd className="font-semibold text-text-primary">{formatAccountingDate(run.completedAt)}</dd>
              </div>
            </dl>
            {run.errorMessage ? (
              <p className="mt-3 rounded-md bg-status-danger-surface px-3 py-2 text-sm font-semibold text-status-danger">
                {run.errorMessage}
              </p>
            ) : null}
          </Card>

          <Card className="min-w-0">
            <h2 className="text-lg font-semibold text-text-primary">Demand signals + daypart summaries</h2>
            <p className="mt-1 text-xs leading-5 text-text-muted">
              These are free-form fields this endpoint computes with no governing contract — shown as
              structured data rather than guessed into a table this UI cannot verify.
            </p>
            <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-surface-muted p-3 text-xs leading-5 text-text-secondary">
              {JSON.stringify({ demandSignals: run.demandSignals, daypartSummaries: run.daypartSummaries }, null, 2)}
            </pre>
          </Card>

          <ManagerListTable
            caption="Procurement suggestions from this run"
            columns={suggestionColumns}
            rows={suggestions}
            getRowId={(row) => row.id}
            emptyTitle="No procurement suggestions"
            emptyMessage="This run projected no item deficit for the current window."
          />
        </>
      ) : null}

      <ActionConfirmDialog
        open={refreshOpen}
        title="Refresh forecast?"
        consequence="Regenerates this forecast from current demand-calendar entries, reservations, order/GL history and inventory stock, and creates fresh procurement suggestions for any projected deficit. This is the same read this page already performs, re-issued with refresh=true — there is no separate write route."
        tone="warning"
        confirmLabel="Refresh forecast"
        pending={refreshMutation.isPending}
        error={refreshMutation.error instanceof Error ? refreshMutation.error.message : null}
        onCancel={() => setRefreshOpen(false)}
        onConfirm={() => void submitRefresh()}
      />
    </ManagerContentShell>
  );
}
