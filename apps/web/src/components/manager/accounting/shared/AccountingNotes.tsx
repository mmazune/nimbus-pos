import { Badge } from "@/components/ui";
import { FISCAL_PERIOD_STATUS_META, PERIOD_CLOSE_RUN_STATUS_META } from "@/lib/accounting/model";
import { ACCOUNTING_DENIED_WRITES, getAccountingRoute } from "@/lib/accounting/route-registry";
import type { FiscalPeriodStatus, PeriodCloseRunStatus } from "@/lib/accounting/types";

/**
 * Shared accounting disclosure primitives — Track B5.1.
 *
 * Three things every accounting surface has to say out loud, factored into
 * components so that no sub-phase has to remember to say them:
 *
 * - **Which scope a figure describes** (`AccountingScopeNote`). Four accounting
 *   surfaces are organisation-level BY DESIGN — `periods`, `period-close-runs`,
 *   `posting-source-maps` and `tax-config` have no `branch_id` column at all,
 *   or never stamp one. Backend gap batch 2 ruled that B5 must LABEL them, not
 *   "fix" them, and a branch-labelled workspace that silently shows org-wide
 *   numbers is exactly the untruth PC-03 was about.
 * - **That this role cannot write** (`AccountingReadOnlyNote`). Manager holds
 *   15 read strings and zero writes (PC-01/PC-02). The owner's ruling is that
 *   no write affordance renders — not even disabled — so where an Odoo user
 *   would reach for `New` / `Post` / `Approve` / `Match`, this names the action
 *   in prose instead.
 * - **That a count came from a bare array** (`AccountingUnpaginatedNote`).
 *   PC-06: ten list routes return a bare JSON array with no `total`. The array
 *   IS the complete result set, so its length is exact — but it is a CLIENT
 *   count, and B4-D1's rule stands: never present one as a server total.
 */

export function AccountingScopeNote({ scope }: { scope: "branch" | "organization" }) {
  return (
    <Badge variant={scope === "organization" ? "info" : "neutral"} data-accounting-scope={scope}>
      {scope === "organization" ? "Organisation data" : "This branch"}
    </Badge>
  );
}

/** Reads the scope straight off the registry, so a card cannot mislabel its own source. */
export function AccountingRouteScopeNote({ routeKey }: { routeKey: string }) {
  return <AccountingScopeNote scope={getAccountingRoute(routeKey).scope} />;
}

/**
 * A `<span>`, not a `<p>`: every consumer mounts this inside
 * `ManagerDashboardCard`'s `footnote`, which the card already renders as a
 * `<p>`. Nesting a paragraph inside a paragraph is invalid HTML — React logs a
 * `validateDOMNesting` warning and the browser silently splits the element,
 * which breaks the footnote's own styling. Caught by this phase's zero-console-
 * error assertion.
 */
export function AccountingReadOnlyNote({ actions }: { actions: readonly string[] }) {
  return (
    <span data-accounting-read-only-note>
      <span className="font-semibold text-text-primary">Read-only for this role.</span>{" "}
      {actions.join(", ")} {actions.length === 1 ? "is" : "are"} performed by an Owner or Accountant
      — the manager role holds accounting read access only.
    </span>
  );
}

export function AccountingUnpaginatedNote({ label }: { label: string }) {
  return (
    <span data-accounting-unpaginated-note>
      {label} — this endpoint returns the complete list with no server-side page count, so this is a
      count of every row loaded, not a server total.
    </span>
  );
}

/**
 * The full denied-write disclosure, rendered once at the foot of the dashboard.
 * Generated from `ACCOUNTING_DENIED_WRITES` so the prose and the assertion
 * script read the same list.
 */
export function AccountingDeniedWritesPanel() {
  return (
    <section
      data-accounting-denied-writes
      className="rounded-lg bg-surface-muted p-4 text-sm"
      aria-labelledby="accounting-denied-writes-heading"
    >
      <h2
        id="accounting-denied-writes-heading"
        className="text-sm font-bold tracking-normal text-text-primary"
      >
        What this workspace cannot do
      </h2>
      <p className="mt-1 text-xs leading-5 text-text-secondary">
        The manager role holds accounting <strong>read</strong> permissions only. Rather than show
        buttons that would be refused, the actions an accounting workspace normally offers are
        listed here with the role that can perform them.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {ACCOUNTING_DENIED_WRITES.map((entry) => (
          <li key={entry.label} className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-semibold text-text-primary">{entry.label}</span>
            <span className="break-words font-mono text-[0.6875rem] leading-4 text-text-muted">
              {entry.route}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-border-subtle pt-2 text-xs leading-5 text-text-muted">
        Owner and Accountant hold all 36 accounting permission strings. Granting any of these to a
        manager is a permissions decision recorded as PC-01, and is not made by the UI.
      </p>
    </section>
  );
}

export function AccountingPeriodStatusBadge({ status }: { status: FiscalPeriodStatus | null }) {
  if (!status) {
    return (
      <Badge variant="neutral" data-accounting-period-status="unknown">
        Status unavailable
      </Badge>
    );
  }

  const meta = FISCAL_PERIOD_STATUS_META[status];
  return (
    <Badge variant={meta.tone} data-accounting-period-status={status}>
      {meta.label}
    </Badge>
  );
}

/**
 * Fail-closed the same way as `AccountingPeriodStatusBadge` — Track B5.5.
 * `PeriodCloseRunStatus` has a `FAILED` member, so a malformed/unrecognised
 * value must NEVER fall back to `COMPLETED`'s success styling; it renders the
 * same neutral "Status unavailable" chip an unreadable period status gets,
 * never a colour that could be mistaken for a real outcome.
 */
export function AccountingPeriodCloseRunStatusBadge({ status }: { status: PeriodCloseRunStatus | null }) {
  if (!status) {
    return (
      <Badge variant="neutral" data-accounting-close-run-status="unknown">
        Status unavailable
      </Badge>
    );
  }

  const meta = PERIOD_CLOSE_RUN_STATUS_META[status];
  return (
    <Badge variant={meta.tone} data-accounting-close-run-status={status}>
      {meta.label}
    </Badge>
  );
}
