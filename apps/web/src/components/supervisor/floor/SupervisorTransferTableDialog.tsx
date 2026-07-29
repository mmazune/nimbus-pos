import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { useToast } from "@/components/providers/ToastProvider";
import { buildOperationalIdempotencyKey, useIdempotencyIntent } from "@/lib/pos-shell/idempotency";
import type { SupervisorFloorData } from "@/lib/supervisor/floor";
import {
  getSupervisorOrderLabel,
  transferSupervisorOrderTable,
  type SupervisorOrderDetail,
} from "@/lib/supervisor/orders";
import {
  transferTableErrorCopy,
  validateTransferTableSelection,
  type TransferTableTarget,
} from "@/lib/supervisor/transfer-table";

import { SupervisorTableTargetSelector } from "./SupervisorTableTargetSelector";

type SupervisorTransferTableDialogProps = {
  order: SupervisorOrderDetail;
  token: string;
  branchId: string;
  sourceTableId: string | null;
  sourceTableLabel?: string | null;
  onClose: () => void;
  onCompleted: (params: { orderId: string; newTableId: string; newTableLabel: string | null }) => void;
};

export function SupervisorTransferTableDialog({
  branchId,
  onClose,
  onCompleted,
  order,
  sourceTableId,
  sourceTableLabel,
  token,
}: SupervisorTransferTableDialogProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [target, setTarget] = useState<TransferTableTarget | null>(null);
  const [reason, setReason] = useState("");

  const intent = useIdempotencyIntent(() =>
    buildOperationalIdempotencyKey({ operation: "supervisor:transfer-table", orderId: order.id }),
  );

  const validity = useMemo(
    () => validateTransferTableSelection(sourceTableId, target?.id ?? null),
    [sourceTableId, target?.id],
  );

  const mutation = useMutation({
    mutationFn: () => {
      if (!target) throw new Error("Choose a target table");
      // Re-validate at submission: distinct, non-source target.
      const check = validateTransferTableSelection(sourceTableId, target.id);
      if (!check.valid) throw new Error(check.reason || "Choose a target table");
      return transferSupervisorOrderTable(
        token,
        branchId,
        order.id,
        { targetTableId: target.id, ...(reason.trim() ? { reason: reason.trim() } : {}) },
        intent.begin(),
      );
    },
    onSuccess: (result) => {
      const newTableLabel = result.newTableLabel ?? target?.label ?? null;

      // Canonical cache updates — reassign the order to the returned table so the
      // source Floor card frees and the target card shows the order, and the
      // selected order detail reflects the new table. No broad invalidation.
      queryClient.setQueryData<SupervisorOrderDetail>(
        ["supervisor", "order-detail", branchId, order.id],
        (current) =>
          current
            ? { ...current, tableId: result.newTableId, table: { id: result.newTableId, label: newTableLabel } }
            : current,
      );
      queryClient.setQueryData<SupervisorFloorData>(["supervisor", "floor", branchId], (current) =>
        current
          ? {
              ...current,
              activeOrders: current.activeOrders.map((entry) =>
                entry.id === order.id
                  ? { ...entry, tableId: result.newTableId, table: { id: result.newTableId, label: newTableLabel } }
                  : entry,
              ),
            }
          : current,
      );
      // Target/source tables and the Waiter Floor mirror the same order data.
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "floor", branchId] });
      void queryClient.invalidateQueries({ queryKey: ["waiter", "floor", branchId] });

      intent.reset();
      showToast({
        tone: "success",
        title: "Table transferred",
        description: `${getSupervisorOrderLabel(order)} moved to ${newTableLabel || "the selected table"}.`,
      });
      onCompleted({ orderId: order.id, newTableId: result.newTableId, newTableLabel });
    },
    onError: (error) => {
      // A stale/changed target may 404/409 — clear the intent so a corrected
      // selection generates a fresh idempotency key.
      intent.reset();
      showToast({
        tone: "danger",
        title: "Could not transfer table",
        description: transferTableErrorCopy(error),
      });
    },
  });

  return (
    <ActionConfirmDialog
      open
      size="lg"
      tone="warning"
      title="Transfer order to another table"
      consequence="Moves this order to the chosen table in the same branch. It does not collect payment, change the order status, or move any linked reservation."
      context={
        <p>
          {getSupervisorOrderLabel(order)}
          {" • from "}
          {sourceTableLabel || "no current table"}
          {target ? ` → ${target.label}` : ""}
        </p>
      }
      pending={mutation.isPending}
      confirmDisabled={!validity.valid}
      confirmLabel="Transfer table"
      reason={{
        label: "Reason (optional)",
        placeholder: "Optional note for the audit trail",
        value: reason,
        onChange: setReason,
      }}
      error={mutation.isError ? transferTableErrorCopy(mutation.error) : null}
      onCancel={() => {
        if (mutation.isPending) return;
        onClose();
      }}
      onConfirm={() => mutation.mutate()}
    >
      <div className="grid gap-2">
        <p className="text-sm font-semibold text-text-secondary">Target table</p>
        <SupervisorTableTargetSelector
          token={token}
          branchId={branchId}
          sourceTableId={sourceTableId}
          selectedTableId={target?.id ?? null}
          onSelect={(selected) => {
            setTarget(selected);
            intent.reset();
          }}
        />
        {target?.warning ? (
          <p className="rounded-md bg-status-warning-surface px-3 py-2 text-sm font-semibold text-status-warning">
            {target.warning}
          </p>
        ) : null}
      </div>
    </ActionConfirmDialog>
  );
}
