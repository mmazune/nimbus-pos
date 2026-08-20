import Link from "next/link";
import { ReactNode } from "react";

import {
  operationalIcons,
  operationalIconSizes,
  operationalIconWeights,
  type OperationalIconName,
} from "@/components/pos-shell/role-icons";
import { Skeleton } from "@/components/ui";
import { getManagerKpiBinding } from "@/lib/manager/dashboard-model";
import { cn } from "@/lib/utils/cn";

/**
 * Manager dashboard card (Track B2) — the Odoo **C10 journal-card** skeleton
 * (`ai/ODOO_REFERENCE_RESEARCH.md` §2.2, screenshots `02` / `16`), rebuilt
 * natively in Nimbus tokens. Observed skeleton, cloned faithfully:
 *
 *     ▌ Title                                       [action] [action]
 *     ▌ PRIMARY KPI
 *     ▌ <count label — the drill-in link>    <amount — plain data>
 *     ▌ <count label>                        <amount>
 *     ▌ ──────────── mini chart OR checklist OR nothing ────────────
 *
 * Faithful details kept: a **coloured left accent bar**; **counts are the
 * drill-in links and amounts are plain data**; mixed-weight actions (one
 * primary, the rest outlined secondaries); a card may legitimately carry **no
 * chart at all**, or a **checklist instead of a chart**; the grid does not force
 * visual symmetry.
 *
 * Deliberately NOT cloned: Odoo's dark palette (Nimbus stays navy/silver/graphite
 * per the roadmap's explicit instruction), and the per-card **kebab (⋮) menu** —
 * every action Overview can honestly offer is already a visible link, and an
 * empty kebab would imply record actions that do not exist yet.
 *
 * ── States ────────────────────────────────────────────────────────────────
 * A card renders exactly one of: **loading skeleton**, **error**, **empty**, or
 * its content. The error state is FAIL-CLOSED: it shows no number at all, not a
 * stale one and never a zero. A zero on a money dashboard is a claim.
 */

export type ManagerDashboardCardAccent = "brand" | "info" | "success" | "warning" | "danger";

const accentBarClasses: Record<ManagerDashboardCardAccent, string> = {
  brand: "bg-role-manager",
  info: "bg-status-info",
  success: "bg-status-success",
  warning: "bg-status-warning",
  danger: "bg-status-danger",
};

export type ManagerDashboardCardProps = {
  title: string;
  icon: OperationalIconName;
  accent?: ManagerDashboardCardAccent;
  /** Mixed-weight action buttons/links, right-aligned beside the title. */
  actions?: ReactNode;
  isLoading?: boolean;
  isError?: boolean;
  /** Shown in the error state instead of any number. */
  errorMessage?: string;
  /** Rendered instead of children when there is genuinely nothing to show. */
  emptyMessage?: string;
  isEmpty?: boolean;
  /** Small print under the body — provenance, caps, and honest limits. */
  footnote?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Used by e2e + assertions to target a specific card. */
  testId: string;
};

export function ManagerDashboardCard({
  accent = "brand",
  actions,
  children,
  className,
  emptyMessage,
  errorMessage = "This card could not be read. No figure is shown rather than a stale or zeroed one.",
  footnote,
  icon,
  isEmpty,
  isError,
  isLoading,
  testId,
  title,
}: ManagerDashboardCardProps) {
  const Icon = operationalIcons[icon];

  return (
    <section
      data-manager-dashboard-card={testId}
      aria-label={title}
      className={cn(
        "relative flex min-w-0 flex-col overflow-hidden rounded-lg bg-surface pl-4 shadow-subtle",
        className,
      )}
    >
      {/* The Odoo card's 3-4px coloured left accent bar. */}
      <span className={cn("absolute inset-y-0 left-0 w-1", accentBarClasses[accent])} aria-hidden />

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <h2 className="flex min-w-0 items-center gap-2 text-sm font-bold tracking-normal text-text-primary">
            <Icon
              size={operationalIconSizes.compactAction}
              weight={operationalIconWeights.default}
              className="shrink-0 text-text-muted"
              aria-hidden
            />
            <span className="truncate">{title}</span>
          </h2>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>

        {isLoading ? (
          <div className="flex flex-1 flex-col gap-3" data-manager-card-state="loading">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-16 w-full" />
            <span className="sr-only">Loading {title}</span>
          </div>
        ) : isError ? (
          <div
            className="flex flex-1 items-start gap-2 rounded-md bg-status-danger-surface p-3 text-sm text-status-danger"
            data-manager-card-state="error"
            role="status"
          >
            <operationalIcons.warning
              size={operationalIconSizes.compactAction}
              weight={operationalIconWeights.default}
              className="mt-0.5 shrink-0"
              aria-hidden
            />
            <p className="min-w-0">{errorMessage}</p>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-1 items-center" data-manager-card-state="empty">
            <p className="text-sm text-text-secondary">{emptyMessage}</p>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col gap-3" data-manager-card-state="ready">
            {children}
          </div>
        )}

        {footnote && !isLoading ? (
          <p className="mt-auto border-t border-border-subtle pt-2 text-xs leading-5 text-text-muted">
            {footnote}
          </p>
        ) : null}
      </div>
    </section>
  );
}

