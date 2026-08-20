import Link from "next/link";
import { ReactNode } from "react";

/**
 * Breadcrumb + record pager (Track B1(f), `ai/ODOO_REFERENCE_RESEARCH.md`
 * §1.6, screenshot 06): a two-line title area on a RECORD — the parent list
 * as a link on line 1, the record identity + cog on line 2, and a record
 * pager (`1 / 5 ‹ ›`) that walks the underlying list.
 *
 * B1 ships this primitive but does not mount it anywhere: no Manager surface
 * has a record detail view yet (Operations/Staff are read-only lists at
 * best, and even those are not built until B3). It is consumed starting B3,
 * exactly like the roadmap records for this component.
 */
export type ManagerBreadcrumbsPager = {
  position: number;
  total: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
};

type ManagerBreadcrumbsProps = {
  parent: { label: string; href: string };
  recordLabel: string;
  recordActionsMenu?: ReactNode;
  pager?: ManagerBreadcrumbsPager;
};

export function ManagerBreadcrumbs({ parent, pager, recordActionsMenu, recordLabel }: ManagerBreadcrumbsProps) {
  return (
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4">
      <div className="min-w-0">
        <Link
          href={parent.href}
          className="text-xs font-semibold text-text-muted outline-none hover:text-text-secondary hover:underline focus-visible:shadow-focus"
        >
          {parent.label}
        </Link>
        <div className="mt-0.5 flex min-w-0 items-center gap-2">
          <h1 className="truncate text-xl font-bold tracking-normal text-text-primary">{recordLabel}</h1>
          {recordActionsMenu}
        </div>
      </div>

      {pager ? (
        <div className="flex shrink-0 items-center gap-1 text-sm text-text-secondary" aria-label="Record pagination">
          <span className="tabular-nums">
            {pager.total > 0 ? `${pager.position} / ${pager.total}` : "0 / 0"}
          </span>
          <button
            type="button"
            aria-label="Previous record"
            disabled={!pager.hasPrevious}
            onClick={pager.onPrevious}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-secondary outline-none hover:bg-surface-muted focus-visible:shadow-focus disabled:pointer-events-none disabled:opacity-40"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next record"
            disabled={!pager.hasNext}
            onClick={pager.onNext}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-secondary outline-none hover:bg-surface-muted focus-visible:shadow-focus disabled:pointer-events-none disabled:opacity-40"
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  );
}
