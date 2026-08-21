import { ReactNode } from "react";

import {
  ManagerContentShell,
  ManagerControlPanel,
  ManagerListTable,
  type ManagerControlPanelSearch,
  type ManagerListColumn,
} from "@/components/manager/chrome";
import { Badge } from "@/components/ui";

import { AccountingRouteScopeNote } from "./AccountingNotes";

/**
 * The shared Customers/Vendors LIST scaffold — Track B5.2.
 *
 * One generic wrapper around the B1 chrome primitives (`ManagerControlPanel` +
 * `ManagerListTable`) so every one of the nine B5.2 list surfaces composes the
 * same way `ManagerOrdersScreen` (B3) does, rather than re-deriving the
 * control-panel/pager/table wiring nine times. Every interactive element this
 * file renders — pagination, the filter menu, row selection — is a callback
 * PROP into a chrome component; this file itself contains no `onClick=`,
 * `<Button`, or `<form>`, matching the read-only-tree guard the B5.1 assertion
 * script already enforces (it audits `components/manager/accounting/**`
 * recursively, this directory included).
 *
 * Pagination is genuinely server-side: every route this composes is
 * `data-total` with a real server `total` (route-registry `serverTotal:
 * true`), so — unlike Operations' `/pos/orders`, which has no aggregate and
 * whose totals row is honestly labelled "This page" — the pager here binds to
 * the real count and the totals row (when supplied) may say "This branch".
 */
export function AccountingListScreen<T>({
  title,
  routeKey,
  search,
  columns,
  rows,
  getRowId,
  onSelectRow,
  isLoading,
  isError,
  onRetry,
  errorMessage = "This list could not be read for the selected branch. Retry, or change the filters.",
  emptyTitle = "No records",
  emptyMessage = "Nothing matches the current filters.",
  pager,
  totalsLabel,
  footnote,
}: {
  title: string;
  routeKey: string;
  search?: ManagerControlPanelSearch;
  columns: ManagerListColumn<T>[];
  rows: readonly T[];
  getRowId: (row: T) => string;
  onSelectRow?: (row: T) => void;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  errorMessage?: string;
  emptyTitle?: string;
  emptyMessage?: string;
  pager: {
    from: number;
    to: number;
    total: number;
    hasPrevious: boolean;
    hasNext: boolean;
    onPrevious: () => void;
    onNext: () => void;
  };
  totalsLabel?: string;
  footnote?: ReactNode;
}) {
  return (
    <ManagerContentShell>
      <ManagerControlPanel
        title={title}
        badge={
          <>
            <Badge variant="neutral">Read-only</Badge>
            <AccountingRouteScopeNote routeKey={routeKey} />
          </>
        }
        search={search}
        pager={pager}
      />

      <ManagerListTable
        caption={title}
        columns={columns}
        rows={rows}
        getRowId={getRowId}
        onSelectRow={onSelectRow}
        isLoading={isLoading}
        isError={isError}
        onRetry={onRetry}
        errorMessage={errorMessage}
        emptyTitle={emptyTitle}
        emptyMessage={emptyMessage}
        totalsLabel={totalsLabel}
      />

      {footnote ? <p className="text-xs leading-5 text-text-muted">{footnote}</p> : null}
    </ManagerContentShell>
  );
}
