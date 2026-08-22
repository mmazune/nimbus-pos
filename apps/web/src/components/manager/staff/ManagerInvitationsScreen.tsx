import { useState } from "react";

import { ManagerContentShell, ManagerControlPanel } from "@/components/manager/chrome";
import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { useManagerInvitations } from "@/lib/manager/invitations-context";
import {
  canResendManagerInvitation,
  canRevokeManagerInvitation,
  emptyManagerInvitationDraft,
  MANAGER_INVITABLE_ROLES,
  managerInvitationDisplayName,
  managerInvitationStatusTone,
  validateManagerInvitationDraft,
} from "@/lib/manager/invitations-model";
import { useManagerStaffErrorMessage } from "@/lib/manager/staff-context";
import { titleCaseManagerStatus } from "@/lib/manager/staff-model";

import { ManagerOneTimeSecretPanel } from "./ManagerOneTimeSecretPanel";

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

/**
 * Manager Invitations (Track B6) — invite Manager/Accountant-tier staff by
 * email + temporary password, then resend/revoke pending invitations.
 *
 * 🔴 There is no branch picker here, and that is deliberate: `POST
 * /onboarding/invitations` always assigns the invitee to the organization's
 * OLDEST active branch, ignoring `X-Branch-Id` entirely (live-confirmed against
 * source — `client-onboarding.service.ts`'s `createInvitations()`). The banner
 * below states this rather than implying the current branch is honoured.
 *
 * Only `Manager` and `Accountant` are invitable — other staff use "Onboard
 * frontline staff" (Quick-PIN, already built in B3). The temp password and
 * invitation token are shown ONCE via the same `ManagerOneTimeSecretPanel`
 * pattern B3 established for Quick-PIN.
 */
