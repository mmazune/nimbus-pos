import { useState } from "react";

import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { Badge, Button, StatusMessage } from "@/components/ui";
import {
  formatSupervisorApprovalDate,
  getSupervisorApprovalStatusLabel,
  getSupervisorApprovalStatusTone,
  getSupervisorEmployeeName,
  getSupervisorUserName,
  type SupervisorShiftSwap,
} from "@/lib/supervisor/approvals";
import { mapApprovalErrorToMessage } from "@/lib/supervisor/approvals-contract";
import { decisionErrorStatus } from "@/lib/supervisor/approvals-workspace";

import { DetailRow, DetailSection } from "./detail-primitives";

/**
 * Shift-swap detail — Prompt 5B2 **Outcome C**. Approving a shift swap would require an atomic
 * roster reassignment, but the runtime has no roster-mutation service and the request references
 * only a date (not a specific ScheduleAssignment), so a truthful roster effect is not supported.
 * Therefore **no Approve control is exposed**. **Reject is truthful and safe** (sets REJECTED +
 * audit, changes no schedule) and is offered for PENDING requests. Terminal records are read-only.
 */
export function ApprovalShiftSwapDetail({
  swap,
  canDecide,
  onReject,
}: {
  swap: SupervisorShiftSwap;
  canDecide: boolean;
  onReject: (reviewNotes?: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = (swap.status || "PENDING").toUpperCase();
  const isPending = status === "PENDING";
  const requester = getSupervisorEmployeeName(swap.requester);
  const target = getSupervisorEmployeeName(swap.target);

  function close() {
    setOpen(false);
    setNotes("");
    setError(null);
    setPending(false);
  }

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await onReject(notes || undefined);
      close();
    } catch (e) {
      setError(mapApprovalErrorToMessage(decisionErrorStatus(e)));
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Badge variant={getSupervisorApprovalStatusTone(status)}>{getSupervisorApprovalStatusLabel(status)}</Badge>
      </div>

      <DetailSection title="Shift swap">
        <DetailRow label="Requesting employee">{requester}</DetailRow>
        <DetailRow label="Target employee">{target}</DetailRow>
        <DetailRow label="Shift date">{formatSupervisorApprovalDate(swap.shiftDate)}</DetailRow>
        <DetailRow label="Reason">{swap.reason?.trim() || "No reason provided"}</DetailRow>
        <DetailRow label="Requested at">{formatSupervisorApprovalDate(swap.createdAt)}</DetailRow>
      </DetailSection>

      {status !== "PENDING" ? (
        <DetailSection title="Decision">
          <DetailRow label="Status">{getSupervisorApprovalStatusLabel(status)}</DetailRow>
          {swap.approvedBy ? <DetailRow label="Reviewed by">{getSupervisorUserName(swap.approvedBy)}</DetailRow> : null}
          {swap.approvedAt ? <DetailRow label="Reviewed at">{formatSupervisorApprovalDate(swap.approvedAt)}</DetailRow> : null}
          {swap.reviewNotes ? <DetailRow label="Reviewer notes">{swap.reviewNotes}</DetailRow> : null}
        </DetailSection>
      ) : null}

      {isPending ? (
        <>
          <StatusMessage tone="info" title="Approval isn’t available here">
            This request can’t be completed from Approvals because schedule reassignment is not supported.
            Rejecting records the decision and does not change any schedule.
          </StatusMessage>
          {canDecide ? (
            <Button variant="danger" size="pos" onClick={() => { setError(null); setOpen(true); }}>
              Reject request
            </Button>
          ) : (
            <StatusMessage tone="info" title="Read-only">
              You do not have permission to decide shift swaps.
            </StatusMessage>
          )}
        </>
      ) : null}

      <ActionConfirmDialog
        open={open}
        title="Reject shift swap"
        tone="danger"
        consequence="Rejecting records the decision. No schedule or shift assignment is changed."
        confirmLabel="Reject request"
        pending={pending}
        error={error}
        reason={{ label: "Reviewer notes (optional)", placeholder: "Explain the rejection", value: notes, onChange: setNotes, required: false }}
        onCancel={close}
        onConfirm={confirm}
      >
        <p className="text-sm text-text-secondary">
          {requester} → {target} · {formatSupervisorApprovalDate(swap.shiftDate)}
        </p>
      </ActionConfirmDialog>
    </div>
  );
}
