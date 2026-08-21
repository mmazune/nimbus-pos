import { useRouter } from "next/router";
import { useMemo } from "react";

import {
  AccountingBackLink,
  AccountingFieldRow,
  AccountingListScreen,
} from "@/components/manager/accounting/shared";
import {
  ManagerBreadcrumbs,
  ManagerFilterChip,
  ManagerSearchFilterMenu,
  type ManagerListColumn,
} from "@/components/manager/chrome";
import { Badge, Card, ErrorState, LoadingState } from "@/components/ui";
import { ACCOUNTING_LIST_PAGE_SIZE, clampAccountingTake } from "@/lib/accounting/api";
import {
  accountingStatusTone,
  formatAccountingDate,
  titleCaseAccountingStatus,
  toAccountingPager,
} from "@/lib/accounting/model";
import { ACCOUNTING_ROUTES } from "@/lib/accounting/routes";
import { POSTING_ERROR_STATUSES, type PostingErrorRow } from "@/lib/accounting/types";
import { usePostingErrorDetail, usePostingErrorsList } from "@/lib/manager/accounting-surface-queries";
import {
  buildManagerListQuery,
  firstManagerQueryValue,
  readManagerEnum,
  readManagerPage,
} from "@/lib/manager/accounting-route";

/** A truncated, safely-stringified rendering of a `Json?` field — never assumes shape. */
function formatDetailsJson(details: unknown): string {
  if (details === null || details === undefined) return "—";
  try {
    const text = JSON.stringify(details, null, 2);
    return text.length > 800 ? `${text.slice(0, 800)}…` : text;
  } catch {
    return "Unavailable";
  }
}

/**
 * Review → Posting errors — Track B5.4. `GET /accounting/posting-errors` +
 * `GET /accounting/posting-errors/:id`.
 *
 * 🔴 **New finding (B5.4-D1), disclosed rather than hidden:** unlike every
 * other "Manager cannot write" surface in this module, there is genuinely NO
 * resolve/dismiss endpoint anywhere in the API for `PostingError` — grepping
 * every controller in `apps/api/src/modules` for a mutation on this entity
 * finds none. `PostingErrorStatus` (`OPEN → RESOLVED | DISMISSED`) is a real
 * enum with no write path to reach either terminal state through this API,
 * for ANY role, not just Manager. So this screen does NOT render
 * `AccountingReadOnlyCard` (whose copy claims "an Owner or Accountant
 * performs this" — false here) — it states the gap plainly instead.
 */
export function PostingErrorsScreen() {
  const router = useRouter();
  const page = readManagerPage(router.query.page);
  const status = readManagerEnum(router.query.status, POSTING_ERROR_STATUSES);
  const selectedErrorId = firstManagerQueryValue(router.query.errorId);

  const take = clampAccountingTake(ACCOUNTING_LIST_PAGE_SIZE);
  const listQuery = usePostingErrorsList({ status: status || undefined, skip: (page - 1) * take, take });
  const rows = useMemo(() => listQuery.data?.data || [], [listQuery.data]);

  const patchQuery = (patch: Record<string, string | number | null>) =>
    void router.replace(
      { pathname: router.pathname, query: buildManagerListQuery(router.query, patch) },
      undefined,
      { shallow: true },
    );

  const openError = (errorId: string | null) =>
    void router.push(
      { pathname: router.pathname, query: buildManagerListQuery(router.query, { errorId, page }) },
      undefined,
      { shallow: true },
    );

  const columns: ManagerListColumn<PostingErrorRow>[] = useMemo(
    () => [
      { key: "sourceKey", header: "Source", render: (row) => row.sourceKey || "—" },
      { key: "code", header: "Code", render: (row) => row.code || "—" },
      { key: "message", header: "Message", optional: true, render: (row) => row.message || "—" },
      { key: "createdAt", header: "Reported", render: (row) => formatAccountingDate(row.createdAt) },
      {
        key: "status",
        header: "Status",
        render: (row) => (
          <Badge variant={row.status === "OPEN" ? "danger" : accountingStatusTone(row.status)}>
            {titleCaseAccountingStatus(row.status)}
          </Badge>
        ),
      },
    ],
    [],
  );

  const pager = toAccountingPager({ page, pageSize: take, total: listQuery.data?.total });

  if (selectedErrorId) {
    return <PostingErrorDetailPanel errorId={selectedErrorId} pageRows={rows} onSelectError={openError} />;
  }

  return (
    <AccountingListScreen
      title="Posting errors"
      routeKey="accounting.postingErrors"
      search={{
        emptyHint: "This endpoint has no text search — filter by status.",
        filterChips: status ? (
          <ManagerFilterChip label={titleCaseAccountingStatus(status)} onClear={() => patchQuery({ status: null })} />
        ) : null,
        filterMenu: (
          <ManagerSearchFilterMenu
            ariaLabel="Filter posting errors"
            filters={POSTING_ERROR_STATUSES.map((value) => ({ key: value, label: titleCaseAccountingStatus(value) }))}
            activeFilterKeys={status ? [status] : []}
            onToggleFilter={(key) => patchQuery({ status: status === key ? null : key })}
          />
        ),
      }}
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      onSelectRow={(row) => openError(row.id)}
      isLoading={listQuery.isLoading}
      isError={listQuery.isError}
      onRetry={() => void listQuery.refetch()}
      emptyTitle="No posting errors match"
      emptyMessage="No posting error in this branch matches the current filter — a healthy sign, not a missing feature."
      pager={{ ...pager, onPrevious: () => patchQuery({ page: Math.max(1, page - 1) }), onNext: () => patchQuery({ page: page + 1 }) }}
      totalsLabel="This page"
      footnote="A posting error is raised when a posting-run replay fails. No endpoint exists to resolve or dismiss one — OPEN is effectively terminal through this API for every role, not only Manager."
    />
  );
}

