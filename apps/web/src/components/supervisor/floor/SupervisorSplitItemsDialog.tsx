import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { useToast } from "@/components/providers/ToastProvider";
import { shouldRetryApiRequest } from "@/lib/api/client";
import { buildOperationalIdempotencyKey, useIdempotencyIntent } from "@/lib/pos-shell/idempotency";
import { fetchSupervisorTables } from "@/lib/supervisor/floor";
import { buildItemSelections, validateLineSelections } from "@/lib/supervisor/order-action-forms";
import {
  getSupervisorOrderLabel,
  splitSupervisorItems,
  type SupervisorOrderDetail,
} from "@/lib/supervisor/orders";

import { SupervisorLineSelector } from "./SupervisorLineSelector";
import { formatOperationalTableLabel } from "@/components/floor/formatters";

type SupervisorSplitItemsDialogProps = {
  order: SupervisorOrderDetail;
  token: string;
  branchId: string;
  tableLabel?: string | null;
  onClose: () => void;
};

export function SupervisorSplitItemsDialog({
  branchId,
  onClose,
  order,
  tableLabel,
  token,
}: SupervisorSplitItemsDialogProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const lines = useMemo(() => order.items ?? [], [order.items]);

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [targetTableId, setTargetTableId] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const intent = useIdempotencyIntent(() =>
    buildOperationalIdempotencyKey({ operation: "supervisor:split-items", orderId: order.id }),
  );

  const tablesQuery = useQuery({
    queryKey: ["supervisor", "available-tables", branchId],
    queryFn: () => fetchSupervisorTables(token, branchId),
    retry: shouldRetryApiRequest,
    staleTime: 10_000,
  });
  const availableTables = (tablesQuery.data ?? []).filter((table) => table.status === "AVAILABLE");

  const selections = useMemo(() => buildItemSelections(quantities), [quantities]);
  const isValid = validateLineSelections(selections, lines).valid;

  const mutation = useMutation({
    mutationFn: () =>
      splitSupervisorItems(
        token,
        branchId,
        order.id,
        {
          items: selections,
          ...(targetTableId ? { targetTableId } : {}),
          ...(reason.trim() ? { reason: reason.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
        intent.begin(),
      ),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "order-detail", branchId, order.id] });
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "floor", branchId] });
      void queryClient.invalidateQueries({ queryKey: ["waiter", "floor", branchId] });
      intent.reset();
      const childNumber = result.childOrder?.orderNumber;
      showToast({
        tone: "success",
        title: "Items split to a new order",
        description: childNumber
          ? `Child order ${childNumber} created (status NEW; re-send to the kitchen if needed).`
          : "A new child order was created.",
      });
      onClose();
    },
    onError: (error) => {
      showToast({
        tone: "danger",
        title: "Could not split items",
        description: error instanceof Error ? error.message : "Retry when the connection is stable.",
      });
    },
  });

  function handleQuantity(orderItemId: string, quantity: number) {
    setQuantities((prev) => ({ ...prev, [orderItemId]: quantity }));
    intent.reset();
  }

  return (
    <ActionConfirmDialog
      open
      size="lg"
      tone="warning"
      title="Split items to a new order"
      consequence="Moves the selected items onto a NEW child order. The child starts in NEW status and must be re-sent to the kitchen if preparation is still required."
      context={
        <p>
          From {getSupervisorOrderLabel(order)}
          {tableLabel ? ` • ${tableLabel}` : ""}
        </p>
      }
      pending={mutation.isPending}
      confirmDisabled={!isValid}
      confirmLabel="Split items"
      reason={{
        label: "Reason (optional)",
        placeholder: "Optional note for the audit trail",
        value: reason,
        onChange: (value) => {
          setReason(value);
        },
      }}
      onCancel={() => {
        if (mutation.isPending) return;
        onClose();
      }}
      onConfirm={() => mutation.mutate()}
    >
      <div className="grid gap-4">
        <SupervisorLineSelector
          items={lines}
          quantities={quantities}
          onChange={handleQuantity}
          disabled={mutation.isPending}
        />

        <label className="grid gap-1 text-sm font-semibold text-text-secondary">
          <span>Assign child order to a table (optional)</span>
          <select
            value={targetTableId}
            disabled={mutation.isPending}
            className="h-11 rounded-md bg-surface-muted px-3 text-base font-semibold text-text-primary shadow-subtle focus-visible:shadow-focus"
            onChange={(event) => {
              setTargetTableId(event.target.value);
              intent.reset();
            }}
          >
            <option value="">Keep unassigned</option>
            {availableTables.map((table) => (
              <option key={table.id} value={table.id}>
                <span title={table.label || table.id}>{formatOperationalTableLabel(table.label) || table.label || table.id}</span>
              </option>
            ))}
          </select>
          {tablesQuery.isError ? (
            <span className="text-sm text-status-warning">Table list unavailable — the child order will stay unassigned.</span>
          ) : null}
        </label>

        <label className="grid gap-1 text-sm font-semibold text-text-secondary">
          <span>Notes (optional)</span>
          <input
            type="text"
            value={notes}
            maxLength={200}
            disabled={mutation.isPending}
            placeholder="Optional kitchen/handover note"
            className="h-11 rounded-md bg-surface-muted px-3 text-base font-medium text-text-primary shadow-subtle focus-visible:shadow-focus"
            onChange={(event) => {
              setNotes(event.target.value);
              intent.reset();
            }}
          />
        </label>
      </div>
    </ActionConfirmDialog>
  );
}