// ── Card content primitives ─────────────────────────────────────────────────

/**
 * The headline figure. `kpiKey` is REQUIRED and must exist in
 * `MANAGER_KPI_BINDINGS` — `getManagerKpiBinding` throws otherwise, so a KPI with
 * no verified backing field cannot be rendered even by accident.
 */
export function ManagerCardPrimaryKpi({
  kpiKey,
  value,
  hint,
}: {
  kpiKey: string;
  value: string;
  hint?: string;
}) {
  const binding = getManagerKpiBinding(kpiKey);

  return (
    <div className="min-w-0">
      <p className="truncate text-2xl font-bold tracking-tight text-text-primary" title={value}>
        {value}
      </p>
      <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
        {binding.label}
      </p>
      {hint ? <p className="mt-1 text-xs leading-5 text-text-secondary">{hint}</p> : null}
    </div>
  );
}

export type ManagerCardStatRow = {
  kpiKey: string;
  /** The right-hand value. Odoo renders amounts as plain data, never as a link. */
  value: string;
  /** Overrides the registry label (e.g. to fuse a live count into the label). */
  label?: string;
  /** When present the LABEL becomes the drill-in link — the Odoo count-is-a-link pattern. */
  href?: string | null;
  tone?: "default" | "danger" | "warning" | "success";
};

const statToneClasses: Record<NonNullable<ManagerCardStatRow["tone"]>, string> = {
  default: "text-text-primary",
  danger: "text-status-danger",
  warning: "text-status-warning",
  success: "text-status-success",
};

export function ManagerCardStatList({ rows }: { rows: readonly ManagerCardStatRow[] }) {
  return (
    <dl className="flex min-w-0 flex-col gap-1.5">
      {rows.map((row) => {
        const binding = getManagerKpiBinding(row.kpiKey);
        const label = row.label || binding.label;

        return (
          <div key={row.kpiKey} className="flex min-w-0 items-baseline justify-between gap-3">
            <dt className="min-w-0 truncate text-sm text-text-secondary">
              {row.href ? (
                <Link
                  href={row.href}
                  className="rounded-xs font-semibold text-text-primary underline-offset-2 outline-none hover:underline focus-visible:shadow-focus"
                >
                  {label}
                </Link>
              ) : (
                label
              )}
            </dt>
            <dd
              className={cn(
                "shrink-0 text-sm font-semibold tabular-nums",
                statToneClasses[row.tone || "default"],
              )}
            >
              {row.value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Outlined secondary action — Odoo's non-primary card buttons. */
export function ManagerCardActionLink({
  href,
  children,
  variant = "secondary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-8 items-center rounded-md px-2.5 text-xs font-semibold outline-none focus-visible:shadow-focus",
        variant === "primary"
          ? "bg-brand-navy-900 text-text-inverse hover:bg-brand-navy-800"
          : "bg-surface-muted text-text-primary hover:bg-border-subtle",
      )}
    >
      {children}
    </Link>
  );
}

export type ManagerChecklistItem = {
  key: string;
  label: string;
  detail?: string;
  done: boolean;
  /** Rendered when `done` is false and the item is an unresolved warning, not a to-do. */
  tone?: "pending" | "warning";
};

/**
 * The Odoo **Tax Returns** card pattern: a checklist instead of a chart, done
 * items carrying a filled tick and pending items a hollow dot. Nimbus's honest
 * analogue is the branch readiness checklist built from the three already-verified
 * M-P1 chips — never a fabricated onboarding flow.
 *
 * Status is never colour-alone: every row carries the words "Ready" / "Attention".
 */
export function ManagerCardChecklist({ items }: { items: readonly ManagerChecklistItem[] }) {
  const DoneIcon = operationalIcons.success;
  const PendingIcon = operationalIcons.warning;

  return (
    <ul className="flex min-w-0 flex-col gap-2">
      {items.map((item) => (
        <li key={item.key} className="flex min-w-0 items-start gap-2">
          <span
            className={cn("mt-0.5 shrink-0", item.done ? "text-status-success" : "text-status-warning")}
            aria-hidden
          >
            {item.done ? (
              <DoneIcon size={operationalIconSizes.compactAction} weight="fill" />
            ) : (
              <PendingIcon size={operationalIconSizes.compactAction} weight="bold" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-text-primary">
              {item.label}
              <span className="sr-only">: {item.done ? "Ready" : "Attention"}</span>
            </span>
            <span className="block text-xs leading-5 text-text-secondary">
              <span
                className={cn(
                  "font-semibold",
                  item.done ? "text-status-success" : "text-status-warning",
                )}
              >
                {item.done ? "Ready" : "Attention"}
              </span>
              {item.detail ? <> · {item.detail}</> : null}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
