import { useRouter } from "next/router";
import { useCallback, useMemo, useState } from "react";

import {
  ManagerContentShell,
  ManagerControlPanel,
  ManagerListTable,
  ManagerRecordActionsMenu,
  type ManagerListColumn,
} from "@/components/manager/chrome";
import { ManagerOneTimeSecretPanel } from "@/components/manager/staff/ManagerOneTimeSecretPanel";
import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { Badge, Button, Card, ErrorState, LoadingState } from "@/components/ui";
import { useManagerBranch } from "@/lib/manager/branch-context";
import {
  useManagerDirectory,
  useManagerQuickPin,
  useManagerStaffErrorMessage,
  type ManagerQuickPinAction,
} from "@/lib/manager/staff-context";
import {
  filterManagerEmployeesByBranch,
  managerEmployeeStatusTone,
  titleCaseManagerStatus,
} from "@/lib/manager/staff-model";
import {
  buildManagerListQuery,
  firstManagerQueryValue,
  readManagerDirectoryScope,
} from "@/lib/manager/staff-route";
import type { ManagerEmployeeRow, ManagerOneTimeSecret } from "@/lib/manager/staff-types";

/**
 * Staff → Quick PIN administration (Track B3). The Odoo **C12 security table**
 * (reference screenshot `10-user-form-security-tab.jpg`) — a label ↔ one-line
 * description ↔ single-action-button table — rebuilt with **exactly the rows
 * Nimbus can back**.
 *
 * Odoo's tab lists Change Password / 2FA / API Keys / Passkeys / Devices.
 * Nimbus has **none of those** for frontline staff (NG-08): there is no password
 * concept, no 2FA, no API keys, no passkeys, and `/api/devices` is a hardware
 * registry rather than a session list. They are **omitted, not greyed out** —
 * a disabled "Revoke sessions" button would advertise a capability that does not
 * exist anywhere in this backend. What remains is real: Quick-PIN status, reset,
 * disable and enable.
 *
 * ## One status read per selection, on purpose
 *
 * `GET /hr/frontline-staff/:id/quick-pin-status` is per-employee and there is no
 * bulk equivalent. Filling a status column for every row would be one request
 * per employee on mount — 40 for the seeded organization, in flat contradiction
 * of the performance rules (CLAUDE.md §15). So the table lists people from the
 * directory read the page already makes, and the PIN facts load when a row is
 * selected. The screen says that in words rather than hiding it behind a
 * spinner.
 */
