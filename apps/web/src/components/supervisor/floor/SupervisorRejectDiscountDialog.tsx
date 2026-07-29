import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { useToast } from "@/components/providers/ToastProvider";
import { rejectDiscountErrorCopy, validateAdjustmentReason } from "@/lib/supervisor/order-financials";
import {
  formatSupervisorMoney,
  getSupervisorOrderLabel,
  getSupervisorUserName,
  rejectSupervisorDiscount,
  type SupervisorDiscount,
  type SupervisorOrderDetail,
} from "@/lib/supervisor/orders";

type SupervisorRejectDiscountDialogProps = {
  order: SupervisorOrderDetail;
  discount: SupervisorDiscount;
  token: string;
  branchId: string;
  tableLabel?: string | null;
  onClose: () => void;
  onCompleted: () => void;
};

export function SupervisorRejectDiscountDialog({
  branchId,
  discount,
  onClose,
  onCompleted,
  order,
  tableLabel,
  token,
}: SupervisorRejectDiscountDialogProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [reason, setReason] = useState("");

  const reasonValid = validateAdjustmentReason(reason).valid;
  const valueLabel =
    discount.type === "PERCENTAGE" ? `${Number(discount.value ?? 0)}%` : formatSupervisorMoney(discount.value);

  const mutation = useMutation({
    mutationFn: () => {
      const check = validateAdjustmentReason(reason);
      if (!check.valid) throw new Error(check.reason || "A rejection reason is required.");
      return rejectSupervisorDiscount(token, branchId, discount.id, reason);
    },
    onSuccess: () => {
      // Rejection does NOT change order totals — refresh only the discount domain.
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "order-discounts", branchId, order.id] });
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "approvals", "discounts", branchId] });
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "approval-detail", "discount", branchId, discount.id] });
      showToast({
        tone: "success",
        title: "Discount rejected",
        description: `The discount on ${getSupervisorOrderLabel(order)} was not applied.`,
      });
      onCompleted();
    },
    onError: (error) => {
      showToast({ tone: "danger", title: "Could not reject discount", description: rejectDiscountErrorCopy(error) });
    },
  });

  return (
    <ActionConfirmDialog
      open
      tone="warning"
      title="Reject discount request"
      consequence="The requested discount will not be applied and the order total stays unchanged. This decision is recorded in the audit trail."
      context={
        <div className="grid gap-1">
          <p className="font-semibold text-text-primary">
            {getSupervisorOrderLabel(order)} • {order.serviceType === "TAKEAWAY" ? "Takeaway" : tableLabel || "Tableless"}
          </p>
          <p>
            {discount.type === "PERCENTAGE" ? "Percentage" : "Fixed"} • {valueLabel}
            {" • requested by "}
            {getSupervisorUserName(discount.createdBy)}
          </p>
          {discount.reason ? <p className="text-text-muted">Request reason: {discount.reason}</p> : null}
          <p className="text-text-muted">Order total (unchanged): {formatSupervisorMoney(order.total)}</p>
        </div>
      }
      reason={{
        label: "Rejection reason (required)",
        placeholder: "Why is this discount being rejected?",
        value: reason,
        onChange: setReason,
        required: true,
      }}
      pending={mutation.isPending}
      confirmDisabled={!reasonValid}
      confirmLabel="Reject discount"
      error={mutation.isError ? rejectDiscountErrorCopy(mutation.error) : null}
      onCancel={() => {
        if (mutation.isPending) return;
        onClose();
      }}
      onConfirm={() => mutation.mutate()}
    />
  );
}
