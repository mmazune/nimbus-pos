import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { useToast } from "@/components/providers/ToastProvider";
import { buildOperationalIdempotencyKey, useIdempotencyIntent } from "@/lib/pos-shell/idempotency";
import { buildItemSelections, validateLineSelections } from "@/lib/supervisor/order-action-forms";
import {
  getSupervisorOrderLabel,
  moveSupervisorItems,
  type SupervisorOrderDetail,
  type SupervisorOrderListItem,
} from "@/lib/supervisor/orders";

import { SupervisorLineSelector } from "./SupervisorLineSelector";
import { SupervisorOrderTargetSelector } from "./SupervisorOrderTargetSelector";

type SupervisorMoveItemsDialogProps = {
  order: SupervisorOrderDetail;
  token: string;
  branchId: string;
  tableLabel?: string | null;
  onClose: () => void;
};

export function SupervisorMoveItemsDialog({
  branchId,
  onClose,
  order,
  tableLabel,
  token,
}: SupervisorMoveItemsDialogProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const lines = useMemo(() => order.items ?? [], [order.items]);

  const [target, setTarget] = useState<SupervisorOrderListItem | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");

  const intent = useIdempotencyIntent(() =>
    buildOperationalIdempotencyKey({ operation: "supervisor:move-items", orderId: order.id }),
  );

  const selections = useMemo(() => buildItemSelections(quantities), [quantities]);
  const linesValid = validateLineSelections(selections, lines).valid;
  const isValid = Boolean(target && target.id !== order.id && linesValid);

  const mutation = useMutation({
    mutationFn: () => {
      if (!target) throw new Error("Select a target order");
      return moveSupervisorItems(
        token,
        branchId,
        order.id,
        { targetOrderId: target.id, items: selections, ...(reason.trim() ? { reason: reason.trim() } : {}) },
        intent.begin(),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "order-detail", branchId, order.id] });
      if (target) {
        void queryClient.invalidateQueries({ queryKey: ["supervisor", "order-detail", branchId, target.id] });
      }
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "floor", branchId] });
      void queryClient.invalidateQueries({ queryKey: ["waiter", "floor", branchId] });
      intent.reset();
      showToast({
        tone: "success",
        title: "Items moved",
        description: target ? `Selected items moved to ${getSupervisorOrderLabel(target)}.` : "Selected items moved.",
      });
      onClose();
    },
    onError: (error) => {
      showToast({
        tone: "danger",
        title: "Could not move items",
        description: error instanceof Error ? error.message : "Retry when the connection is stable.",
      });
    },
  });

  return (
    <ActionConfirmDialog
      open
      size="lg"
      tone="warning"
      title="Move items to another order"
      consequence="Moves the selected items from this order onto the chosen open target order in the same branch."
      context={
        <p>
          From {getSupervisorOrderLabel(order)}
          {tableLabel ? ` • ${tableLabel}` : ""}
        </p>
      }
      pending={mutation.isPending}
      confirmDisabled={!isValid}
      confirmLabel="Move items"
      reason={{
        label: "Reason (optional)",
        placeholder: "Optional note for the audit trail",
        value: reason,
        onChange: setReason,
      }}
      onCancel={() => {
        if (mutation.isPending) return;
        onClose();
      }}
      onConfirm={() => mutation.mutate()}
    >
      <div className="grid gap-4">
        <div className="grid gap-2">
          <p className="text-sm font-semibold text-text-secondary">Target order</p>
          <SupervisorOrderTargetSelector
            token={token}
            branchId={branchId}
            sourceOrderId={order.id}
            selectedOrderId={target?.id ?? null}
            onSelect={(selected) => {
              setTarget(selected);
              intent.reset();
            }}
          />
        </div>

        <div className="grid gap-2">
          <p className="text-sm font-semibold text-text-secondary">Items to move</p>
          <SupervisorLineSelector
            items={lines}
            quantities={quantities}
            onChange={(orderItemId, quantity) => {
              setQuantities((prev) => ({ ...prev, [orderItemId]: quantity }));
              intent.reset();
            }}
            disabled={mutation.isPending}
          />
        </div>
      </div>
    </ActionConfirmDialog>
  );
}
