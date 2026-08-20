import { useId } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Manager dashboard mini-visualizations (Track B2).
 *
 * **Hand-rolled SVG, no charting dependency.** Only three marks are needed — a
 * composition ring, a small bar series, and a ratio meter — and each is a handful
 * of geometry. Adding a chart library would have meant a client-only dynamic
 * import (Pages Router SSR), a responsive-container remount on every breakpoint
 * (exactly the responsive double-mount the performance rules forbid), and a
 * second theming system alongside the token layer. See the completion report for
 * the full decision.
 *
 * Rules every mark here obeys:
 * - **Tokens only.** Series fills come from the `chart-series-*` ramp; severity
 *   fills come from the `status-*` ink tokens. No hard-coded hex.
 * - **Never colour alone.** Every series renders a text label and its value
 *   alongside the mark (docs/UI_SYSTEM.md §7).
 * - **Accessible.** Each mark is `role="img"` with a real `<title>` and `<desc>`,
 *   and the underlying numbers are also present as text, so a screen reader never
 *   depends on the graphic.
 * - **Never synthetic.** Nothing here interpolates, smooths, or back-fills a
 *   missing value; a bucket with no data renders as zero height, not as a guess.
 */

/**
 * Class names are written out in full on purpose — Tailwind scans source text, so
 * a name assembled at runtime (`"fill-" + x`, or `.replace("fill-", "stroke-")`)
 * would never be generated and the mark would render unpainted.
 */
const SERIES_STROKE = [
  "stroke-chart-series-1",
  "stroke-chart-series-2",
  "stroke-chart-series-3",
  "stroke-chart-series-4",
] as const;

const SERIES_SWATCH = [
  "bg-chart-series-1",
  "bg-chart-series-2",
  "bg-chart-series-3",
  "bg-chart-series-4",
] as const;

export type ManagerDonutSlice = {
  key: string;
  label: string;
  /** Absolute value. Slices with a null or non-positive value are omitted from the ring. */
  value: number | null;
  /** Rendered next to the label — already formatted (money, count, whatever it is). */
  display: string;
  /** 0–100. Rendered as text, never inferred from the arc. */
  share: number | null;
  shareDisplay: string;
};

/**
 * Composition ring (Odoo's cards use bar/line marks; a ring is the honest shape
 * for a part-of-whole split like payment mix, where the parts sum to a real total
 * the endpoint itself returns).
 */