export function ManagerInvitationsScreen() {
  const {
    create,
    createError,
    createResult,
    isCreating,
    isEnabled,
    isResending,
    isRevoking,
    listQuery,
    resend,
    resendError,
    resendId,
    resetCreate,
    revoke,
    revokeError,
    revokeId,
  } = useManagerInvitations();

  const [draft, setDraft] = useState(emptyManagerInvitationDraft());
  const [pendingRevoke, setPendingRevoke] = useState<{ id: string; displayName: string } | null>(null);
  const [revokeReason, setRevokeReason] = useState("");

  const createErrorMessage = useManagerStaffErrorMessage(createError);
  const resendErrorMessage = useManagerStaffErrorMessage(resendError);
  const revokeErrorMessage = useManagerStaffErrorMessage(revokeError);
  const errors = validateManagerInvitationDraft(draft);

  if (!isEnabled) return null;

  return (
    <ManagerContentShell>
      <ManagerControlPanel title="Invitations" />

      <Card className="min-w-0 bg-status-info-surface">
        <p className="text-sm leading-6 text-text-primary">
          Invitations are for <strong>Manager</strong> and <strong>Accountant</strong> accounts, who sign in with
          email + password. Frontline staff (Waiter, Cashier, Chef, …) use{" "}
          <strong>Onboard frontline staff</strong> instead — they sign in with a Quick PIN.
        </p>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          A new invitee is always assigned to the organization&apos;s original branch, not necessarily the branch you
          are currently viewing — the backend does not offer a choice here.
        </p>
      </Card>

      {createResult?.tempPassword ? (
        <ManagerOneTimeSecretPanel
          title="Temporary password issued"
          subject={createResult.email}
          secretLabel="temporary password"
          secret={{
            value: createResult.tempPassword,
            length: null,
            tier: null,
            note: "Share it securely — the invitee should change it on first login.",
          }}
          onDismiss={resetCreate}
        />
      ) : null}

      <Card className="min-w-0">
        <h2 className="text-lg font-bold text-text-primary">Invite a Manager or Accountant</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold text-text-secondary">
            <span>Email {errors.email ? <span className="text-status-danger">— {errors.email}</span> : null}</span>
            <input
              type="email"
              className="min-h-11 rounded-md bg-surface-muted px-3 text-base font-medium text-text-primary shadow-subtle outline-none focus-visible:shadow-focus"
              value={draft.email}
              disabled={isCreating}
              onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-text-secondary">
            <span>Role {errors.roleName ? <span className="text-status-danger">— {errors.roleName}</span> : null}</span>
            <select
              className="min-h-11 rounded-md bg-surface-muted px-3 text-base font-medium text-text-primary shadow-subtle outline-none focus-visible:shadow-focus"
              value={draft.roleName}
              disabled={isCreating}
              onChange={(event) =>
                setDraft((current) => ({ ...current, roleName: event.target.value as typeof current.roleName }))
              }
            >
              <option value="">Choose a role…</option>
              {MANAGER_INVITABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-text-secondary">
            <span>First name (optional)</span>
            <input
              className="min-h-11 rounded-md bg-surface-muted px-3 text-base font-medium text-text-primary shadow-subtle outline-none focus-visible:shadow-focus"
              value={draft.firstName}
              disabled={isCreating}
              onChange={(event) => setDraft((current) => ({ ...current, firstName: event.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-text-secondary">
            <span>Last name (optional)</span>
            <input
              className="min-h-11 rounded-md bg-surface-muted px-3 text-base font-medium text-text-primary shadow-subtle outline-none focus-visible:shadow-focus"
              value={draft.lastName}
              disabled={isCreating}
              onChange={(event) => setDraft((current) => ({ ...current, lastName: event.target.value }))}
            />
          </label>
        </div>

        {createErrorMessage ? (
          <p role="alert" className="mt-3 rounded-md bg-status-danger-surface px-3 py-2 text-sm font-semibold text-status-danger">
            {createErrorMessage}
          </p>
        ) : null}

        <div className="mt-4">
          <Button
            variant="primary"
            disabled={isCreating || Object.keys(errors).length > 0}
            onClick={() => {
              if (Object.keys(errors).length > 0 || !draft.roleName) return;
              create({
                email: draft.email.trim(),
                roleName: draft.roleName,
                firstName: draft.firstName.trim() || undefined,
                lastName: draft.lastName.trim() || undefined,
              });
              setDraft(emptyManagerInvitationDraft());
            }}
          >
            {isCreating ? "Sending…" : "Send invitation"}
          </Button>
        </div>
      </Card>

      <Card className="min-w-0">
        <h2 className="text-lg font-bold text-text-primary">All invitations</h2>
        {listQuery.isLoading ? (
          <div className="mt-4">
            <LoadingState title="Loading invitations" />
          </div>
        ) : listQuery.isError ? (
          <div className="mt-4">
            <ErrorState title="Could not load invitations" />
          </div>
        ) : (listQuery.data || []).length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No invitations yet" description="Send the first one above." />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  <th className="pb-2 pr-4">Invitee</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Expires</th>
                  <th className="pb-2 pr-4">Resent</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(listQuery.data || []).map((row) => (
                  <tr key={row.id} className="border-t border-border-subtle" data-manager-invitation-row={row.id}>
                    <td className="py-2 pr-4">
                      <div className="font-semibold text-text-primary">{managerInvitationDisplayName(row)}</div>
                      <div className="text-xs text-text-muted">{row.email}</div>
                    </td>
                    <td className="py-2 pr-4">
                      <Badge variant={managerInvitationStatusTone(row.status)}>
                        {titleCaseManagerStatus(row.status)}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4 text-text-secondary">{formatDate(row.expiresAt)}</td>
                    <td className="py-2 pr-4 tabular-nums text-text-secondary">{row.resendCount}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          disabled={!canResendManagerInvitation(row.status) || (isResending && resendId === row.id)}
                          onClick={() => resend(row.id)}
                        >
                          {isResending && resendId === row.id ? "Resending…" : "Resend"}
                        </Button>
                        <Button
                          variant="danger"
                          disabled={!canRevokeManagerInvitation(row.status)}
                          onClick={() =>
                            setPendingRevoke({ id: row.id, displayName: managerInvitationDisplayName(row) })
                          }
                        >
                          Revoke
                        </Button>
                      </div>
                      {resendId === row.id && resendErrorMessage ? (
                        <p role="alert" className="mt-1 text-xs font-semibold text-status-danger">
                          {resendErrorMessage}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ActionConfirmDialog
        open={Boolean(pendingRevoke)}
        title={pendingRevoke ? `Revoke the invitation for ${pendingRevoke.displayName}?` : ""}
        tone="danger"
        confirmLabel="Revoke invitation"
        error={revokeId === pendingRevoke?.id ? revokeErrorMessage : null}
        pending={isRevoking && revokeId === pendingRevoke?.id}
        consequence={
          pendingRevoke
            ? `${pendingRevoke.displayName} will no longer be able to accept this invitation. If they already have a temporary password, this does not revoke it — see Credentials documentation.`
            : ""
        }
        reason={{
          label: "Reason (optional)",
          placeholder: "Recorded on the invitation for the audit trail.",
          value: revokeReason,
          onChange: setRevokeReason,
        }}
        onCancel={() => {
          setPendingRevoke(null);
          setRevokeReason("");
        }}
        onConfirm={() => {
          if (!pendingRevoke) return;
          revoke({ invitationId: pendingRevoke.id, reason: revokeReason || undefined });
          setPendingRevoke(null);
          setRevokeReason("");
        }}
      />
    </ManagerContentShell>
  );
}
