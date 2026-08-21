import { useId } from "react";

import type { AccountingAgingBucket } from "@/lib/accounting/model";
import { formatAccountingMoney } from "@/lib/accounting/model";

/**
 * Aging-bucket bar mark — Track B5.1.
 *
 * **Hand-rolled SVG. No charting dependency**, on the B2 precedent: a chart
 * library here would mean a client-only dynamic import (Pages Router SSR), a
 * responsive-container remount on every breakpoint (exactly the responsive
 * double-mount the performance rules forbid), and a second theming system
 * alongside the token layer. `scripts/manager-b5-assertions.ts` fails if a
 * charting package appears in `package.json`.
 *
 * **Why this mark is honest where a trend line would not be.** Odoo's Sales and
 * Purchases cards (screenshot 02) draw bars over due-date buckets. Nimbus has
 * NO bucketed time series on any endpoint (NG-05), so a trend over time would
 * have to be invented — and B5.6/B2 both ship chartless rather than synthesise
 * one. But `ap/aging.buckets` and `ar/aging.summary` ARE a real categorical
 * series that the backend itself computes, over the same five buckets. Drawing
 * them is reporting, not inventing.
 *
 * Rules kept from B2's marks: tokens only (no hard-coded hex); every bar's value
 * is also present as TEXT so the graphic is never the only carrier; `role="img"`
 * with a real `<title>`/`<desc>`; and an empty bucket renders as a real zero on
 * the baseline rather than as blank space where a bar might be missing.
 */

/**
 * Written out in full on purpose — Tailwind scans source text, so a class name
 * assembled at runtime would never be generated and the bars would render
 * unpainted. (The same note B2's chart file carries.)
 */
const toneFill: Record<AccountingAgingBucket["tone"], string> = {
  neutral: "fill-chart-series-2",
  info: "fill-status-info",
  warning: "fill-status-warning",
  danger: "fill-status-danger",
};

export function AccountingAgingBars({
  buckets,
  currencyCode,
  title,
  description,
}: {
  buckets: readonly AccountingAgingBucket[];
  currencyCode: string | null;
  title: string;
  description: string;
}) {
  const id = useId();
  const amounts = buckets.map((bucket) => bucket.amount ?? 0);
  const max = Math.max(1, ...amounts);
  const width = 100;
  const height = 40;
  const slot = width / Math.max(1, buckets.length);
  const barWidth = Math.min(11, slot * 0.5);

  return (
    <div className="min-w-0" data-accounting-aging-bars>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-11 w-full"
        role="img"
        aria-labelledby={`${id}-title ${id}-desc`}
      >
        <title id={`${id}-title`}>{title}</title>
        <desc id={`${id}-desc`}>{description}</desc>
        <rect x="0" y={height - 0.75} width={width} height="0.75" className="fill-chart-track" />
        {buckets.map((bucket, index) => {
          // A null amount draws NOTHING — not a zero-height bar that would read
          // as "nothing owed" when the truth is "we could not read this".
          const barHeight =
            bucket.amount === null ? 0 : bucket.amount > 0 ? Math.max(2, (bucket.amount / max) * height) : 0;
          return (
            <rect
              key={bucket.key}
              x={index * slot + (slot - barWidth) / 2}
              y={height - barHeight}
              width={barWidth}
              height={barHeight}
              rx="1"
              className={toneFill[bucket.tone]}
            />
          );
        })}
      </svg>

      <ul className="mt-1 flex min-w-0 items-start" aria-hidden>
        {buckets.map((bucket) => (
          <li key={bucket.key} className="min-w-0 flex-1 text-center">
            <span className="block truncate text-[0.6875rem] leading-4 text-text-muted">
              {bucket.label}
            </span>
          </li>
        ))}
      </ul>

      {/* The same numbers as text, unabbreviated, for assistive tech and for
          anyone who cannot read a 40px-tall bar. */}
      <p className="sr-only">
        {buckets
          .map(
            (bucket) =>
              `${bucket.description}: ${formatAccountingMoney(bucket.amount, currencyCode)}.`,
          )
          .join(" ")}
      </p>
    </div>
  );
}
