import { useRouter } from "next/router";
import { useMemo } from "react";

import { AccountingBackLink, AccountingListScreen } from "@/components/manager/accounting/shared";
import type { ManagerListColumn } from "@/components/manager/chrome";
import { Badge } from "@/components/ui";
import { ACCOUNTING_LIST_PAGE_SIZE, clampAccountingTake } from "@/lib/accounting/api";
import {
  accountingStatusTone,
  formatAccountingCount,
  formatAccountingDate,
  titleCaseAccountingStatus,
  toAccountingPager,
} from "@/lib/accounting/model";
import { ACCOUNTING_ROUTES } from "@/lib/accounting/routes";
import type { PostingRunRow } from "@/lib/accounting/types";
import { usePostingRunsList } from "@/lib/manager/accounting-surface-queries";
import { buildManagerListQuery, readManagerPage } from "@/lib/manager/accounting-route";

/**
 * Review → Posting runs — Track B5.4. `GET /accounting/posting-runs`, list
 * only — `ledger.controller.ts` declares no detail route for this entity, so
 * there is nothing to drill into and no `?runId=` state on this screen.
 *
 * `POST /accounting/posting/replay` — the write this list is the READ side
 * of — is the "New" affordance an Odoo-style posting log would offer; Manager
 * is 403 on it (`pos:accounting:posting:replay`, re-verified live). This
 * route accepts NO server-side filter at all, not even status, so unlike
 * every other B5.2–B5.4 list this screen offers no filter menu — one would
 * imply a capability the endpoint does not have.
 */
export function PostingRunsScreen() {
  const router = useRouter();
  const page = readManagerPage(router.query.page);

  const take = clampAccountingTake(ACCOUNTING_LIST_PAGE_SIZE);
  const listQuery = usePostingRunsList({ skip: (page - 1) * take, take });
  const rows = useMemo(() => listQuery.data?.data || [], [listQuery.data]);

  const patchQuery = (patch: Record<string, string | number | null>) =>
    void router.replace(
      { pathname: router.pathname, query: buildManagerListQuery(router.query, patch) },
      undefined,
      { shallow: true },
    );

  const columns: ManagerListColumn<PostingRunRow>[] = useMemo(
    () => [
      { key: "sourceKey", header: "Source", render: (row) => row.sourceKey || "—" },
      { key: "sourceDocumentId", header: "Source document", optional: true, render: (row) => row.sourceDocumentId || "—" },
      { key: "runKey", header: "Run key", optional: true, defaultHidden: true, hideBelowLarge: true, render: (row) => row.runKey || "—" },
      {
        key: "journal",
        header: "Journal",
        render: (row) =>
          row.journalEntry ? (
            <AccountingBackLink
              href={`${ACCOUNTING_ROUTES.journals}?journalId=${row.journalEntry.id}`}
              label={row.journalEntry.journalNumber || row.journalEntry.id}
            />
          ) : (
            "—"
          ),
      },
      {
        key: "errorCount",
        header: "Errors",
        numeric: true,
        render: (row) => formatAccountingCount(row.errorCount ?? 0),
        total: (pageRows) => formatAccountingCount(pageRows.reduce((sum, row) => sum + (row.errorCount ?? 0), 0)),
      },
      { key: "startedAt", header: "Started", optional: true, render: (row) => formatAccountingDate(row.startedAt) },
      { key: "finishedAt", header: "Finished", render: (row) => formatAccountingDate(row.finishedAt) },
      {
        key: "status",
        header: "Status",
        render: (row) => <Badge variant={accountingStatusTone(row.status)}>{titleCaseAccountingStatus(row.status)}</Badge>,
      },
    ],
    [],
  );

  const pager = toAccountingPager({ page, pageSize: take, total: listQuery.data?.total });

  return (
    <AccountingListScreen
      title="Posting runs"
      routeKey="accounting.postingRuns"
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      isLoading={listQuery.isLoading}
      isError={listQuery.isError}
      onRetry={() => void listQuery.refetch()}
      emptyTitle="No posting runs"
      emptyMessage="No posting run has been recorded for this branch."
      pager={{ ...pager, onPrevious: () => patchQuery({ page: Math.max(1, page - 1) }), onNext: () => patchQuery({ page: page + 1 }) }}
      totalsLabel="This page"
      footnote="This endpoint accepts no filter of any kind, not even status. A posting run replays automated postings from a source document (e.g. a closed order); replaying one is performed by an Owner or Accountant — the manager role holds accounting read access only."
    />
  );
}
