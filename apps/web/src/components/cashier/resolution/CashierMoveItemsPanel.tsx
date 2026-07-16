import { ArrowsLeftRight, CheckCircle } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { Button, Input } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthProvider";
import { buildCashierIdempotencyKey } from "@/lib/cashier/idempotency";
import type { CashierOrderViewModel } from "@/lib/cashier/order-types";
import { moveCashierOrderItems } from "@/lib/cashier/resolution";
import type { MoveCashierOrderItemsInput } from "@/lib/cashier/resolution-types";
import { mapCashierResolutionError, validateResolutionItemSelection } from "@/lib/cashier/resolution-validation";

import { CashierResolutionConfirmDialog } from "./CashierResolutionConfirmDialog";
import { CashierResolutionResultNotice } from "./CashierResolutionResultNotice";
import { CashierSplitItemSelector } from "./CashierSplitItemSelector";

type CashierMoveItemsPanelProps = {
  order: CashierOrderViewModel;
  targetOrders: CashierOrderViewModel[];
  disabledReasons: string[];
  onRefresh: () => Promise<void>;
};

type ResultState = {
  tone: "success" | "danger";
  title: string;
  message?: string;
} | null;

export function CashierMoveItemsPanel({
  order,
  targetOrders,
  disabledReasons,
  onRefresh,
}: CashierMoveItemsPanelProps) {
  const { accessToken, branchId } = useAuth();
  const [targetOrderId, setTargetOrderId] = useState("");
  const [reason, setReason] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [pendingInput, setPendingInput] = useState<MoveCashierOrderItemsInput | null>(null);
  const [result, setResult] = useState<ResultState>(null);

  const validation = validateResolutionItemSelection({
    order,
    quantities,
    requireReason: true,
    reason,
    targetOrderId,
  });
  const submitReasons = disabledReasons.concat(validation.reasons);
  if (!targetOrders.length) submitReasons.push("No compatible target orders are loaded.");

  const mutation = useMutation({
    mutationFn: async (input: MoveCashierOrderItemsInput) => {
      if (!accessToken || !branchId) throw new Error("Cashier session is missing.");
      return moveCashierOrderItems({
        token: accessToken,
        branchId,
        orderId: order.id,
        idempotencyKey: buildCashierIdempotencyKey({
          operation: "move-items",
          orderId: order.id,
          method: input.targetOrderId,
        }),
        input,
      });
    },
    onSuccess: async (response) => {
      setResult({
        tone: "success",
        title: "Items moved.",
        message: response.kds?.note || "Selected items were moved to the target order.",
      });
      setTargetOrderId("");
      setReason("");
      setQuantities({});
      setPendingInput(null);
      await onRefresh();
    },
    onError: (error) => {
      setResult({
        tone: "danger",
        title: "Move items failed.",
        message: mapCashierResolutionError(error, "Could not move items."),
      });
    },
  });

  const disabled = disabledReasons.length > 0 || mutation.isPending;

  return (
    <section className="rounded-md bg-surface p-3 shadow-subtle" aria-labelledby="cashier-move-items-title">
      <div className="flex items-center gap-2">
        <ArrowsLeftRight size={20} weight="bold" className="text-brand-navy-900" aria-hidden />
        <h5 id="cashier-move-items-title" className="font-bold text-text-primary">
          Move items
        </h5>
      </div>
      <p className="mt-1 text-sm font-medium text-text-secondary">
        Moves selected quantities into an existing active target order. KDS is not republished from cashier.
      </p>

      {result ? (
        <div className="mt-3">
          <CashierResolutionResultNotice tone={result.tone} title={result.title} message={result.message} />
        </div>
      ) : null}

      <div className="mt-3 grid gap-3">
        <select
          className="min-h-11 w-full rounded-md bg-surface-muted px-4 text-base text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy-900 disabled:text-text-muted"
          value={targetOrderId}
          disabled={disabled}
          aria-label="Move items target order"
          onChange={(event) => setTargetOrderId(event.target.value)}
        >
          <option value="">Choose target order</option>
          {targetOrders.map((target) => (
            <option key={target.id} value={target.id}>
              {target.orderNumber} - {target.tableName}
            </option>
          ))}
        </select>
        <CashierSplitItemSelector
          order={order}
          quantities={quantities}
          disabled={disabled}
          onQuantityChange={(lineId, quantity) => setQuantities((current) => ({ ...current, [lineId]: quantity }))}
        />
        <Input
          value={reason}
          disabled={disabled}
          maxLength={200}
          placeholder="Reason required"
          aria-label="Move items reason"
          onChange={(event) => setReason(event.target.value)}
        />
      </div>

      {submitReasons.length ? (
        <p className="mt-3 text-sm font-medium text-status-warning">{submitReasons[0]}</p>
      ) : null}

      <div className="mt-3 flex justify-end">
        <Button
          size="compact"
          leadingIcon={<CheckCircle size={16} weight="bold" aria-hidden />}
          disabled={submitReasons.length > 0 || disabled}
          onClick={() =>
            setPendingInput({
              targetOrderId,
              items: validation.selected,
              reason: reason.trim(),
            })
          }
        >
          Move
        </Button>
      </div>

      <CashierResolutionConfirmDialog
        open={Boolean(pendingInput)}
        title="Move selected items?"
        confirmLabel="Move items"
        isSubmitting={mutation.isPending}
        onCancel={() => setPendingInput(null)}
        onConfirm={() => pendingInput && mutation.mutate(pendingInput)}
      >
        <p>This moves selected quantities to the target order without sending or republishing KDS work.</p>
      </CashierResolutionConfirmDialog>
    </section>
  );
}