export function ManagerDonutChart({
  slices,
  title,
  description,
  centerLabel,
  centerValue,
}: {
  slices: readonly ManagerDonutSlice[];
  title: string;
  description: string;
  centerLabel: string;
  centerValue: string;
}) {
  const id = useId();
  const positive = slices.filter((slice) => (slice.value ?? 0) > 0);
  const total = positive.reduce((sum, slice) => sum + (slice.value as number), 0);

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-4">
      <svg
        viewBox="0 0 100 100"
        className="h-24 w-24 shrink-0 -rotate-90"
        role="img"
        aria-labelledby={`${id}-title ${id}-desc`}
      >
        <title id={`${id}-title`}>{title}</title>
        <desc id={`${id}-desc`}>{description}</desc>
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="14"
          className="stroke-chart-track"
        />
        {total > 0
          ? positive.map((slice, index) => {
              const length = ((slice.value as number) / total) * circumference;
              const dash = `${length} ${circumference - length}`;
              const element = (
                <circle
                  key={slice.key}
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  strokeWidth="14"
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  className={SERIES_STROKE[index % SERIES_STROKE.length]}
                />
              );
              offset += length;
              return element;
            })
          : null}
      </svg>

      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold tracking-tight text-text-primary">{centerValue}</p>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
          {centerLabel}
        </p>
        <ul className="mt-2 flex min-w-0 flex-col gap-1">
          {slices.map((slice, index) => (
            <li key={slice.key} className="flex min-w-0 items-baseline gap-2 text-xs">
              <span
                className={cn(
                  "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-xs",
                  SERIES_SWATCH[index % SERIES_SWATCH.length],
                )}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-text-secondary">{slice.label}</span>
              <span className="shrink-0 font-semibold tabular-nums text-text-primary">
                {slice.display}
              </span>
              <span className="w-10 shrink-0 text-right tabular-nums text-text-muted">
                {slice.shareDisplay}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export type ManagerBar = {
  key: string;
  label: string;
  /** Screen-reader wording for the bucket, e.g. "Open 30 to 60 minutes". */
  description: string;
  count: number;
  tone: "neutral" | "info" | "warning" | "danger";
};

const barToneClasses: Record<ManagerBar["tone"], string> = {
  neutral: "fill-chart-series-2",
  info: "fill-status-info",
  warning: "fill-status-warning",
  danger: "fill-status-danger",
};

/**
 * Small bar series — the Odoo Sales/Purchases card's bucketed bar chart, adapted.
 *
 * Odoo buckets by due date; Nimbus buckets by how long an order has been open,
 * derived from real `createdAt` values the endpoint actually returns. There is no
 * bucketed time series anywhere on the Nimbus dashboard API (NG-05), so nothing
 * here is a server-side series and nothing is invented — it is a client-side
 * grouping of rows the caller must label as such when the row set is capped.
 */
export function ManagerBarSeries({
  bars,
  title,
  description,
}: {
  bars: readonly ManagerBar[];
  title: string;
  description: string;
}) {
  const id = useId();
  const max = Math.max(1, ...bars.map((bar) => bar.count));
  const width = 100;
  const height = 44;
  const slot = width / bars.length;
  const barWidth = Math.min(12, slot * 0.45);

  return (
    <div className="min-w-0">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-12 w-full"
        role="img"
        aria-labelledby={`${id}-title ${id}-desc`}
      >
        <title id={`${id}-title`}>{title}</title>
        <desc id={`${id}-desc`}>{description}</desc>
        {/* Baseline, so an empty bucket reads as a real zero on the axis rather
            than as blank space where a bar might be missing. */}
        <rect x="0" y={height - 0.75} width={width} height="0.75" className="fill-chart-track" />
        {bars.map((bar, index) => {
          const barHeight = bar.count > 0 ? Math.max(2, (bar.count / max) * height) : 0;
          return (
            <rect
              key={bar.key}
              x={index * slot + (slot - barWidth) / 2}
              y={height - barHeight}
              width={barWidth}
              height={barHeight}
              rx="1"
              className={barToneClasses[bar.tone]}
            />
          );
        })}
      </svg>
      <ul className="mt-1 flex min-w-0 items-start" aria-hidden>
        {bars.map((bar) => (
          <li key={bar.key} className="min-w-0 flex-1 text-center">
            <span className="block text-xs font-semibold tabular-nums text-text-primary">
              {bar.count}
            </span>
            <span className="block truncate text-[0.6875rem] leading-4 text-text-muted">
              {bar.label}
            </span>
          </li>
        ))}
      </ul>
      {/* The same numbers, unabbreviated, for assistive tech. */}
      <p className="sr-only">
        {bars.map((bar) => `${bar.description}: ${bar.count}.`).join(" ")}
      </p>
    </div>
  );
}

/**
 * Ratio meter — how much stock remains against the reorder level. `value` is a
 * 0–1 fraction; `null` renders an empty track with an explicit "unavailable"
 * label supplied by the caller, never a full or empty bar implying a reading.
 */
export function ManagerRatioMeter({
  value,
  label,
  tone = "warning",
}: {
  value: number | null;
  label: string;
  tone?: "warning" | "danger";
}) {
  const percent = value === null ? 0 : Math.round(Math.max(0, Math.min(1, value)) * 100);

  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-chart-track"
      role="img"
      aria-label={label}
    >
      {value === null ? null : (
        <div
          className={cn("h-full rounded-full", tone === "danger" ? "bg-status-danger" : "bg-status-warning")}
          style={{ width: `${percent}%` }}
        />
      )}
    </div>
  );
}