export function ManagerQuickPinScreen() {
  const router = useRouter();
  const branch = useManagerBranch();
  const scope = readManagerDirectoryScope(router.query.scope);
  const selectedId = firstManagerQueryValue(router.query.employeeId);

  // Component state, never a cache: the plaintext PIN a reset returns.
  const [secret, setSecret] = useState<ManagerOneTimeSecret | null>(null);
  const [pendingAction, setPendingAction] = useState<ManagerQuickPinAction | null>(null);

  const directory = useManagerDirectory({ status: "ACTIVE" });
  const quickPin = useManagerQuickPin(selectedId, { secret, setSecret });
  const actionError = useManagerStaffErrorMessage(quickPin.error);

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

  const allRows = useMemo(() => directory.listQuery.data?.rows || [], [directory.listQuery.data]);
  const rows = useMemo(() => {
    const scoped =
      scope === "branch" ? filterManagerEmployeesByBranch(allRows, branch.branchId) : allRows;
    // Only people with a linked login account have a PIN to administer; the
    // endpoint 400s for the rest, so they are excluded rather than offered.
    return scoped.filter((employee) => Boolean(employee.userId));
  }, [allRows, branch.branchId, scope]);

  const selected = useMemo(
    () => allRows.find((employee) => employee.id === selectedId) || null,
    [allRows, selectedId],
  );

  const status = quickPin.statusQuery.data;

  const columns: ManagerListColumn<ManagerEmployeeRow>[] = useMemo(
    () => [
      { key: "name", header: "Name", render: (row) => row.displayName },
      { key: "employeeCode", header: "Code", render: (row) => row.employeeCode || "—" },
      {
        key: "position",
        header: "Position",
        hideBelowLarge: true,
        render: (row) => row.positionTitle || <span className="text-text-muted">Not recorded</span>,
      },
      {
        key: "status",
        header: "Employment",
        render: (row) => (
          <Badge variant={managerEmployeeStatusTone(row.status)}>
            {titleCaseManagerStatus(row.status)}
          </Badge>
        ),
      },
      {
        key: "pin",
        header: "Quick PIN",
        render: (row) =>
          row.id === selectedId ? (
            quickPin.statusQuery.isLoading ? (
              <span className="text-text-muted">Reading…</span>
            ) : quickPin.statusQuery.isError ? (
              <span className="text-status-danger">Unavailable</span>
            ) : status ? (
              <Badge variant={status.pinEnabled ? "success" : status.pinExists ? "warning" : "neutral"}>
                {status.pinEnabled ? "Enabled" : status.pinExists ? "Disabled" : "Not issued"}
              </Badge>
            ) : (
              <span className="text-text-muted">—</span>
            )
          ) : (
            <span className="text-text-muted">Select to read</span>
          ),
      },
    ],
    [quickPin.statusQuery.isError, quickPin.statusQuery.isLoading, selectedId, status],
  );

  const confirmCopy: Record<ManagerQuickPinAction, { title: string; consequence: string; label: string; tone: "warning" | "danger" }> = {
    reset: {
      title: "Issue a new Quick PIN?",
      consequence: `${selected?.displayName || "This person"}'s current PIN stops working immediately. A new PIN is generated and shown to you once — it cannot be retrieved afterwards.`,
      label: "Issue new PIN",
      tone: "warning",
    },
    disable: {
      title: "Disable Quick PIN sign-in?",
      consequence: `${selected?.displayName || "This person"} will not be able to sign in on a POS terminal until the PIN is enabled again. The PIN itself is kept, so enabling restores the same one.`,
      label: "Disable PIN",
      tone: "danger",
    },
    enable: {
      title: "Enable Quick PIN sign-in?",
      consequence: `${selected?.displayName || "This person"} will be able to sign in on a POS terminal again with their existing PIN. If no PIN exists, issue one instead.`,
      label: "Enable PIN",
      tone: "warning",
    },
  };

  return (
    <ManagerContentShell>
      {/* No `search` slot: this surface has neither a text search nor a filter
          menu to host, so rendering the search chrome around a hint would be
          chrome for nothing — the same reasoning that omits the input on the
          endpoints without a text search. The constraint is explained in the
          paragraph below instead, where it belongs. */}
      <ManagerControlPanel
        title="Quick PIN administration"
        badge={<Badge variant="info">{branch.branchName}</Badge>}
      />

      <p className="max-w-4xl text-sm text-text-secondary">
        PIN status is read one person at a time — this backend has no bulk status endpoint, so
        filling a status column for everyone would mean one request per person. Selecting a row reads
        that person&apos;s status; nothing is read until you do.
      </p>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.5fr)]">
        <div className="min-w-0">
          <ManagerListTable
            caption="Staff with a login account"
            columns={columns}
            rows={rows}
            getRowId={(row) => row.id}
            selectedRowId={selectedId}
            onSelectRow={(row) => patchQuery({ employeeId: row.id })}
            isLoading={directory.listQuery.isLoading}
            isError={directory.listQuery.isError}
            onRetry={() => void directory.listQuery.refetch()}
            errorMessage="The staff list could not be read. Retry when the connection is stable."
            emptyTitle="No accounts to administer"
            emptyMessage={`Nobody active in ${branch.branchName} has a linked login account. Onboard frontline staff to create one.`}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {secret && selected ? (
            <ManagerOneTimeSecretPanel
              secret={secret}
              title={`New Quick PIN for ${selected.displayName}`}
              subject={selected.displayName}
              onDismiss={quickPin.dismissSecret}
            />
          ) : null}

          {!selected ? (
            <Card className="min-w-0">
              <h2 className="text-lg font-semibold text-text-primary">Select a person</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Their PIN status, tier, last reset and failed-attempt count load on selection, along
                with the actions this backend supports.
              </p>
            </Card>
          ) : quickPin.statusQuery.isLoading ? (
            <LoadingState title="Reading PIN status…" />
          ) : quickPin.statusQuery.isError ? (
            <div className="flex flex-col items-start gap-3">
              <ErrorState
                title="PIN status unavailable"
                description="This person's Quick PIN status could not be read. They may have no linked login account."
              />
              <Button variant="secondary" onClick={() => void quickPin.statusQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : status ? (
            <Card className="min-w-0" data-manager-quick-pin-panel={selected.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="min-w-0 truncate text-xl font-bold tracking-tight text-text-primary">
                  {selected.displayName}
                </h2>
                <ManagerRecordActionsMenu
                  ariaLabel="Quick PIN actions"
                  actions={[
                    {
                      key: "reset",
                      label: status.pinExists ? "Issue a new PIN" : "Issue a PIN",
                      description: status.pinExists
                        ? "Replaces the current PIN. Shown once."
                        : "Creates the first PIN. Shown once.",
                      disabled: !status.eligibleForPin,
                      disabledReason: "This role is not eligible for Quick PIN sign-in.",
                      onSelect: () => setPendingAction("reset"),
                    },
                    {
                      key: "disable",
                      label: "Disable PIN sign-in",
                      description: "Blocks POS sign-in without deleting the PIN.",
                      tone: "danger",
                      disabled: !status.pinEnabled,
                      disabledReason: "PIN sign-in is already disabled.",
                      onSelect: () => setPendingAction("disable"),
                    },
                    {
                      key: "enable",
                      label: "Enable PIN sign-in",
                      description: "Restores POS sign-in with the existing PIN.",
                      disabled: status.pinEnabled || !status.pinExists,
                      disabledReason: status.pinEnabled
                        ? "PIN sign-in is already enabled."
                        : "No PIN exists yet — issue one first.",
                      onSelect: () => setPendingAction("enable"),
                    },
                  ]}
                />
              </div>

              <dl className="mt-4 space-y-2 text-sm">
                {(
                  [
                    [
                      "Sign-in",
                      status.pinEnabled ? "Enabled" : status.pinExists ? "Disabled" : "No PIN issued",
                    ],
                    ["PIN length", status.pinLength ? `${status.pinLength} digits` : "—"],
                    ["Tier", status.pinTier ? titleCaseManagerStatus(status.pinTier) : "—"],
                    [
                      "Last reset",
                      status.pinLastResetAt
                        ? new Intl.DateTimeFormat(undefined, {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(status.pinLastResetAt))
                        : "Never reset",
                    ],
                    ["Failed attempts", status.failedPinAttempts ?? 0],
                    ["Locked out", status.isLocked ? "Yes" : "No"],
                    ["Sign-in method", status.authMode ? titleCaseManagerStatus(status.authMode) : "—"],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-text-muted">{label}</dt>
                    <dd className="font-semibold text-text-primary">{value}</dd>
                  </div>
                ))}
              </dl>

              {actionError ? (
                <p role="alert" className="mt-4 rounded-md bg-status-danger-surface px-3 py-2 text-sm font-semibold text-status-danger">
                  {actionError}
                </p>
              ) : null}

              <p className="mt-4 text-xs leading-5 text-text-muted">
                Last PIN use is not tracked by this backend, so it is not shown. Password resets, two-
                factor, API keys, passkeys and session revocation do not exist in Nimbus and are not
                offered here.
              </p>
            </Card>
          ) : null}
        </div>
      </div>

      <ActionConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction ? confirmCopy[pendingAction].title : ""}
        consequence={pendingAction ? confirmCopy[pendingAction].consequence : ""}
        confirmLabel={pendingAction ? confirmCopy[pendingAction].label : "Confirm"}
        tone={pendingAction ? confirmCopy[pendingAction].tone : "warning"}
        pending={quickPin.isPending}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => {
          const action = pendingAction;
          setPendingAction(null);
          if (action) quickPin.run(action);
        }}
      />
    </ManagerContentShell>
  );
}
