import { useState } from "react";

import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { Button } from "@/components/ui";
import { useManagerEmployeeStatus, useManagerStaffErrorMessage } from "@/lib/manager/staff-context";
import {
  managerEmployeeStatusActions,
  managerEmployeeStatusConsequence,
  type ManagerEmployeeStatusAction as StatusAction,
} from "@/lib/manager/staff-model";
import type { ManagerEmployeeRow } from "@/lib/manager/staff-types";

/**
 * Change an employee's HR status (Track B6) — Suspend / Reactivate / Offboard.
 *
 * Every action is confirmed first, naming the person by name (standing rule for
 * destructive/irreversible staff actions), and the confirm copy states plainly
 * what this does and does NOT do — see `managerEmployeeStatusConsequence` and
 * `docs/manager-settings-docs/STAFF_LIFECYCLE.md` §5: `Employee.status` has no
 * cascade to login, sessions, PIN, or open orders/shifts on this backend, and
 * `TERMINATED → ACTIVE` is not actually a terminal transition (200, no guard) —
 * so "Offboard" is never described as irreversible, because it is not.
 */
type ManagerEmployeeStatusActionProps = {
  employee: ManagerEmployeeRow;
};

export function ManagerEmployeeStatusAction({ employee }: ManagerEmployeeStatusActionProps) {
  const { error, lastEmployeeId, resetError, run } = useManagerEmployeeStatus();
  const [pendingAction, setPendingAction] = useState<StatusAction | null>(null);
  const errorMessage = useManagerStaffErrorMessage(lastEmployeeId === employee.id ? error : null);

  const actions = managerEmployeeStatusActions(employee.status);

  return (
    <div className="mt-5" data-manager-employee-status-actions>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.key}
            variant={action.tone === "danger" ? "danger" : action.tone === "success" ? "primary" : "secondary"}
            onClick={() => {
              resetError();
              setPendingAction(action);
            }}
          >
            {action.label}
          </Button>
        ))}
      </div>

      {errorMessage ? (
        <p role="alert" className="mt-3 rounded-md bg-status-danger-surface px-3 py-2 text-sm font-semibold text-status-danger">
          {errorMessage}
        </p>
      ) : null}

      <ActionConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction ? `${pendingAction.label} ${employee.displayName}?` : ""}
        consequence={
          pendingAction
            ? managerEmployeeStatusConsequence(pendingAction.key, employee.displayName, Boolean(employee.userId))
            : ""
        }
        tone={pendingAction?.tone === "success" ? "info" : pendingAction?.tone}
        confirmLabel={pendingAction?.label || "Confirm"}
        onCancel={() => {
          resetError();
          setPendingAction(null);
        }}
        onConfirm={() => {
          if (!pendingAction) return;
          run(employee.id, pendingAction.key);
          setPendingAction(null);
        }}
      />
    </div>
  );
}
