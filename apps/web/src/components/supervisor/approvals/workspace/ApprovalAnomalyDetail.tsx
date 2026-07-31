import { useState } from "react";

import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { Badge, Button, Skeleton, StatusMessage } from "@/components/ui";
import {
  formatSupervisorApprovalDate,
  getSupervisorApprovalSeverity,
  getSupervisorApprovalSeverityLabel,
  getSupervisorApprovalSeverityTone,
  getSupervisorApprovalStatusLabel,
  getSupervisorApprovalStatusTone,
  getSupervisorUserName,
  type SupervisorAnomaly,
} from "@/lib/supervisor/approvals";
import { mapApprovalErrorToMessage } from "@/lib/supervisor/approvals-contract";
import { decisionErrorStatus } from "@/lib/supervisor/approvals-workspace";

import { DetailRow, DetailSection } from "./detail-primitives";

/**
 * Anomaly detail — Prompt 5B2. Acknowledge (OPEN → ACKNOWLEDGED, note optional) keeps the row in
 * Needs action; Resolve (ACKNOWLEDGED → RESOLVED, note REQUIRED) moves it to History. Both preserve
 * the original evidence and do NOT mutate the underlying order/till/payment/attendance record.
 */
export function ApprovalAnomalyDetail({
  detail,
  fallback,
  loading,
  error,
  canDecide,
  onAcknowledge,
  onResolve,
  onRetry,
}: {
  detail: SupervisorAnomaly | undefined;
  fallback: SupervisorAnomaly;
  loading: boolean;
  error: string | null;
  canDecide: boolean;
  onAcknowledge: (notes?: string) => Promise<void>;
  onResolve: (notes: string) => Promise<void>;
  onRetry: () => void;
}) {
  const [dialog, setDialog] = useState<"acknowledge" | "resolve" | null>(null);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading && !detail) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const a = detail || fallback;
  if (error && !detail) {
    return (
      <StatusMessage tone="warning" title="Anomaly detail unavailable">
        {error}{" "}
        <button type="button" className="font-semibold underline" onClick={onRetry}>
          Retry
        </button>
      </StatusMessage>
    );
  }

  const status = (a.status || "OPEN").toUpperCase();
  const severity = getSupervisorApprovalSeverity(a.severity);
  const typeLabel = a.rule?.name || (a.type ? getSupervisorApprovalStatusLabel(a.type) : "Anomaly");
  const canAcknowledge = status === "OPEN";
  const canResolve = status === "ACKNOWLEDGED";

  function close() {
    setDialog(null);
    setNotes("");
    setActionError(null);
    setPending(false);
  }

  async function confirm() {
    setPending(true);
    setActionError(null);
    try {
      if (dialog === "acknowledge") await onAcknowledge(notes || undefined);
      else if (dialog === "resolve") await onResolve(notes);
      close();
    } catch (e) {
      setActionError(mapApprovalErrorToMessage(decisionErrorStatus(e)));
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Badge variant={getSupervisorApprovalStatusTone(status)}>{getSupervisorApprovalStatusLabel(status)}</Badge>
        <Badge variant={getSupervisorApprovalSeverityTone(severity)}>{getSupervisorApprovalSeverityLabel(severity)}</Badge>
      </div>

      <DetailSection title="Anomaly">
        <DetailRow label="Type">{typeLabel}</DetailRow>
        {a.entityType ? <DetailRow label="Affected">{getSupervisorApprovalStatusLabel(a.entityType)}</DetailRow> : null}
        <DetailRow label="Actor">{getSupervisorUserName(a.actorUser)}</DetailRow>
        <DetailRow label="Opened">{formatSupervisorApprovalDate(a.createdAt)}</DetailRow>
        {a.description ? <DetailRow label="Summary">{a.description}</DetailRow> : null}
      </DetailSection>

      {status !== "OPEN" ? (
        <DetailSection title="Handling">
          <DetailRow label="Status">{getSupervisorApprovalStatusLabel(status)}</DetailRow>
          {a.acknowledgedBy ? <DetailRow label="Handled by">{getSupervisorUserName(a.acknowledgedBy)}</DetailRow> : null}
          {a.acknowledgedAt ? <DetailRow label="Handled at">{formatSupervisorApprovalDate(a.acknowledgedAt)}</DetailRow> : null}
          {a.resolutionNotes ? <DetailRow label="Notes">{a.resolutionNotes}</DetailRow> : null}
        </DetailSection>
      ) : null}

      {(canAcknowledge || canResolve) && canDecide ? (
        <div className="flex flex-wrap gap-2">
          {canAcknowledge ? (
            <Button variant="primary" size="pos" onClick={() => { setActionError(null); setDialog("acknowledge"); }}>
              Acknowledge
            </Button>
          ) : null}
          {canResolve ? (
            <Button variant="primary" size="pos" onClick={() => { setActionError(null); setDialog("resolve"); }}>
              Resolve
            </Button>
          ) : null}
        </div>
      ) : null}

      {(canAcknowledge || canResolve) && !canDecide ? (
        <StatusMessage tone="info" title="Read-only">
          You do not have permission to action anomalies.
        </StatusMessage>
      ) : null}

      <ActionConfirmDialog
        open={dialog === "acknowledge"}
        title="Acknowledge anomaly"
        tone="warning"
        consequence="Acknowledging records that you are handling this anomaly. It stays actionable until resolved and the original evidence is preserved."
        confirmLabel="Acknowledge"
        pending={pending}
        error={actionError}
        reason={{ label: "Note (optional)", placeholder: "Add a handling note", value: notes, onChange: setNotes, required: false }}
        onCancel={close}
        onConfirm={confirm}
      />

      <ActionConfirmDialog
        open={dialog === "resolve"}
        title="Resolve anomaly"
        tone="warning"
        consequence="Resolving marks this anomaly resolved. The original evidence is preserved; the underlying order, till, payment, attendance or shift record is not changed by this action."
        confirmLabel="Resolve"
        pending={pending}
        error={actionError}
        reason={{ label: "Resolution note", placeholder: "Describe how this was resolved", value: notes, onChange: setNotes, required: true }}
        onCancel={close}
        onConfirm={confirm}
      />
    </div>
  );
}
