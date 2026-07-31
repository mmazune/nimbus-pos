import { useState } from "react";

import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { Badge, Button, Skeleton, StatusMessage } from "@/components/ui";
import {
  approveDiscountErrorCopy,
  computeDiscountPreview,
  rejectDiscountErrorCopy,
} from "@/lib/supervisor/order-financials";
import {
  formatSupervisorApprovalDate,
  formatSupervisorApprovalMoney,
  getSupervisorApprovalStatusLabel,
  getSupervisorUserName,
  type SupervisorPendingDiscount,
} from "@/lib/supervisor/approvals";
import type { SupervisorDiscountType } from "@/lib/supervisor/orders";
import {
  getPaymentState,
  getPaymentStateLabel,
  getPaymentStateTone,
  type SupervisorOrderPayments,
} from "@/lib/supervisor/orders";
import type { ApprovalQueueItem } from "@/lib/supervisor/approvals-workspace";

import { DetailRow, DetailSection } from "./detail-primitives";

type Props = {
  item: ApprovalQueueItem;
  detail: SupervisorPendingDiscount | undefined;
  detailLoading: boolean;
  detailError: string | null;
  payments: SupervisorOrderPayments | null | undefined;
  paymentsLoading: boolean;
  currentUserId: string | null;
  canDecide: boolean;
  onApprove: (managerPin?: string) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  onRetry: () => void;
};

