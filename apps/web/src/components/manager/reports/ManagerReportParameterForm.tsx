import { useMemo, useState } from "react";

import { Button, Input, StatusMessage } from "@/components/ui";
import {
  MANAGER_REPORT_WINDOW_LABELS,
  MANAGER_REPORT_WINDOWS,
} from "@/lib/manager/reports-model";
import type {
  ManagerReportCatalogEntry,
  ManagerReportGenerateInput,
  ManagerReportWindow,
} from "@/lib/manager/reports-types";
import { cn } from "@/lib/utils/cn";

/**
 * The ONE generate form (Track B4).
 *
 * ## Why one form and not 24
 *
 * The Manager reconstruction originally planned template-aware per-report forms
 * (MANAGER-GAP-009). **MP0-16 disproved that premise** and this phase
 * re-verified it live against every route: all 24 generator DTOs are
 * `{reportWindow!, dateFrom?, dateTo?, parameters?}` and `top-items` alone adds
 * `limit?`. So the form has exactly the controls the API actually accepts:
 *
 * | Control        | Sent as        | Applies to |
 * | -------------- | -------------- | ---------- |
 * | Period         | `reportWindow` | all 24     |
 * | From / To      | `dateFrom/To`  | CUSTOM only |
 * | Rows to return | `limit`        | `TOP_ITEMS` only |
 *
 * `parameters?: Record<string, any>` is accepted by every DTO but **no
 * generator reads it** — every live run returned `parameters: null`. A free-form
 * JSON box would therefore be a control that silently does nothing, so it is
 * omitted rather than rendered inert.
 *
 * ## Validation mirrors the DTO, it does not invent rules
 *
 * `CUSTOM` genuinely requires both dates — the API answers
 * `400 "dateFrom and dateTo required for CUSTOM window"` without them, so the
 * form blocks submission and says so. `limit` is `@IsInt @Min(1)`. Nothing
 * stricter is imposed: an end date before a start date is left to the backend
 * rather than guessed at here.
 */

type ManagerReportParameterFormProps = {
  entry: ManagerReportCatalogEntry;
  isGenerating: boolean;
  onGenerate: (input: ManagerReportGenerateInput) => void;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function ManagerReportParameterForm({
  entry,
  isGenerating,
  onGenerate,
}: ManagerReportParameterFormProps) {
  const [reportWindow, setReportWindow] = useState<ManagerReportWindow>("DAY");
  const [dateFrom, setDateFrom] = useState(todayIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [limit, setLimit] = useState("20");

  const isCustom = reportWindow === "CUSTOM";

  const validationError = useMemo(() => {
    if (isCustom && (!dateFrom || !dateTo)) {
      return "A custom range needs both a start and an end date — the API rejects it otherwise.";
    }
    if (entry.supportsLimit && limit.trim()) {
      const parsed = Number(limit);
      if (!Number.isInteger(parsed) || parsed < 1) {
        return "Rows to return must be a whole number of 1 or more.";
      }
    }
    return null;
  }, [dateFrom, dateTo, entry.supportsLimit, isCustom, limit]);

  const canSubmit = !validationError && !isGenerating && entry.availability !== "unavailable";

  function submit() {
    if (!canSubmit) return;
    const input: ManagerReportGenerateInput = { reportWindow };
    if (isCustom) {
      // Sent as full-day ISO instants — the DTO is `@IsDateString()` and the
      // service treats them as the range bounds.
      input.dateFrom = new Date(`${dateFrom}T00:00:00.000Z`).toISOString();
      input.dateTo = new Date(`${dateTo}T23:59:59.999Z`).toISOString();
    }
    if (entry.supportsLimit && limit.trim()) input.limit = Number(limit);
    onGenerate(input);
  }

  return (
    <form
      data-manager-report-form
      className="flex flex-col gap-4 rounded-lg bg-surface p-4 shadow-subtle"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <fieldset className="min-w-0">
        <legend className="pb-2 text-xs font-bold uppercase tracking-[0.08em] text-text-muted">
          Period
        </legend>
        <div className="flex flex-wrap gap-2">
          {MANAGER_REPORT_WINDOWS.map((value) => {
            const active = value === reportWindow;
            return (
              <button
                key={value}
                type="button"
                data-manager-report-window={value}
                aria-pressed={active}
                onClick={() => setReportWindow(value)}
                className={cn(
                  "min-h-11 rounded-md px-4 text-sm font-semibold outline-none transition-colors",
                  "focus-visible:shadow-focus",
                  active
                    ? "bg-status-info-surface text-status-info"
                    : "bg-surface-muted text-text-secondary hover:text-text-primary",
                )}
              >
                {MANAGER_REPORT_WINDOW_LABELS[value]}
              </button>
            );
          })}
        </div>
      </fieldset>

      {isCustom ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-semibold text-text-secondary">From</span>
            <Input
              type="date"
              value={dateFrom}
              data-manager-report-date-from
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-semibold text-text-secondary">To</span>
            <Input
              type="date"
              value={dateTo}
              data-manager-report-date-to
              onChange={(event) => setDateTo(event.target.value)}
            />
          </label>
        </div>
      ) : null}

      {entry.supportsLimit ? (
        <label className="flex max-w-xs flex-col gap-1">
          <span className="text-xs font-semibold text-text-secondary">Rows to return</span>
          <Input
            type="number"
            min={1}
            step={1}
            value={limit}
            data-manager-report-limit
            onChange={(event) => setLimit(event.target.value)}
          />
          <span className="text-xs text-text-muted">
            This is the only report that takes a row limit.
          </span>
        </label>
      ) : null}

      {validationError ? (
        <StatusMessage tone="warning" title="Check the parameters">
          {validationError}
        </StatusMessage>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {isGenerating ? "Generating…" : "Generate report"}
        </Button>
        <span className="text-xs text-text-muted">
          Runs against the current branch and is saved to the run history.
        </span>
      </div>
    </form>
  );
}