function PostingErrorDetailPanel({
  errorId,
  onSelectError,
  pageRows,
}: {
  errorId: string;
  onSelectError: (id: string | null) => void;
  pageRows: readonly PostingErrorRow[];
}) {
  const detailQuery = usePostingErrorDetail(errorId);
  const error = detailQuery.data;
  const position = pageRows.findIndex((row) => row.id === errorId);

  return (
    <>
      <ManagerBreadcrumbs
        parent={{ label: "Posting errors", href: ACCOUNTING_ROUTES.postingErrors }}
        recordLabel={error?.code || "Posting error"}
        pager={
          position >= 0
            ? {
                position: position + 1,
                total: pageRows.length,
                hasPrevious: position > 0,
                hasNext: position < pageRows.length - 1,
                onPrevious: () => onSelectError(pageRows[position - 1].id),
                onNext: () => onSelectError(pageRows[position + 1].id),
              }
            : undefined
        }
      />

      {detailQuery.isLoading ? (
        <LoadingState title="Loading posting error…" />
      ) : detailQuery.isError || !error ? (
        <div className="flex flex-col items-start gap-3">
          <ErrorState
            title="Posting error unavailable"
            description="This posting error could not be read for the selected branch. It may belong to another branch, or the request failed."
          />
          <AccountingBackLink href={ACCOUNTING_ROUTES.postingErrors} label="Back to posting errors" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge variant={error.status === "OPEN" ? "danger" : accountingStatusTone(error.status)}>
              {titleCaseAccountingStatus(error.status)}
            </Badge>
          </div>

          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.5fr)]">
            <div className="min-w-0 rounded-lg bg-surface p-5 shadow-subtle">
              <h2 className="text-2xl font-bold tracking-tight text-text-primary">{error.code || error.id}</h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{error.message || "No message recorded."}</p>

              <dl className="mt-4 grid gap-x-8 sm:grid-cols-2">
                <AccountingFieldRow label="Source">{error.sourceKey || "—"}</AccountingFieldRow>
                <AccountingFieldRow label="Source document">{error.sourceDocumentId || "—"}</AccountingFieldRow>
                <AccountingFieldRow label="Reported">{formatAccountingDate(error.createdAt)}</AccountingFieldRow>
                <AccountingFieldRow label="Posting run">
                  {error.postingRun ? (
                    <AccountingBackLink href={ACCOUNTING_ROUTES.postingRuns} label={error.postingRun.sourceKey || error.postingRun.id} />
                  ) : (
                    "—"
                  )}
                </AccountingFieldRow>
                <AccountingFieldRow label="Run key">{error.postingRun?.runKey || "—"}</AccountingFieldRow>
              </dl>

              <h3 className="mt-6 text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Details</h3>
              <pre className="mt-2 overflow-x-auto rounded-md bg-surface-muted p-3 text-xs leading-5 text-text-secondary">
                {formatDetailsJson(error.details)}
              </pre>
            </div>

            <div className="flex min-w-0 flex-col gap-5">
              <Card className="min-w-0 bg-status-warning-surface">
                <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-status-warning">
                  No role can act on this record
                </h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  This is not a permission boundary — it is a genuine gap in this API. No endpoint exists anywhere
                  to resolve or dismiss a posting error, for any role. <code>OPEN</code> is effectively terminal
                  until a resolve/dismiss route is added.
                </p>
              </Card>
            </div>
          </div>
        </>
      )}
    </>
  );
}
