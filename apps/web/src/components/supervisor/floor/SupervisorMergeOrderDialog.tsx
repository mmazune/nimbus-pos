import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { useToast } from "@/components/providers/ToastProvider";
import { ApiError } from "@/lib/api/client";
import { buildOperationalIdempotencyKey, useIdempotencyIntent } from "@/lib/pos-shell/idempotency";
import {
  formatSupervisorMoney,
  getSupervisorOrderLabel,
  getSupervisorTableLabel,
  mergeSupervisorOrders,
  type SupervisorOrderDetail,
  type SupervisorOrderListItem,
} from "@/lib/supervisor/orders";

import { SupervisorOrderTargetSelector } from "./SupervisorOrderTargetSelector";

type SupervisorMergeOrderDialogProps = {
  order: SupervisorOrderDetail;
  token: string;
  branchId: string;
  tableLabel?: string | null;
  onClose: () => void;
  onCompleted: (nav: { orderId: string; tableId?: string | null }) => void;
};

function mergeErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "MERGE_SOURCE_HAS_PAYMENTS") {
      return "This order already has payments. Resolve them via refunds before merging.";
    }
    if (error.isForbidden) return "This session cannot merge orders.";
    return error.message;
  }
  return error instanceof Error ? error.message : "Retry when the connection is stable.";
}

export function SupervisorMergeOrderDialog({
  branchId,
  onClose,
  onCompleted,
  order,
  tableLabel,
  token,
}: SupervisorMergeOrderDialogProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [target, setTarget] = useState<SupervisorOrderListItem | null>(null);
  const [reason, setReason] = useState("");

  const intent = useIdempotencyIntent(() =>
    buildOperationalIdempotencyKey({ operation: "supervisor:merge", orderId: order.id }),
  );

  const isValid = Boolean(target && target.id !== order.id);

  const mutation = useMutation({
    mutationFn: () => {
      if (!target) throw new Error("Select a surviving target order");
      return mergeSupervisorOrders(
        token,
        branchId,
        { sourceOrderId: order.id, targetOrderId: target.id, ...(reason.trim() ? { reason: reason.trim() } : {}) },
        intent.begin(),
      );
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "order-detail", branchId, order.id] });
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "floor", branchId] });
      void queryClient.invalidateQueries({ queryKey: ["waiter", "floor", branchId] });
      intent.reset();
      const survivingId = result.targetOrder?.id || target?.id;
      const survivingTableId = result.targetOrder?.table?.id || result.targetOrder?.tableId || target?.table?.id || target?.tableId || null;
      if (survivingId) {
        void queryClient.invalidateQueries({ queryKey: ["supervisor", "order-detail", branchId, survivingId] });
      }
      showToast({
        tone: "success",
        title: "Orders merged",
        description: target
          ? `${getSupervisorOrderLabel(order)} was voided and merged into ${getSupervisorOrderLabel(target)}.`
          : "Order merged into the target.",
      });
      if (survivingId) {
        onCompleted({ orderId: survivingId, tableId: survivingTableId });
      } else {
        onClose();
      }
    },
    onError: () => {
      // Message rendered inline in the dialog via mutation.error.
    },
  });

  return (
    <ActionConfirmDialog
      open
      size="lg"
      tone="danger"
      title="Merge orders"
      consequence={
        target
          ? `${getSupervisorOrderLabel(order)} will be VOIDED and all of its items moved into ${getSupervisorOrderLabel(target)}, which survives. This cannot be undone.`
          : "Select the surviving target order. The current order will be voided and its items moved into the target. This cannot be undone."
      }
      context={
        <div className="grid gap-1">
          <p>
            <span className="font-semibold text-text-primary">Source (will be voided):</span> {getSupervisorOrderLabel(order)}
            {tableLabel ? ` • ${tableLabel}` : ""} • {formatSupervisorMoney(order.total ?? 0)}
          </p>
          {target ? (
            <p>
              <span className="font-semibold text-text-primary">Surviving target:</span> {getSupervisorOrderLabel(target)} •{" "}
              {getSupervisorTableLabel(target)} • {formatSupervisorMoney(target.total ?? 0)}
            </p>
          ) : null}
        </div>
      }
      pending={mutation.isPending}
      confirmDisabled={!isValid}
      confirmLabel="Merge and void source"
      error={mutation.isError ? mergeErrorMessage(mutation.error) : null}
      reason={{
        label: "Reason",
        placeholder: "Why are these orders being merged?",
        value: reason,
        onChange: setReason,
        required: true,
      }}
      onCancel={() => {
        if (mutation.isPending) return;
        onClose();
      }}
      onConfirm={() => mutation.mutate()}
    >
      <div className="grid gap-2">
        <p className="text-sm font-semibold text-text-secondary">Surviving target order</p>
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
    </ActionConfirmDialog>
  );
}
