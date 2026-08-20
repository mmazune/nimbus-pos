import { useRouter } from "next/router";
import { useCallback, useMemo, useState } from "react";

import {
  ManagerContentShell,
  ManagerControlPanel,
  ManagerFilterChip,
  ManagerListTable,
  ManagerSearchFilterMenu,
  type ManagerListColumn,
} from "@/components/manager/chrome";
import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { Badge, Button, Card } from "@/components/ui";
import { useManagerBranch } from "@/lib/manager/branch-context";
import { formatManagerDateTime, toManagerPager } from "@/lib/manager/operations-model";
import { useManagerLeaveReview, useManagerStaffErrorMessage } from "@/lib/manager/staff-context";
import {
  MANAGER_LEAVE_STATUS_FILTERS,
  formatManagerLeaveWindow,
  isManagerReviewDecidable,
  managerLeaveDayCount,
  managerReviewStatusTone,
  titleCaseManagerStatus,
} from "@/lib/manager/staff-model";
import {
  buildManagerListQuery,
  firstManagerQueryValue,
  readManagerLeaveStatus,
  readManagerPage,
} from "@/lib/manager/staff-route";
import { MANAGER_REVIEW_TAKE } from "@/lib/manager/staff-api";
import type { ManagerLeaveRow } from "@/lib/manager/staff-types";

/**
 * Staff → Leave requests (Track B3), over `GET /api/hr/leave` +
 * `PATCH /api/hr/leave/:id/review` (`pos:hr:leave:review`).
 *
 * ## Two things this screen must be honest about
 *
 * 1. **The decision is ORGANIZATION-scoped, not branch-scoped.** Leave has a
 *    nullable `branchId` and the service looks a record up by `{ id, orgId }`
 *    alone (`attendance.service.ts:330`) — by design, because an employee's leave
 *    is reviewed at org level. The LIST is branch-filtered server-side, so what
 *    is shown is this branch's; but the review itself is not branch-guarded, and
 *    the screen says so instead of implying a boundary that is not enforced.
 * 2. **Approving leave changes nothing but the leave record.** The service
 *    writes `status`, `reviewedById`, `reviewedAt` and `reviewNotes`, and one
 *    audit row. **No payroll entry and no roster row is touched** — the same
 *    limitation Supervisor documented. The confirmation says exactly that, so a
 *    manager does not assume a shift has been backfilled.
 *
 * Terminal records render read-only: the service rejects a second review with a
 * 400, so offering the buttons would be offering a guaranteed error.
 */
