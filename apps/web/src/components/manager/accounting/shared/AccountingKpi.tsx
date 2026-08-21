import Link from "next/link";
import { ReactNode } from "react";

import { getAccountingKpi } from "@/lib/accounting/model";
import { cn } from "@/lib/utils/cn";

/**
 * Shared accounting figure primitives — Track B5.1, drill-in wired in B5.2.
 *
 * Every sub-phase of B5 renders money and counts, and every one of them must
 * obey the same three rules, so they live here once rather than being restated
 * per surface:
 *
 * 1. **Registry-bound.** `kpiKey` is REQUIRED and must exist in
 *    `ACCOUNTING_KPI_BINDINGS`; `getAccountingKpi` throws otherwise. A figure
 *    with no verified backing field cannot render even by accident. (The B2
 *    precedent, applied to a second registry rather than widening the first —
 *    OD-2 keeps the accounting module self-contained.)
 * 2. **A figure links only when its binding names a real `drillIn`.** B5.1 had
 *    nowhere to link, so every figure was inert and the registry recorded WHY.
 *    B5.2 shipped the Customers/Vendors lists and the two aging reports those
 *    bindings pointed at, so `drillIn` is now non-null for every AR/AP KPI —
 *    this component renders a `Link` for those and plain text for anything
 *    still `noDrillInReason`'d (Bank, Journals, Closing — B5.3+).
 * 3. **Never colour alone.** Tone is always paired with a word.
 */

export function AccountingPrimaryKpi({
  kpiKey,
  value,
  hint,
  tone = "default",
}: {
  kpiKey: string;
  value: string;
  hint?: ReactNode;
  tone?: "default" | "danger" | "warning" | "success";
}) {
  const binding = getAccountingKpi(kpiKey);

  const valueClassName = cn(
    "truncate text-2xl font-bold tracking-tight",
    tone === "danger"
      ? "text-status-danger"
      : tone === "warning"
        ? "text-status-warning"
        : tone === "success"
          ? "text-status-success"
          : "text-text-primary",
  );

  return (
    <div className="min-w-0" data-accounting-kpi={kpiKey}>
      {binding.drillIn ? (
        <Link
          href={binding.drillIn}
          className={cn(valueClassName, "block rounded-sm outline-none hover:underline focus-visible:shadow-focus")}
          title={value}
        >
          {value}
        </Link>
      ) : (
        <p className={valueClassName} title={value}>
          {value}
        </p>
      )}
      <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
        {binding.label}
      </p>
      {hint ? <p className="mt-1 text-xs leading-5 text-text-secondary">{hint}</p> : null}
    </div>
  );
}

export type AccountingStatRow = {
  kpiKey: string;
  /** Already formatted — money through the shared UGX formatter, counts through Intl. */
  value: string;
  /** Overrides the registry label (e.g. to name the supplier a figure belongs to). */
  label?: string;
  tone?: "default" | "danger" | "warning" | "success";
};

const toneClasses: Record<NonNullable<AccountingStatRow["tone"]>, string> = {
  default: "text-text-primary",
  danger: "text-status-danger",
  warning: "text-status-warning",
  success: "text-status-success",
};

export function AccountingStatList({ rows }: { rows: readonly AccountingStatRow[] }) {
  return (
    <dl className="flex min-w-0 flex-col gap-1.5">
      {rows.map((row) => {
        const binding = getAccountingKpi(row.kpiKey);
        const label = row.label || binding.label;
        return (
          <div
            key={row.kpiKey}
            data-accounting-kpi={row.kpiKey}
            className="flex min-w-0 items-baseline justify-between gap-3"
          >
            <dt className="min-w-0 truncate text-sm text-text-secondary">{label}</dt>
            <dd
              className={cn(
                "shrink-0 text-sm font-semibold tabular-nums",
                toneClasses[row.tone || "default"],
              )}
            >
              {binding.drillIn ? (
                <Link
                  href={binding.drillIn}
                  className="rounded-sm outline-none hover:underline focus-visible:shadow-focus"
                >
                  {row.value}
                </Link>
              ) : (
                row.value
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