export function ApprovalDiscountDetail({
  item,
  detail,
  detailLoading,
  detailError,
  payments,
  paymentsLoading,
  currentUserId,
  canDecide,
  onApprove,
  onReject,
  onRetry,
}: Props) {
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null);
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (detailLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (detailError || !detail) {
    return (
      <StatusMessage tone="warning" title="Discount detail unavailable">
        {detailError || "This discount could not be loaded."}{" "}
        <button type="button" className="font-semibold underline" onClick={onRetry}>
          Retry
        </button>
      </StatusMessage>
    );
  }

  const status = (detail.status || "PENDING").toUpperCase();
  const isPending = status === "PENDING";
  const requester = getSupervisorUserName(detail.createdBy);
  const isSelfRequested = Boolean(currentUserId && detail.createdBy?.id === currentUserId);
  const subtotal = detail.order?.subtotal ?? null;
  const preview = detail.type
    ? computeDiscountPreview(detail.type as SupervisorDiscountType, Number(detail.value ?? 0), subtotal)
    : null;
  const paymentState = getPaymentState(payments ?? null);
  // UI-only safety boundary (documented): block approve when captured money exists.
  const hasMoney = ["settled", "partially-paid", "refunded"].includes(paymentState);
  const approveBlockedByMoney = hasMoney;

  function close() {
    setDialog(null);
    setPin("");
    setReason("");
    setError(null);
    setPending(false);
  }

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      if (dialog === "approve") await onApprove(pin || undefined);
      else if (dialog === "reject") await onReject(reason);
      close();
    } catch (e) {
      setError(dialog === "approve" ? approveDiscountErrorCopy(e) : rejectDiscountErrorCopy(e));
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Badge variant={item.statusTone}>{getSupervisorApprovalStatusLabel(status)}</Badge>
        {paymentsLoading ? null : (
          <Badge variant={getPaymentStateTone(paymentState)}>{getPaymentStateLabel(paymentState)}</Badge>
        )}
      </div>

      <DetailSection title="Request">
        <DetailRow label="Requested by">{requester}</DetailRow>
        <DetailRow label="Order">{detail.order?.orderNumber || detail.orderId || "—"}</DetailRow>
        <DetailRow label="Type">{detail.type ? getSupervisorApprovalStatusLabel(detail.type) : "—"}</DetailRow>
        <DetailRow label="Requested value">
          {detail.type === "PERCENTAGE" ? `${detail.value ?? "—"}%` : formatSupervisorApprovalMoney(detail.value)}
        </DetailRow>
        <DetailRow label="Reason">{detail.reason?.trim() || "No reason provided"}</DetailRow>
        <DetailRow label="Requested at">{formatSupervisorApprovalDate(detail.createdAt)}</DetailRow>
      </DetailSection>

      <DetailSection title="Current order financials">
        <DetailRow label="Subtotal">{formatSupervisorApprovalMoney(subtotal)}</DetailRow>
        <DetailRow label="Current total">{formatSupervisorApprovalMoney(detail.order?.total)}</DetailRow>
        {preview ? (
          <>
            <DetailRow label="Estimated discount">−{formatSupervisorApprovalMoney(preview.discountAmount)}</DetailRow>
            <DetailRow label="Estimated new total">{formatSupervisorApprovalMoney(preview.newTotal)}</DetailRow>
          </>
        ) : null}
      </DetailSection>
      <p className="text-xs text-text-muted">
        Estimated figures are a preview only. The order remains the source of truth for final totals.
      </p>

      {!isPending ? (
        <DetailSection title="Decision">
          <DetailRow label="Status">{getSupervisorApprovalStatusLabel(status)}</DetailRow>
          {detail.approvedBy ? <DetailRow label="Approved by">{getSupervisorUserName(detail.approvedBy)}</DetailRow> : null}
          {detail.rejectedBy ? <DetailRow label="Rejected by">{getSupervisorUserName(detail.rejectedBy)}</DetailRow> : null}
          {detail.rejectionReason ? <DetailRow label="Reviewer notes">{detail.rejectionReason}</DetailRow> : null}
        </DetailSection>
      ) : null}

      {isPending && canDecide ? (
        <div className="space-y-3">
          {isSelfRequested ? (
            <StatusMessage tone="info" title="You requested this discount">
              Approving your own request is permitted but recorded in the audit trail.
            </StatusMessage>
          ) : null}
          {approveBlockedByMoney ? (
            <StatusMessage tone="warning" title="Payment already recorded">
              This order has captured payment, so the discount can’t be approved here. Reject remains available.
            </StatusMessage>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="pos"
              disabled={approveBlockedByMoney}
              onClick={() => {
                setError(null);
                setDialog("approve");
              }}
            >
              Approve discount
            </Button>
            <Button
              variant="danger"
              size="pos"
              onClick={() => {
                setError(null);
                setDialog("reject");
              }}
            >
              Reject
            </Button>
          </div>
        </div>
      ) : null}

      {isPending && !canDecide ? (
        <StatusMessage tone="info" title="Read-only">
          You do not have permission to decide discounts.
        </StatusMessage>
      ) : null}

      <ActionConfirmDialog
        open={dialog === "approve"}
        title="Approve discount"
        tone="warning"
        consequence="Approving recalculates the order total to reflect this discount."
        confirmLabel="Approve discount"
        pending={pending}
        error={error}
        managerPin={{
          label: "Manager PIN (optional)",
          placeholder: "Enter PIN if your policy requires it",
          value: pin,
          onChange: setPin,
          required: false,
        }}
        onCancel={close}
        onConfirm={confirm}
      >
        <p className="text-sm text-text-secondary">
          {requester} requested a {detail.type === "PERCENTAGE" ? `${detail.value}%` : formatSupervisorApprovalMoney(detail.value)} discount.
          {preview ? ` Estimated new total ${formatSupervisorApprovalMoney(preview.newTotal)}.` : ""}
        </p>
      </ActionConfirmDialog>

      <ActionConfirmDialog
        open={dialog === "reject"}
        title="Reject discount"
        tone="danger"
        consequence="Rejecting leaves the order total unchanged."
        confirmLabel="Reject discount"
        pending={pending}
        error={error}
        reason={{
          label: "Rejection reason",
          placeholder: "Explain why this discount is rejected",
          value: reason,
          onChange: setReason,
          required: true,
        }}
        onCancel={close}
        onConfirm={confirm}
      />
    </div>
  );
}
