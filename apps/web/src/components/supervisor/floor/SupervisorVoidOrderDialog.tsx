import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { useToast } from "@/components/providers/ToastProvider";
import type { SupervisorFloorData } from "@/lib/supervisor/floor";
import { validateAdjustmentReason, voidOrderErrorCopy } from "@/lib/supervisor/order-financials";
import {
  formatSupervisorMoney,
  getSupervisorOrderLabel,
  getSupervisorOrderStatusLabel,
  voidSupervisorOrder,
  type SupervisorOrderDetail,
} from "@/lib/supervisor/orders";

type SupervisorVoidOrderDialogProps = {
  order: SupervisorOrderDetail;
  token: string;
  branchId: string;
  tableLabel?: string | null;
  paymentStateLabel: string;
  onClose: () => void;
  onCompleted: (params: { orderId: string }) => void;
};

export function SupervisorVoidOrderDialog({
  branchId,
  onClose,
  onCompleted,
  order,
  paymentStateLabel,
  tableLabel,
  token,
}: SupervisorVoidOrderDialogProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [reason, setReason] = useState("");

  const reasonValid = validateAdjustmentReason(reason).valid;

  const mutation = useMutation({
    mutationFn: () => {
      const check = validateAdjustmentReason(reason);
      if (!check.valid) throw new Error(check.reason || "A reason is required.");
      return voidSupervisorOrder(token, branchId, order.id, reason);
    },
    onSuccess: (result) => {
      // Canonical: the returned bare order carries the real VOIDED status + totals.
      queryClient.setQueryData<SupervisorOrderDetail>(
        ["supervisor", "order-detail", branchId, order.id],
        (current) => (current ? { ...current, ...result, status: "VOIDED" } : current),
      );
      // A VOIDED order is terminal — drop it from the active-order set so the source
      // table frees; the backend auto-releases an idle DINE_IN table, confirmed on refetch.
      queryClient.setQueryData<SupervisorFloorData>(["supervisor", "floor", branchId], (current) =>
        current
          ? { ...current, activeOrders: current.activeOrders.filter((entry) => entry.id !== order.id) }
          : current,
      );
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "order-detail", branchId, order.id] });
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "floor", branchId] });
      void queryClient.invalidateQueries({ queryKey: ["waiter", "floor", branchId] });

      showToast({
        tone: "success",
        title: "Order voided",
        description: `${getSupervisorOrderLabel(order)} is now voided.`,
      });
      onCompleted({ orderId: order.id });
    },
    onError: (error) => {
      showToast({ tone: "danger", title: "Could not void order", description: voidOrderErrorCopy(error) });
    },
  });

  return (
    <ActionConfirmDialog
      open
      tone="danger"
      title="Void this active order"
      consequence="This moves the order to its VOIDED state and it can no longer be actioned here. It does NOT refund any payment, is not a complimentary adjustment, and is not a post-close void."
      context={
        <div className="grid gap-1">
          <p className="font-semibold text-text-primary">
            {getSupervisorOrderLabel(order)} • {getSupervisorOrderStatusLabel(order.status)}
          </p>
          <p>
            {order.serviceType === "TAKEAWAY" ? "Takeaway" : tableLabel || "Tableless"}
            {" • "}
            {order.items?.length ?? 0} items • {formatSupervisorMoney(order.total)}
          </p>
          <p className="text-text-muted">Payment: {paymentStateLabel} (read-only)</p>
        </div>
      }
      reason={{
        label: "Reason (required)",
        placeholder: "Why is this order being voided?",
        value: reason,
        onChange: setReason,
        required: true,
      }}
      pending={mutation.isPending}
      confirmDisabled={!reasonValid}
      confirmLabel="Void order"
      error={mutation.isError ? voidOrderErrorCopy(mutation.error) : null}
      onCancel={() => {
        if (mutation.isPending) return;
        onClose();
      }}
      onConfirm={() => mutation.mutate()}
    />
  );
}
