import { ReactNode, useMemo, useState } from "react";

import { Button, EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { OperationalTopNavDropdown } from "@/components/pos-shell/OperationalTopNavDropdown";
import { operationalIcons, operationalIconSizes, operationalIconWeights } from "@/components/pos-shell/role-icons";
import { cn } from "@/lib/utils/cn";

/**
 * The Odoo **C4 list view** rebuilt natively (Track B3, reference screenshot
 * `05-invoices-list-view.jpg`): a dense header row, right-aligned numerics, a
 * status pill column, an **optional-column gear at the far right of the header**,
 * and a column-totals row where — and only where — a total can be computed
 * honestly.
 *
 * Deliberately **NOT** cloned from the reference:
 *
 * - The **leading checkbox column.** Odoo's exists to drive bulk actions.
 *   Nimbus has no bulk action on any Manager surface, so a checkbox column would
 *   be furniture that promises a capability the product does not have. The
 *   roadmap says "only if a bulk action actually exists — otherwise omit"; it
 *   does not, so it is omitted.
 * - **Inline editing.** Every B3 list is oversight or review; rows open a
 *   read-only record or a confirmed decision, never an editable cell.
 *
 * Column totals take a `total()` function per column rather than summing
 * automatically: only the caller knows whether a column's sum is meaningful and
 * what it may honestly be labelled (a page total is not a branch total).
 */
export type ManagerListColumn<T> = {
  key: string;
  header: string;
  /** Right-align and tabular-nums — Odoo's treatment for every money/number column. */
  numeric?: boolean;
  /** Offer this column in the header gear. Non-optional columns can never be hidden. */
  optional?: boolean;
  /** Start hidden (still listed in the gear). */
  defaultHidden?: boolean;
  /** Hide below `lg` so a 1024-wide viewport keeps the identifying columns readable. */
  hideBelowLarge?: boolean;
  render: (row: T) => ReactNode;
  /** Rendered in the totals row for this column. Return null for "no honest total". */
  total?: (rows: readonly T[]) => ReactNode | null;
};

type ManagerListTableProps<T> = {
  columns: readonly ManagerListColumn<T>[];
  rows: readonly T[];
  getRowId: (row: T) => string;
  /** An accessible name for the table — required, never a decorative caption. */
  caption: string;
  selectedRowId?: string | null;
  onSelectRow?: (row: T) => void;
  isLoading?: boolean;
  isError?: boolean;
  errorTitle?: string;
  errorMessage?: string;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyMessage?: string;
  /** Label for the leading cell of the totals row, e.g. "This page". Omit to hide the row. */
  totalsLabel?: string;
};

export function ManagerListTable<T>({
  caption,
  columns,
  emptyMessage = "Nothing matches the current filters.",
  emptyTitle = "No records",
  errorMessage = "This list could not be read. Retry, or change the filters.",
  errorTitle = "List unavailable",
  getRowId,
  isError,
  isLoading,
  onRetry,
  onSelectRow,
  rows,
  selectedRowId,
  totalsLabel,
}: ManagerListTableProps<T>) {
  const GearIcon = operationalIcons.settings;
  const [hiddenKeys, setHiddenKeys] = useState<readonly string[]>(() =>
    columns.filter((column) => column.optional && column.defaultHidden).map((column) => column.key),
  );

  const visibleColumns = useMemo(
    () => columns.filter((column) => !hiddenKeys.includes(column.key)),
    [columns, hiddenKeys],
  );
  const optionalColumns = useMemo(() => columns.filter((column) => column.optional), [columns]);
  const hasTotals = Boolean(totalsLabel) && visibleColumns.some((column) => column.total);

  if (isLoading) return <LoadingState title={`Loading ${caption.toLowerCase()}…`} />;
  if (isError) {
    return (
      <div className="flex min-w-0 flex-col items-start gap-3">
        <ErrorState title={errorTitle} description={errorMessage} />
        {onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
    );
  }
  if (!rows.length) return <EmptyState title={emptyTitle} description={emptyMessage} />;

  return (
    <div className="min-w-0 overflow-x-auto rounded-lg bg-surface shadow-subtle" data-manager-list-table>
      <table className="w-full min-w-[42rem] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border-subtle">
            {visibleColumns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "whitespace-nowrap px-3 py-2.5 text-xs font-bold uppercase tracking-[0.08em] text-text-muted",
                  column.numeric ? "text-right" : "text-left",
                  column.hideBelowLarge && "hidden lg:table-cell",
                )}
              >
                {column.header}
              </th>
            ))}
            <th scope="col" className="w-10 px-2 py-2.5 text-right">
              <span className="sr-only">Optional columns</span>
              {optionalColumns.length ? (
                <OperationalTopNavDropdown
                  id={`manager-list-columns-${caption.replace(/\s+/g, "-").toLowerCase()}`}
                  align="right"
                  panelClassName="w-56"
                  renderTrigger={({ buttonProps, open }) => (
                    <button
                      {...buttonProps}
                      type="button"
                      aria-label="Choose columns"
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-md text-text-muted outline-none hover:bg-surface-muted focus-visible:shadow-focus",
                        open && "bg-surface-muted text-text-primary",
                      )}
                    >
                      <GearIcon
                        size={operationalIconSizes.compactAction}
                        weight={operationalIconWeights.default}
                        aria-hidden
                      />
                    </button>
                  )}
                >
                  {() => (
                    <div className="flex flex-col p-1">
                      <p className="px-2 pb-1 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-text-muted">
                        Optional columns
                      </p>
                      {optionalColumns.map((column) => {
                        const visible = !hiddenKeys.includes(column.key);
                        return (
                          <button
                            key={column.key}
                            type="button"
                            role="menuitemcheckbox"
                            aria-checked={visible}
                            tabIndex={-1}
                            onClick={() =>
                              setHiddenKeys((current) =>
                                current.includes(column.key)
                                  ? current.filter((key) => key !== column.key)
                                  : [...current, column.key],
                              )
                            }
                            className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm font-semibold text-text-primary outline-none hover:bg-surface-muted focus-visible:bg-surface-muted"
                          >
                            {column.header}
                            {visible ? <span aria-hidden>✓</span> : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </OperationalTopNavDropdown>
              ) : null}
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const id = getRowId(row);
            const selected = selectedRowId === id;
            return (
              <tr
                key={id}
                data-manager-list-row={id}
                aria-selected={onSelectRow ? selected : undefined}
                onClick={onSelectRow ? () => onSelectRow(row) : undefined}
                className={cn(
                  "border-b border-border-subtle/60 last:border-b-0",
                  onSelectRow && "cursor-pointer hover:bg-surface-muted",
                  selected && "bg-surface-muted",
                )}
              >
                {visibleColumns.map((column, index) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-3 py-2.5 align-middle text-text-secondary",
                      column.numeric && "text-right tabular-nums",
                      index === 0 && "font-semibold text-text-primary",
                      column.hideBelowLarge && "hidden lg:table-cell",
                    )}
                  >
                    {index === 0 && onSelectRow ? (
                      // The first cell carries the keyboard affordance so the row is
                      // reachable without a mouse; the whole row stays clickable.
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectRow(row);
                        }}
                        className="rounded-sm text-left outline-none focus-visible:shadow-focus"
                      >
                        {column.render(row)}
                      </button>
                    ) : (
                      column.render(row)
                    )}
                  </td>
                ))}
                <td className="w-10 px-2" />
              </tr>
            );
          })}
        </tbody>

        {hasTotals ? (
          <tfoot>
            <tr className="border-t border-border-strong">
              {visibleColumns.map((column, index) => (
                <td
                  key={column.key}
                  className={cn(
                    "px-3 py-2.5 text-sm font-bold text-text-primary",
                    column.numeric && "text-right tabular-nums",
                  )}
                >
                  {index === 0 ? totalsLabel : column.total ? column.total(rows) : null}
                </td>
              ))}
              <td className="w-10 px-2" />
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
