import { useEffect, useState } from "react";

import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { Badge, Button } from "@/components/ui";
import {
  useManagerCredentialReset,
  useManagerStaffErrorMessage,
} from "@/lib/manager/staff-context";
import type { ManagerEmployeeRow } from "@/lib/manager/staff-types";

/**
 * Credential (password) reset — Track B6.7.
 * See docs/manager-settings-docs/CREDENTIAL_RESET.md for the full design.
 *
 * Token-based only: this control sends the staff member a one-time reset
 * token and they set their own new password. The Manager triggering it never
 * sees, chooses, or transmits a credential — there is no code path here that
 * could render one. This is deliberately NOT `ManagerOneTimeSecretPanel`
 * (which exists for PINs/temp passwords the Manager DOES relay out-of-band) —
 * that pattern was considered for this feature and rejected by the owner.
 *
 * Only rendered for accounts with real password login. `employee.userId`
 * being present is a precondition (mirrors the Quick-PIN link's own guard
 * above this component); PIN-only accounts are detected by the status read
 * itself 400ing (`eligible: false`), never by re-deriving the backend's
 * synthetic-email convention on the frontend.
 */
type ManagerCredentialResetActionProps = {
  employee: ManagerEmployeeRow;
};

function formatExpiry(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function ManagerCredentialResetAction({ employee }: ManagerCredentialResetActionProps) {
  const employeeId = employee.userId ? employee.id : null;
  const {
    statusQuery,
    trigger,
    isTriggering,
    triggerError,
    isTriggerSuccess,
    resetTriggerError,
  } = useManagerCredentialReset(employeeId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const errorMessage = useManagerStaffErrorMessage(triggerError);

  useEffect(() => {
    setConfirmOpen(false);
    resetTriggerError();
    // Only on employee change — resetTriggerError is stable per hook instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee.id]);

  useEffect(() => {
    if (isTriggerSuccess) setConfirmOpen(false);
  }, [isTriggerSuccess]);

  if (!employeeId) return null;

  const status = statusQuery.data;
  const isLoadingStatus = statusQuery.isLoading;
  const isEligible = status ? status.eligible : true;

  if (!isLoadingStatus && status && !isEligible) {
    return (
      <div className="mt-4" data-manager-credential-reset-ineligible>
        <p className="text-xs leading-5 text-text-muted">
          {employee.displayName} has no password login (PIN-only account) — use Quick-PIN reset
          instead.
        </p>
      </div>
    );
  }

  const pending = Boolean(status?.pending);
  const label = pending ? "Send a new reset" : "Reset credential";

  return (
    <div className="mt-4" data-manager-credential-reset-action>
      {pending ? (
        <p className="mb-2 flex flex-wrap items-center gap-2 text-xs leading-5 text-text-secondary">
          <Badge variant="warning">Reset pending</Badge>
          {status?.expiresAt
            ? `Expires ${formatExpiry(status.expiresAt)} — sending a new one cancels this one.`
            : null}
        </p>
      ) : null}

      {isTriggerSuccess && !confirmOpen && status?.expiresAt ? (
        <p
          role="status"
          className="mb-2 rounded-md bg-status-success-surface px-3 py-2 text-xs leading-5 text-text-secondary"
        >
          Reset sent — {employee.displayName} can set a new password. It expires at{" "}
          {formatExpiry(status.expiresAt)}.
        </p>
      ) : null}

      <Button
        variant="secondary"
        disabled={isLoadingStatus}
        onClick={() => {
          resetTriggerError();
          setConfirmOpen(true);
        }}
      >
        {label}
      </Button>

      {errorMessage && !confirmOpen ? (
        <p
          role="alert"
          className="mt-3 rounded-md bg-status-danger-surface px-3 py-2 text-sm font-semibold text-status-danger"
        >
          {errorMessage}
        </p>
      ) : null}

      <ActionConfirmDialog
        open={confirmOpen}
        title={`${label} for ${employee.displayName}?`}
        consequence={`${employee.displayName} will get a one-time link to set a new password — you will not see or send it yourself. Their current session ends immediately. Their old password keeps working until they finish the reset; if you need to lock them out right now too, use Suspend as well.`}
        tone="warning"
        confirmLabel={label}
        pending={isTriggering}
        error={errorMessage}
        onCancel={() => {
          resetTriggerError();
          setConfirmOpen(false);
        }}
        onConfirm={() => {
          trigger();
        }}
      />
    </div>
  );
}
