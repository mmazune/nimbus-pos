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
import { formatManagerDate, formatManagerDateTime, toManagerPager } from "@/lib/manager/operations-model";
import { MANAGER_REVIEW_TAKE } from "@/lib/manager/staff-api";
import { useManagerShiftSwapReview, useManagerStaffErrorMessage } from "@/lib/manager/staff-context";
import {
  MANAGER_SHIFT_SWAP_STATUS_FILTERS,
  isManagerReviewDecidable,
  managerReviewStatusTone,
  titleCaseManagerStatus,
} from "@/lib/manager/staff-model";
import {
  buildManagerListQuery,
  firstManagerQueryValue,
  readManagerPage,
  readManagerShiftSwapStatus,
} from "@/lib/manager/staff-route";
import type { ManagerShiftSwapRow } from "@/lib/manager/staff-types";

/**
 * Staff → Shift swaps (Track B3) — **REJECT ONLY (Outcome C)**.
 *
 * ## Why there is no Approve button, and why that is the correct build
 *
 * `PATCH /api/hr/shift-swaps/:id/approve` accepts `status: APPROVED | REJECTED`
 * and Manager holds `pos:hr:shift-swaps:approve`. So an Approve button would
 * "work" — it would return 200. It would also be a lie.
 *
 * `attendance.service.ts:555-623` mutates the `ShiftSwapRequest` row and writes
 * one audit event. **Nothing else.** A repo-wide grep finds SIX
 * `scheduleAssignment` call sites and every one of them is a READ
 * (`attendance.service.ts:439,454`; `staff-insights.service.ts:293`;
 * `workforce.service.ts:425,436,467`) — there is no create, update or delete of
 * a roster row anywhere in the API. The request itself references only a
 * `shiftDate`, not a specific shift, so there is not even a target to reassign.
 * **Approving mutates ZERO roster rows**, and a manager who pressed Approve
 * would reasonably believe the roster had changed.
 *
 * Supervisor reached this conclusion first (SUP-RG-036/042) and shipped
 * reject-only with an honest notice (`docs/supervisor-ui-docs/
 * SUPERVISOR_APPROVAL_LIFECYCLE.md`). Manager follows that precedent exactly.
 * Rejecting is truthful — it writes a real decision and changes no roster row,
 * which is precisely what it claims.
 *
 * **Do not add an Approve control here without a roster-mutation service, a
 * specific-shift reference on the request, and explicit authorization.**
 */
export function ManagerShiftSwapReviewScreen() {
  const router = useRouter();
  const branch = useManagerBranch();
  const page = readManagerPage(router.query.page);
  const status = readManagerShiftSwapStatus(router.query.status);
  const selectedId = firstManagerQueryValue(router.query.swapId);

  const review = useManagerShiftSwapReview(status, page);
  const errorMessage = useManagerStaffErrorMessage(review.rejectionError);
  const [confirmOpen, setConfirmOpen] = useState(false);
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
  const selected = useMemo(() => rows.find((row) => row.id === selectedId) || null, [rows, selectedId]);

  const columns: ManagerListColumn<ManagerShiftSwapRow>[] = useMemo(
    () => [
      { key: "requester", header: "Requested by", render: (row) => row.requester.displayName },
      { key: "target", header: "Swapping with", render: (row) => row.target.displayName },
      { key: "shiftDate", header: "Shift date", render: (row) => formatManagerDate(row.shiftDate) },
      {
        key: "createdAt",
        header: "Submitted",
        optional: true,
        hideBelowLarge: true,
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
        title="Shift swaps"
        badge={<Badge variant="warning">Reject only</Badge>}
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
              ariaLabel="Filter shift swaps"
              filters={MANAGER_SHIFT_SWAP_STATUS_FILTERS.map((value) => ({
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

      <Card className="min-w-0 bg-status-warning-surface" data-manager-shift-swap-notice>
        <h2 className="text-sm font-bold text-text-primary">
          Swaps can be declined here, but not granted
        </h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-text-secondary">
          Nimbus cannot reassign a shift. Published rosters are read-only across the whole API —
          there is no endpoint anywhere that creates, updates or deletes a schedule assignment — and
          a swap request names only a date, not a specific shift. Marking a swap &ldquo;approved&rdquo;
          would therefore change the request&apos;s status and nothing else, while telling two people
          their shifts had been exchanged. So this screen offers <strong>Decline</strong> only.
          Arrange an agreed swap directly with the staff involved.
        </p>
      </Card>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.5fr)]">
        <div className="min-w-0">
          <ManagerListTable
            caption="Shift swap requests"
            columns={columns}
            rows={rows}
            getRowId={(row) => row.id}
            selectedRowId={selectedId}
            onSelectRow={(row) => patchQuery({ swapId: row.id })}
            isLoading={review.listQuery.isLoading}
            isError={review.listQuery.isError}
            onRetry={() => void review.listQuery.refetch()}
            errorMessage="Shift swap requests could not be read for this branch."
            emptyTitle="No shift swaps"
            emptyMessage="No shift swap requests for this branch match the current filter."
          />
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {selected ? (
            <Card className="min-w-0" data-manager-shift-swap-detail={selected.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="min-w-0 text-xl font-bold tracking-tight text-text-primary">
                  {selected.requester.displayName} → {selected.target.displayName}
                </h2>
                <Badge variant={managerReviewStatusTone(selected.status)}>
                  {titleCaseManagerStatus(selected.status)}
                </Badge>
              </div>

              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted">Shift date</dt>
                  <dd className="font-semibold text-text-primary">{formatManagerDate(selected.shiftDate)}</dd>
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
                    {selected.approvedAt ? ` on ${formatManagerDateTime(selected.approvedAt)}` : ""}. A
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
                <div className="mt-5">
                  <Button
                    variant="danger"
                    disabled={review.isRejecting}
                    onClick={() => {
                      setNotes("");
                      setConfirmOpen(true);
                    }}
                  >
                    Decline swap
                  </Button>
                  <p className="mt-3 text-xs leading-5 text-text-muted">
                    There is no Approve action, and its absence is deliberate — see the notice above.
                  </p>
                </div>
              ) : null}
            </Card>
          ) : (
            <Card className="min-w-0">
              <h2 className="text-lg font-semibold text-text-primary">Select a request</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Choosing a request shows who asked, who they want to swap with, the date and the
                reason — and, while it is still pending, the decline action.
              </p>
            </Card>
          )}
        </div>
      </div>

      <ActionConfirmDialog
        open={confirmOpen}
        title="Decline this shift swap?"
        tone="danger"
        confirmLabel="Decline swap"
        pending={review.isRejecting}
        consequence={`The request is recorded as rejected, with you as the reviewer. No roster row changes — this backend has no roster write — so ${selected?.requester.displayName || "the requester"} keeps the shift they already had.`}
        context={
          selected ? (
            <p>
              {selected.requester.displayName} → {selected.target.displayName} ·{" "}
              {formatManagerDate(selected.shiftDate)}
            </p>
          ) : null
        }
        reason={{
          label: "Note for the record",
          placeholder: "Optional. Stored on the request so the staff member can see why.",
          value: notes,
          onChange: setNotes,
        }}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          if (selected) review.reject({ swapId: selected.id, reviewNotes: notes });
        }}
      />
    </ManagerContentShell>
  );
}
