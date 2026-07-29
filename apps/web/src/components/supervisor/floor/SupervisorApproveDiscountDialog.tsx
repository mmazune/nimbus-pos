import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { useToast } from "@/components/providers/ToastProvider";
import { approveDiscountErrorCopy, computeDiscountPreview } from "@/lib/supervisor/order-financials";
import {
  approveSupervisorDiscount,
  formatSupervisorMoney,
  getSupervisorOrderLabel,
  getSupervisorUserName,
  type SupervisorDiscount,
  type SupervisorDiscountType,
  type SupervisorOrderDetail,
} from "@/lib/supervisor/orders";

type SupervisorApproveDiscountDialogProps = {
  order: SupervisorOrderDetail;
  discount: SupervisorDiscount;
  token: string;
  branchId: string;
  tableLabel?: string | null;
  currentUserId?: string | null;
  onClose: () => void;
  onCompleted: () => void;
};

function invalidateDiscountDomain(
  queryClient: ReturnType<typeof useQueryClient>,
  branchId: string,
  orderId: string,
  discountId: string,
  totalsChanged: boolean,
) {
  void queryClient.invalidateQueries({ queryKey: ["supervisor", "order-discounts", branchId, orderId] });
  void queryClient.invalidateQueries({ queryKey: ["supervisor", "approvals", "discounts", branchId] });
  void queryClient.invalidateQueries({ queryKey: ["supervisor", "approval-detail", "discount", branchId, discountId] });
  if (totalsChanged) {
    void queryClient.invalidateQueries({ queryKey: ["supervisor", "order-detail", branchId, orderId] });
    void queryClient.invalidateQueries({ queryKey: ["supervisor", "floor", branchId] });
  }
}

export function SupervisorApproveDiscountDialog({
  branchId,
  currentUserId,
  discount,
  onClose,
  onCompleted,
  order,
  tableLabel,
  token,
}: SupervisorApproveDiscountDialogProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const isSelfRequested = Boolean(currentUserId && discount.createdBy?.id === currentUserId);
  const preview = computeDiscountPreview(
    (discount.type as SupervisorDiscountType) || "FIXED",
    discount.value ?? 0,
    order.subtotal ?? order.total ?? 0,
  );
  const valueLabel =
    discount.type === "PERCENTAGE" ? `${Number(discount.value ?? 0)}%` : formatSupervisorMoney(discount.value);

  const mutation = useMutation({
    // managerPin is optional and NOT required by the backend, so we never collect it here.
    mutationFn: () => approveSupervisorDiscount(token, branchId, discount.id),
    onSuccess: () => {
      // Approval recalcs order totals — re-fetch order + discounts for canonical values
      // (the response is the bare discount, no totals). Discount domain only.
      invalidateDiscountDomain(queryClient, branchId, order.id, discount.id, true);
      showToast({
        tone: "success",
        title: "Discount approved",
        description: `${getSupervisorOrderLabel(order)} discount was approved.`,
      });
      onCompleted();
    },
    onError: (error) => {
      showToast({ tone: "danger", title: "Could not approve discount", description: approveDiscountErrorCopy(error) });
    },
  });

  return (
    <ActionConfirmDialog
      open
      size="lg"
      tone="warning"
      title="Approve discount request"
      consequence="Approving applies this discount to the order and reduces the payable total. It does not collect payment or close the order. The final total is confirmed by the backend."
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
          {discount.reason ? <p className="text-text-muted">Reason: {discount.reason}</p> : null}
        </div>
      }
      pending={mutation.isPending}
      confirmLabel="Approve discount"
      error={mutation.isError ? approveDiscountErrorCopy(mutation.error) : null}
      onCancel={() => {
        if (mutation.isPending) return;
        onClose();
      }}
      onConfirm={() => mutation.mutate()}
    >
      <div className="grid gap-3">
        {isSelfRequested ? (
          <p className="rounded-md bg-status-warning-surface px-3 py-2 text-sm font-semibold text-status-warning">
            You requested this discount. Approving your own request is permitted but recorded in the audit trail.
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md bg-surface-muted p-3">
            <p className="text-xs font-semibold uppercase tracking-normal text-text-muted">Subtotal</p>
            <p className="mt-1 text-base font-bold tabular-nums text-text-primary">{formatSupervisorMoney(order.subtotal)}</p>
          </div>
          <div className="rounded-md bg-surface-muted p-3">
            <p className="text-xs font-semibold uppercase tracking-normal text-text-muted">Current total</p>
            <p className="mt-1 text-base font-bold tabular-nums text-text-primary">{formatSupervisorMoney(order.total)}</p>
          </div>
          <div className="rounded-md bg-status-info-surface p-3">
            <p className="text-xs font-semibold uppercase tracking-normal text-text-muted">Est. after approval</p>
            <p className="mt-1 text-base font-bold tabular-nums text-text-primary">
              {preview ? formatSupervisorMoney(preview.newTotal) : "—"}
            </p>
          </div>
        </div>
        <p className="text-sm text-text-muted">
          Estimated impact: −{preview ? formatSupervisorMoney(preview.discountAmount) : formatSupervisorMoney(0)} (confirmed after submit).
        </p>
      </div>
    </ActionConfirmDialog>
  );
}
