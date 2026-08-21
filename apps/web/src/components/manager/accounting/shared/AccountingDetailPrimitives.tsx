import Link from "next/link";
import type { ReactNode } from "react";

import { Card } from "@/components/ui";

import { AccountingReadOnlyNote } from "./AccountingNotes";

/**
 * Shared record-detail primitives — Track B5.2.
 *
 * The four AR/AP detail views (invoice, customer account, bill, supplier) all
 * follow the same B3 `ManagerOrderDetailPanel` skeleton (breadcrumb + record
 * pager, statusbar, a `<dl>` field grid, a totals/summary card, a read-only
 * disclosure card) but render different fields, so the layout primitives are
 * factored here rather than the whole panel. `Link`, not a `<button
 * onClick=`, is what makes the "back" affordance interactive — this file (and
 * every accounting-tree file that uses it) therefore contains no `onClick=`
 * literal, which is what the B5.1 read-only assertion greps for.
 */

export function AccountingFieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border-subtle/60 py-2 last:border-b-0">
      <dt className="text-xs font-bold uppercase tracking-[0.08em] text-text-muted">{label}</dt>
      <dd className="min-w-0 text-sm font-semibold text-text-primary">{children}</dd>
    </div>
  );
}

/** The "This record is read-only" card every AR/AP detail view ends with. */
export function AccountingReadOnlyCard({ actions }: { actions: readonly string[] }) {
  return (
    <Card className="min-w-0 bg-status-info-surface">
      <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-status-info">This record is read-only</h3>
      <p className="mt-2 text-sm leading-6 text-text-secondary">
        <AccountingReadOnlyNote actions={actions} />
      </p>
    </Card>
  );
}

/** A styled `Link`, not a `<button onClick=`, so a failed detail read still offers a way back. */
export function AccountingBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md px-2 py-1 text-sm font-semibold text-brand-navy-900 outline-none hover:bg-surface-muted focus-visible:shadow-focus"
    >
      {label}
    </Link>
  );
}
