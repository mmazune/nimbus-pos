import { useState } from "react";

import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { Badge, Button, StatusMessage } from "@/components/ui";
import {
  formatSupervisorApprovalDate,
  getSupervisorApprovalStatusLabel,
  getSupervisorApprovalStatusTone,
  getSupervisorEmployeeName,
  getSupervisorUserName,
  type SupervisorLeaveRequest,
} from "@/lib/supervisor/approvals";
import { mapApprovalErrorToMessage } from "@/lib/supervisor/approvals-contract";
import { decisionErrorStatus } from "@/lib/supervisor/approvals-workspace";

import { DetailRow, DetailSection } from "./detail-primitives";

type Props = {
  leave: SupervisorLeaveRequest;
  canDecide: boolean;
  onApprove: (notes?: string) => Promise<void>;
  onReject: (notes?: string) => Promise<void>;
};

function durationDays(startsAt?: string | null, endsAt?: string | null): string {
  if (!startsAt || !endsAt) return "—";
  const a = new Date(startsAt).getTime();
  const b = new Date(endsAt).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return "—";
  const days = Math.floor((b - a) / 86_400_000) + 1;
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function ApprovalLeaveDetail({ leave, canDecide, onApprove, onReject }: Props) {
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = (leave.status || "PENDING").toUpperCase();
  const isPending = status === "PENDING";
  const employee = getSupervisorEmployeeName(leave.employee);
  const leaveType = leave.leaveType ? getSupervisorApprovalStatusLabel(leave.leaveType) : "—";

  function close() {
    setDialog(null);
    setNotes("");
    setError(null);
    setPending(false);
  }

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      if (dialog === "approve") await onApprove(notes || undefined);
      else if (dialog === "reject") await onReject(notes || undefined);
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

      <DetailSection title="Employee">
        <DetailRow label="Name">{employee}</DetailRow>
        {leave.requestedBy ? <DetailRow label="Requested by">{getSupervisorUserName(leave.requestedBy)}</DetailRow> : null}
      </DetailSection>

      <DetailSection title="Leave request">
        <DetailRow label="Type">{leaveType}</DetailRow>
        <DetailRow label="Starts">{formatSupervisorApprovalDate(leave.startsAt)}</DetailRow>
        <DetailRow label="Ends">{formatSupervisorApprovalDate(leave.endsAt)}</DetailRow>
        <DetailRow label="Duration">{durationDays(leave.startsAt, leave.endsAt)}</DetailRow>
        <DetailRow label="Reason">{leave.reason?.trim() || "No reason provided"}</DetailRow>
        <DetailRow label="Requested at">{formatSupervisorApprovalDate(leave.createdAt)}</DetailRow>
      </DetailSection>

      {!isPending ? (
        <DetailSection title="Decision">
          <DetailRow label="Status">{getSupervisorApprovalStatusLabel(status)}</DetailRow>
          {leave.reviewedBy ? <DetailRow label="Reviewed by">{getSupervisorUserName(leave.reviewedBy)}</DetailRow> : null}
          {leave.reviewedAt ? <DetailRow label="Reviewed at">{formatSupervisorApprovalDate(leave.reviewedAt)}</DetailRow> : null}
          {leave.reviewNotes ? <DetailRow label="Reviewer notes">{leave.reviewNotes}</DetailRow> : null}
        </DetailSection>
      ) : null}

      <p className="text-xs text-text-muted">
        Leave is reviewed at the organisation level. Approving or rejecting records the decision only — it does not
        adjust payroll or shift coverage.
      </p>

      {isPending && canDecide ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="pos" onClick={() => { setError(null); setDialog("approve"); }}>
            Approve leave
          </Button>
          <Button variant="danger" size="pos" onClick={() => { setError(null); setDialog("reject"); }}>
            Reject
          </Button>
        </div>
      ) : null}

      {isPending && !canDecide ? (
        <StatusMessage tone="info" title="Read-only">
          You do not have permission to review leave requests.
        </StatusMessage>
      ) : null}

      <ActionConfirmDialog
        open={dialog === "approve"}
        title="Approve leave request"
        tone="warning"
        consequence="Approving records this leave decision. It does not change payroll or the roster."
        confirmLabel="Approve leave"
        pending={pending}
        error={error}
        reason={{ label: "Reviewer notes (optional)", placeholder: "Add a note for the record", value: notes, onChange: setNotes, required: false }}
        onCancel={close}
        onConfirm={confirm}
      >
        <p className="text-sm text-text-secondary">
          {employee} · {leaveType} · {formatSupervisorApprovalDate(leave.startsAt)} → {formatSupervisorApprovalDate(leave.endsAt)}
        </p>
      </ActionConfirmDialog>

      <ActionConfirmDialog
        open={dialog === "reject"}
        title="Reject leave request"
        tone="danger"
        consequence="Rejecting records the decision. It does not change payroll or the roster."
        confirmLabel="Reject leave"
        pending={pending}
        error={error}
        reason={{ label: "Reviewer notes (optional)", placeholder: "Explain the rejection", value: notes, onChange: setNotes, required: false }}
        onCancel={close}
        onConfirm={confirm}
      />
    </div>
  );
}
