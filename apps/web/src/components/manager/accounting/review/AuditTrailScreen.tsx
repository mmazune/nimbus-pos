import { useRouter } from "next/router";
import { useMemo } from "react";

import { AccountingListScreen } from "@/components/manager/accounting/shared";
import { ManagerFilterChip, ManagerSearchFilterMenu, type ManagerListColumn } from "@/components/manager/chrome";
import { Badge } from "@/components/ui";
import { AUDIT_TIMELINE_PAGE_SIZE } from "@/lib/accounting/api";
import { toAccountingPager } from "@/lib/accounting/model";
import { AUDIT_ENTITY_TYPES, type AuditEntityType, type AuditTimelineItem } from "@/lib/accounting/types";
import { useAuditTimeline } from "@/lib/manager/accounting-surface-queries";
import { buildManagerListQuery, firstManagerQueryValue, readManagerPage } from "@/lib/manager/accounting-route";

const AUDIT_ENTITY_LABELS: Record<AuditEntityType, string> = {
  JournalEntry: "Journal entries",
  PostingRun: "Posting runs",
  PostingError: "Posting errors",
};

/**
 * `entityType` is validated against a CLOSED set even though the backend
 * itself accepts any free string (`AuditTimelineQueryDto.entityType` has no
 * `@IsEnum` — it is a raw `@IsString()`). These three literals are what
 * `ledger.service.ts` actually writes into `entityType` on every
 * `audit.log(...)` call it makes (`JournalEntry` / `PostingRun` /
 * `PostingError` — verified by reading the source, not guessed), so a
 * hand-edited `?entityType=Bogus` resolves to "no filter", the same
 * fail-closed shape `readManagerEnum` enforces for every backend-validated
 * filter elsewhere in this module.
 */
function readAuditEntityType(value: string | string[] | undefined): AuditEntityType | null {
  const raw = firstManagerQueryValue(value);
  return raw && (AUDIT_ENTITY_TYPES as readonly string[]).includes(raw) ? (raw as AuditEntityType) : null;
}

function formatAuditTimestamp(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Review → Audit trail — Track B5.4. `GET /api/audit/timeline` (BG2, reused
 * across every domain), scoped here to the three accounting-adjacent entity
 * types (`entityType` restricted to a curated set, not the full org-wide
 * feed — a "Review" rail belongs to the Accounting module, not a general
 * audit browser). Every row is already a complete, flat record — there is no
 * separate detail endpoint and no `?entryId=` state on this screen.
 *
 * ✅ B5-F4 FIXED (backend gap batch 3): this endpoint now honours
 * `X-Branch-Id` by default, so — unlike the B5.1-era registry note this pass
 * corrected — this is genuinely branch data, not organisation data.
 *
 * ⚠️ Pages with `page`/`pageSize`, not `skip`/`take` (the only accounting
 * route in this whole registry that does) — `toAccountingPager` still
 * applies; only the request parameter names differ.
 *
 * 🔴 C-26 (new finding, this pass): `ledger.service.ts`'s six `audit.log(...)`
 * calls stamp `metadata.orgId` but never `metadata.branchId` — live-proven by
 * creating fresh journal/reversal/posting-run/posting-error events via this
 * phase's own fixtures and finding every resulting row's `branchId` NULL.
 * Because the branch scope is an unconditional AND, this rail can
 * structurally never surface a ledger-domain event, regardless of how much
 * real activity exists — see `route-registry.ts`'s `audit.timeline` entry.
 * The empty state below says so; it does not claim nothing happened.
 */
export function AuditTrailScreen() {
  const router = useRouter();
  const page = readManagerPage(router.query.page);
  const entityType = readAuditEntityType(router.query.entityType);

  const listQuery = useAuditTimeline({ entityType: entityType || undefined, page, pageSize: AUDIT_TIMELINE_PAGE_SIZE });
  const rows = useMemo(() => listQuery.data?.data || [], [listQuery.data]);

  const patchQuery = (patch: Record<string, string | number | null>) =>
    void router.replace(
      { pathname: router.pathname, query: buildManagerListQuery(router.query, patch) },
      undefined,
      { shallow: true },
    );

  const columns: ManagerListColumn<AuditTimelineItem>[] = useMemo(
    () => [
      { key: "timestamp", header: "When", render: (row) => formatAuditTimestamp(row.timestamp) },
      { key: "action", header: "Action", render: (row) => row.action || "—" },
      {
        key: "entity",
        header: "Entity",
        render: (row) => (row.entityType ? <Badge variant="neutral">{row.entityType}</Badge> : "—"),
      },
      { key: "actorName", header: "Actor", render: (row) => row.actorName || "System" },
      { key: "summary", header: "Summary", optional: true, render: (row) => row.summary || "—" },
      { key: "sourceModule", header: "Module", optional: true, hideBelowLarge: true, render: (row) => row.sourceModule || "—" },
      { key: "ipAddress", header: "IP address", optional: true, defaultHidden: true, render: (row) => row.ipAddress || "—" },
    ],
    [],
  );

  const pager = toAccountingPager({ page, pageSize: AUDIT_TIMELINE_PAGE_SIZE, total: listQuery.data?.total });

  return (
    <AccountingListScreen
      title="Audit trail"
      routeKey="audit.timeline"
      search={{
        emptyHint: "This endpoint has no text search — filter by entity.",
        filterChips: entityType ? (
          <ManagerFilterChip
            label={AUDIT_ENTITY_LABELS[entityType]}
            onClear={() => patchQuery({ entityType: null })}
          />
        ) : null,
        filterMenu: (
          <ManagerSearchFilterMenu
            ariaLabel="Filter audit trail by entity"
            filters={AUDIT_ENTITY_TYPES.map((value) => ({ key: value, label: AUDIT_ENTITY_LABELS[value] }))}
            activeFilterKeys={entityType ? [entityType] : []}
            onToggleFilter={(key) => patchQuery({ entityType: entityType === key ? null : key })}
          />
        ),
      }}
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      isLoading={listQuery.isLoading}
      isError={listQuery.isError}
      onRetry={() => void listQuery.refetch()}
      emptyTitle="No matching audit event was returned"
      emptyMessage="This does not mean nothing happened: a verified backend gap (C-26) means every journal, posting-run and posting-error audit event is missing the branch tag this rail filters by, so none can appear here regardless of how much real activity exists. See the Journal entries, Posting runs and Posting errors lists directly for real activity."
      pager={{ ...pager, onPrevious: () => patchQuery({ page: Math.max(1, page - 1) }), onNext: () => patchQuery({ page: page + 1 }) }}
      footnote="Scoped to journal-entry, posting-run and posting-error events — the full organisation-wide audit feed spans every domain and is not offered here. 🔴 C-26: the backend never stamps metadata.branchId on these three event types, so this branch-scoped rail cannot currently surface any of them — a verified gap, not an empty history. This is a system log with no write path for any role; there is nothing to review-and-decide, only to read."
    />
  );
}
