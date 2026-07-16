import { GitMerge, CheckCircle } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { Button, Input } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthProvider";
import { buildCashierIdempotencyKey } from "@/lib/cashier/idempotency";
import type { CashierOrderViewModel } from "@/lib/cashier/order-types";
import { mergeCashierOrders } from "@/lib/cashier/resolution";
import type { MergeCashierOrdersInput } from "@/lib/cashier/resolution-types";
import { hasSourcePayments, mapCashierResolutionError } from "@/lib/cashier/resolution-validation";

import { CashierResolutionConfirmDialog } from "./CashierResolutionConfirmDialog";
import { CashierResolutionResultNotice } from "./CashierResolutionResultNotice";

type CashierMergeOrdersPanelProps = {
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

export function CashierMergeOrdersPanel({
  order,
  targetOrders,
  disabledReasons,
  onRefresh,
}: CashierMergeOrdersPanelProps) {
  const { accessToken, branchId } = useAuth();
  const [targetOrderId, setTargetOrderId] = useState("");
  const [reason, setReason] = useState("");
  const [pendingInput, setPendingInput] = useState<MergeCashierOrdersInput | null>(null);
  const [result, setResult] = useState<ResultState>(null);

  const sourcePaymentReasons = hasSourcePayments(order) ? ["Merge is blocked because the source order already has payments."] : [];
  const submitReasons = disabledReasons.concat(sourcePaymentReasons);
  if (!targetOrderId) submitReasons.push("Choose a target order.");
  if (!reason.trim()) submitReasons.push("Reason is required.");
  if (!targetOrders.length) submitReasons.push("No compatible target orders are loaded.");

  const mutation = useMutation({
    mutationFn: async (input: MergeCashierOrdersInput) => {
      if (!accessToken || !branchId) throw new Error("Cashier session is missing.");
      return mergeCashierOrders({
        token: accessToken,
        branchId,
        idempotencyKey: buildCashierIdempotencyKey({
          operation: "merge-orders",
          orderId: input.sourceOrderId,
          method: input.targetOrderId,
        }),
        input,
      });
    },
    onSuccess: async (response) => {
      setResult({
        tone: "success",
        title: "Orders merged.",
        message: response.kds?.note || "Source order was voided into the selected target order.",
      });
      setTargetOrderId("");
      setReason("");
      setPendingInput(null);
      await onRefresh();
    },
    onError: (error) => {
      setResult({
        tone: "danger",
        title: "Merge failed.",
        message: mapCashierResolutionError(error, "Could not merge orders."),
      });
    },
  });

  const disabled = disabledReasons.length > 0 || sourcePaymentReasons.length > 0 || mutation.isPending;

  return (
    <section className="rounded-md bg-surface p-3 shadow-subtle" aria-labelledby="cashier-merge-orders-title">
      <div className="flex items-center gap-2">
        <GitMerge size={20} weight="bold" className="text-brand-navy-900" aria-hidden />
        <h5 id="cashier-merge-orders-title" className="font-bold text-text-primary">
          Merge order
        </h5>
      </div>
      <p className="mt-1 text-sm font-medium text-text-secondary">
        Moves this source order into an active target order. Source orders with payments stay blocked.
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
          aria-label="Merge target order"
          onChange={(event) => setTargetOrderId(event.target.value)}
        >
          <option value="">Choose target order</option>
          {targetOrders.map((target) => (
            <option key={target.id} value={target.id}>
              {target.orderNumber} - {target.tableName}
            </option>
          ))}
        </select>
        <Input
          value={reason}
          disabled={disabled}
          maxLength={200}
          placeholder="Reason required"
          aria-label="Merge reason"
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
              sourceOrderId: order.id,
              targetOrderId,
              reason: reason.trim(),
            })
          }
        >
          Merge
        </Button>
      </div>

      <CashierResolutionConfirmDialog
        open={Boolean(pendingInput)}
        title="Merge this order?"
        confirmLabel="Merge order"
        isSubmitting={mutation.isPending}
        onCancel={() => setPendingInput(null)}
        onConfirm={() => pendingInput && mutation.mutate(pendingInput)}
      >
        <p>This moves the selected source order into the target order and voids the source order.</p>
      </CashierResolutionConfirmDialog>
    </section>
  );
}
