import { ReactNode } from "react";

import { operationalIcons, operationalIconSizes, operationalIconWeights } from "@/components/pos-shell/role-icons";
import { cn } from "@/lib/utils/cn";

/**
 * The control-panel row (Track B1(d)) — the single most reusable primitive in
 * the whole Odoo reference (`ai/ODOO_REFERENCE_RESEARCH.md` §1.5, screenshots
 * 05/12/17): `[New] [secondary]  Title ⚙   [search]   1-25/312 ‹ ›   [views]`.
 *
 * Every slot is OPTIONAL and omitted (not disabled/greyed) when the surface
 * has nothing to back it — B1 mounts this on every Manager page with ONLY
 * `title` (+ the existing "Live data arrives in <phase>" badge), because no
 * B1 surface has a create action, a record menu, a searchable list, or a
 * real pager yet. B3 onward supplies the other slots as real data lands.
 *
 * `pager` intentionally takes an explicit `{ from, to, total }` — never an
 * array — so a consumer cannot accidentally feed it a client-side page
 * length instead of the endpoint's real `total` (roadmap acceptance gate).
 */
export type ManagerControlPanelPager = {
  from: number;
  to: number;
  total: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
};

export type ManagerControlPanelSearch = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Applied filters rendered as chips inside the search box, each with a ✕. */
  filterChips?: ReactNode;
  /** The Filters / Group By / Favorites dropdown trigger (`ManagerSearchFilterMenu`). */
  filterMenu?: ReactNode;
};

type ManagerControlPanelProps = {
  title: string;
  badge?: ReactNode;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  /** The record-actions cog menu — omit entirely on surfaces with no record actions. */
  actionsMenu?: ReactNode;
  search?: ManagerControlPanelSearch;
  pager?: ManagerControlPanelPager;
  viewSwitcher?: ReactNode;
  className?: string;
};

export function ManagerControlPanel({
  actionsMenu,
  badge,
  className,
  pager,
  primaryAction,
  search,
  secondaryActions,
  title,
  viewSwitcher,
}: ManagerControlPanelProps) {
  const SearchIcon = operationalIcons.search;

  return (
    <div
      className={cn(
        "flex min-h-11 flex-wrap items-center gap-3 border-b border-border-subtle pb-4",
        className,
      )}
      data-manager-control-panel
    >
      <div className="flex min-w-0 items-center gap-3">
        {primaryAction || secondaryActions ? (
          <div className="flex shrink-0 items-center gap-2">
            {primaryAction}
            {secondaryActions}
          </div>
        ) : null}
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-xl font-bold tracking-normal text-text-primary">{title}</h1>
          {actionsMenu}
        </div>
        {badge}
      </div>

      {search ? (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md bg-surface-muted px-3 shadow-subtle focus-within:shadow-focus">
            <SearchIcon
              className="shrink-0 text-text-muted"
              size={operationalIconSizes.compactAction}
              weight={operationalIconWeights.default}
              aria-hidden
            />
            {search.filterChips}
            <input
              type="search"
              value={search.value}
              placeholder={search.placeholder || "Search…"}
              onChange={(event) => search.onChange(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
            />
          </div>
          {search.filterMenu}
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <div className="flex shrink-0 items-center gap-3">
        {pager ? (
          <div className="flex items-center gap-1 text-sm text-text-secondary" aria-label="Pagination">
            <span className="tabular-nums">
              {pager.total > 0 ? `${pager.from}-${pager.to} / ${pager.total}` : "0 / 0"}
            </span>
            <button
              type="button"
              aria-label="Previous page"
              disabled={!pager.hasPrevious}
              onClick={pager.onPrevious}
              className="flex h-7 w-7 items-center justify-center rounded-md text-text-secondary outline-none hover:bg-surface-muted focus-visible:shadow-focus disabled:pointer-events-none disabled:opacity-40"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next page"
              disabled={!pager.hasNext}
              onClick={pager.onNext}
              className="flex h-7 w-7 items-center justify-center rounded-md text-text-secondary outline-none hover:bg-surface-muted focus-visible:shadow-focus disabled:pointer-events-none disabled:opacity-40"
            >
              ›
            </button>
          </div>
        ) : null}
        {viewSwitcher}
      </div>
    </div>
  );
}