export function ManagerLeaveReviewScreen() {
  const router = useRouter();
  const branch = useManagerBranch();
  const page = readManagerPage(router.query.page);
  const status = readManagerLeaveStatus(router.query.status);
  const selectedId = firstManagerQueryValue(router.query.leaveId);

  const review = useManagerLeaveReview(status, page);
  const errorMessage = useManagerStaffErrorMessage(review.decisionError);
  const [pending, setPending] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [notes, setNotes] = useState("");

  const patchQuery = useCallback(
    (patch: Record<string, string | number | null>) => {
      void router.replace(
        { pathname: router.pathname, query: buildManagerListQuery(router.query, patch) },
        undefined,
        { shallow: true },
      );
    },
    [router],
  );

  const rows = useMemo(() => review.listQuery.data?.rows || [], [review.listQuery.data]);
  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) || null,
    [rows, selectedId],
  );

  const columns: ManagerListColumn<ManagerLeaveRow>[] = useMemo(
    () => [
      { key: "employee", header: "Employee", render: (row) => row.employee.displayName },
      { key: "leaveType", header: "Type", render: (row) => titleCaseManagerStatus(row.leaveType) },
      {
        key: "window",
        header: "Dates",
        render: (row) => formatManagerLeaveWindow(row.startsAt, row.endsAt),
      },
      {
        key: "days",
        header: "Days",
        numeric: true,
        render: (row) => managerLeaveDayCount(row.startsAt, row.endsAt) ?? "—",
      },
      {
        key: "requestedBy",
        header: "Requested by",
        optional: true,
        hideBelowLarge: true,
        render: (row) => row.requestedByName || <span className="text-text-muted">—</span>,
      },
      {
        key: "createdAt",
        header: "Submitted",
        optional: true,
        defaultHidden: true,
        render: (row) => formatManagerDateTime(row.createdAt),
      },
      {
        key: "status",
        header: "Status",
        render: (row) => (
          <Badge variant={managerReviewStatusTone(row.status)}>
            {titleCaseManagerStatus(row.status)}
          </Badge>
        ),
      },
    ],
    [],
  );

  const pager = toManagerPager({
    page,
    pageSize: MANAGER_REVIEW_TAKE,
    rowCount: rows.length,
    total: review.listQuery.data?.total ?? 0,
  });

  const decidable = selected ? isManagerReviewDecidable(selected.status) : false;

  return (
    <ManagerContentShell>
      <ManagerControlPanel
        title="Leave requests"
        badge={<Badge variant="info">{branch.branchName}</Badge>}
        search={{
          emptyHint: "This endpoint has no text search — filter by status.",
          filterChips: status ? (
            <ManagerFilterChip
              label={titleCaseManagerStatus(status)}
              onClear={() => patchQuery({ status: null })}
            />
          ) : null,
          filterMenu: (
            <ManagerSearchFilterMenu
              ariaLabel="Filter leave requests"
              filters={MANAGER_LEAVE_STATUS_FILTERS.map((value) => ({
                key: value,
                label: titleCaseManagerStatus(value),
              }))}
              activeFilterKeys={status ? [status] : []}
              onToggleFilter={(key) => patchQuery({ status: status === key ? null : key })}
            />
          ),
        }}
        pager={{
          ...pager,
          onPrevious: () => patchQuery({ page: Math.max(1, page - 1) }),
          onNext: () => patchQuery({ page: page + 1 }),
        }}
      />

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.5fr)]">
        <div className="min-w-0">
          <ManagerListTable
            caption="Leave requests"
            columns={columns}
            rows={rows}
            getRowId={(row) => row.id}
            selectedRowId={selectedId}
            onSelectRow={(row) => patchQuery({ leaveId: row.id })}
            isLoading={review.listQuery.isLoading}
            isError={review.listQuery.isError}
            onRetry={() => void review.listQuery.refetch()}
            errorMessage="Leave requests could not be read for this branch."
            emptyTitle="No leave requests"
            emptyMessage="No leave requests for this branch match the current filter."
          />
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {selected ? (
            <Card className="min-w-0" data-manager-leave-detail={selected.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="min-w-0 truncate text-xl font-bold tracking-tight text-text-primary">
                  {selected.employee.displayName}
                </h2>
                <Badge variant={managerReviewStatusTone(selected.status)}>
                  {titleCaseManagerStatus(selected.status)}
                </Badge>
              </div>

              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted">Type</dt>
                  <dd className="font-semibold text-text-primary">
                    {titleCaseManagerStatus(selected.leaveType)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted">Dates</dt>
                  <dd className="font-semibold text-text-primary">
                    {formatManagerLeaveWindow(selected.startsAt, selected.endsAt)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted">Days</dt>
                  <dd className="font-semibold text-text-primary">
                    {managerLeaveDayCount(selected.startsAt, selected.endsAt) ?? "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted">Submitted</dt>
                  <dd className="font-semibold text-text-primary">
                    {formatManagerDateTime(selected.createdAt)}
                  </dd>
                </div>
              </dl>

              {selected.reason ? (
                <div className="mt-4">
                  <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Reason</h3>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">{selected.reason}</p>
                </div>
              ) : null}

              {!decidable ? (
                <div className="mt-4 rounded-md bg-surface-muted px-3 py-2">
                  <p className="text-sm leading-6 text-text-secondary">
                    Already {titleCaseManagerStatus(selected.status).toLowerCase()}
                    {selected.reviewedByName ? ` by ${selected.reviewedByName}` : ""}
                    {selected.reviewedAt ? ` on ${formatManagerDateTime(selected.reviewedAt)}` : ""}. A
                    decided request cannot be reviewed again.
                  </p>
                  {selected.reviewNotes ? (
                    <p className="mt-2 text-sm leading-6 text-text-secondary">
                      <span className="font-semibold text-text-primary">Note:</span> {selected.reviewNotes}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {errorMessage ? (
                <p role="alert" className="mt-4 rounded-md bg-status-danger-surface px-3 py-2 text-sm font-semibold text-status-danger">
                  {errorMessage}
                </p>
              ) : null}

              {decidable ? (
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button
                    variant="primary"
                    disabled={review.isDeciding}
                    onClick={() => {
                      setNotes("");
                      setPending("APPROVED");
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="danger"
                    disabled={review.isDeciding}
                    onClick={() => {
                      setNotes("");
                      setPending("REJECTED");
                    }}
                  >
                    Reject
                  </Button>
                </div>
              ) : null}

              <p className="mt-5 text-xs leading-5 text-text-muted">
                Reviewing writes the decision, the reviewer and the note to the leave record only. No
                payroll entry is created or changed, and no shift is reassigned — this backend has no
                roster write at all.
                {selected.branchId
                  ? " Leave is reviewed at organization level, so this decision is not branch-guarded."
                  : " This request carries no branch and is an organization-level record."}
              </p>
            </Card>
          ) : (
            <Card className="min-w-0">
              <h2 className="text-lg font-semibold text-text-primary">Select a request</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Choosing a request shows its dates, reason and decision history, and — while it is
                still pending — the approve and reject actions.
              </p>
            </Card>
          )}
        </div>
      </div>

      <ActionConfirmDialog
        open={Boolean(pending)}
        title={pending === "APPROVED" ? "Approve this leave request?" : "Reject this leave request?"}
        tone={pending === "APPROVED" ? "warning" : "danger"}
        confirmLabel={pending === "APPROVED" ? "Approve leave" : "Reject leave"}
        pending={review.isDeciding}
        consequence={
          pending === "APPROVED"
            ? `${selected?.employee.displayName || "This employee"}'s leave is recorded as approved, with you as the reviewer. It does NOT create a payroll entry and it does NOT reassign their shifts — cover has to be arranged separately.`
            : `${selected?.employee.displayName || "This employee"}'s leave is recorded as rejected, with you as the reviewer. The decision cannot be changed afterwards from this workspace.`
        }
        context={
          selected ? (
            <p>
              {titleCaseManagerStatus(selected.leaveType)} ·{" "}
              {formatManagerLeaveWindow(selected.startsAt, selected.endsAt)}
            </p>
          ) : null
        }
        reason={{
          label: "Note for the record",
          placeholder: "Optional. Stored on the leave request and visible to whoever reads it next.",
          value: notes,
          onChange: setNotes,
        }}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const decision = pending;
          setPending(null);
          if (decision && selected) {
            review.decide({ leaveId: selected.id, decision, reviewNotes: notes });
          }
        }}
      />
    </ManagerContentShell>
  );
}
