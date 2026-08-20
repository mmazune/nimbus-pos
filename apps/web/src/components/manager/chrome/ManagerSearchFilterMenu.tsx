import type { ReactNode } from "react";

import { operationalIcons, operationalIconSizes, operationalIconWeights } from "@/components/pos-shell/role-icons";
import { OperationalTopNavDropdown } from "@/components/pos-shell/OperationalTopNavDropdown";
import { cn } from "@/lib/utils/cn";

/**
 * The three-column Filters / Group By / Favorites dropdown (Track B1(e),
 * `ai/ODOO_REFERENCE_RESEARCH.md` screenshot 15). Built as a complete
 * primitive in B1 but NOT mounted on any B1 page — every current Manager
 * surface is the honest M-P1 foundation screen with no list to filter or
 * group, and rendering a live-looking search/filter box over no data would
 * itself be a soft untruth. B3's list views are the first real consumer.
 *
 * Columns are OMITTED, not empty-rendered, when a surface has nothing to
 * offer them:
 * - **Group By** is absent on most Nimbus list endpoints (they cannot
 *   group server-side) — pass no `groupBy` and the column disappears.
 * - **Favorites** (NG-11/OD-7): Nimbus has no saved-view/filter concept in
 *   the API. When `favorites` is supplied it is understood to be
 *   **localStorage-only** and the column says so explicitly — this
 *   component never calls a save-search endpoint, because none exists.
 */
export type ManagerSearchFilterOption = {
  key: string;
  label: string;
};

type ManagerSearchFilterMenuProps = {
  ariaLabel?: string;
  filters?: readonly ManagerSearchFilterOption[];
  activeFilterKeys?: readonly string[];
  onToggleFilter?: (key: string) => void;
  groupBy?: readonly ManagerSearchFilterOption[];
  activeGroupByKey?: string | null;
  onSelectGroupBy?: (key: string | null) => void;
  favorites?: readonly ManagerSearchFilterOption[];
  onSelectFavorite?: (key: string) => void;
  onSaveCurrentSearch?: () => void;
};

function MenuColumn({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="px-2 pb-1 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-text-muted">{heading}</p>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

export function ManagerSearchFilterMenu({
  activeFilterKeys = [],
  activeGroupByKey = null,
  ariaLabel = "Search filters",
  favorites,
  filters,
  groupBy,
  onSaveCurrentSearch,
  onSelectFavorite,
  onSelectGroupBy,
  onToggleFilter,
}: ManagerSearchFilterMenuProps) {
  const FilterIcon = operationalIcons.search;
  const CaretIcon = operationalIcons.caretDown;

  return (
    <OperationalTopNavDropdown
      id="manager-search-filter-menu"
      align="right"
      panelClassName="w-[min(48rem,90vw)]"
      renderTrigger={({ buttonProps, open }) => (
        <button
          {...buttonProps}
          type="button"
          aria-label={ariaLabel}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-muted outline-none transition-colors duration-150 hover:bg-surface-muted focus-visible:shadow-focus",
            open && "bg-surface-muted text-text-primary",
          )}
        >
          <FilterIcon size={operationalIconSizes.compactAction} weight={operationalIconWeights.default} aria-hidden />
        </button>
      )}
    >
      {(close) => (
        <div className="flex flex-col gap-4 p-2 sm:flex-row sm:gap-6">
          <MenuColumn heading="Filters">
            {filters?.length ? (
              filters.map((filter) => {
                const active = activeFilterKeys.includes(filter.key);
                return (
                  <button
                    key={filter.key}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={active}
                    tabIndex={-1}
                    onClick={() => onToggleFilter?.(filter.key)}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm font-semibold outline-none hover:bg-surface-muted focus-visible:bg-surface-muted",
                      active ? "text-brand-navy-900" : "text-text-primary",
                    )}
                  >
                    {filter.label}
                    {active ? <span aria-hidden>✓</span> : null}
                  </button>
                );
              })
            ) : (
              <p className="px-2 py-1.5 text-sm text-text-muted">No filters available on this surface.</p>
            )}
          </MenuColumn>

          <MenuColumn heading="Group By">
            {groupBy?.length ? (
              groupBy.map((option) => {
                const active = activeGroupByKey === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    tabIndex={-1}
                    onClick={() => onSelectGroupBy?.(active ? null : option.key)}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm font-semibold outline-none hover:bg-surface-muted focus-visible:bg-surface-muted",
                      active ? "text-brand-navy-900" : "text-text-primary",
                    )}
                  >
                    {option.label}
                    {active ? <span aria-hidden>✓</span> : null}
                  </button>
                );
              })
            ) : (
              <p className="px-2 py-1.5 text-sm text-text-muted">
                This surface&apos;s endpoint has no group-by support.
              </p>
            )}
          </MenuColumn>

          <MenuColumn heading="Favorites">
            <p className="px-2 pb-1 text-xs text-text-muted">Saved on this terminal only — not synced.</p>
            {favorites?.length
              ? favorites.map((favorite) => (
                  <button
                    key={favorite.key}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    onClick={() => {
                      onSelectFavorite?.(favorite.key);
                      close();
                    }}
                    className="rounded-md px-2 py-1.5 text-left text-sm font-semibold text-text-primary outline-none hover:bg-surface-muted focus-visible:bg-surface-muted"
                  >
                    {favorite.label}
                  </button>
                ))
              : null}
            {onSaveCurrentSearch ? (
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={onSaveCurrentSearch}
                className="mt-1 flex items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm font-semibold text-brand-navy-900 outline-none hover:bg-surface-muted focus-visible:bg-surface-muted"
              >
                Save current search
                <CaretIcon size={operationalIconSizes.compactAction} weight={operationalIconWeights.default} aria-hidden />
              </button>
            ) : null}
          </MenuColumn>
        </div>
      )}
    </OperationalTopNavDropdown>
  );
}
