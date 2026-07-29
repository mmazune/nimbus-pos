import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui";
import { buildOperationalIdempotencyKey, useIdempotencyIntent } from "@/lib/pos-shell/idempotency";
import { cn } from "@/lib/utils/cn";
import {
  buildCustomSplitInput,
  buildEqualSplitInput,
  computeEqualSplitPreview,
  validateCustomSplit,
  validateEqualCount,
} from "@/lib/supervisor/order-action-forms";
import {
  formatSupervisorMoney,
  getSupervisorOrderLabel,
  splitSupervisorBill,
  type SupervisorOrderDetail,
} from "@/lib/supervisor/orders";

type SupervisorSplitBillDialogProps = {
  order: SupervisorOrderDetail;
  token: string;
  branchId: string;
  tableLabel?: string | null;
  onClose: () => void;
};

export function SupervisorSplitBillDialog({
  branchId,
  onClose,
  order,
  tableLabel,
  token,
}: SupervisorSplitBillDialogProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const total = order.total ?? 0;

  const [mode, setMode] = useState<"EQUAL" | "CUSTOM">("EQUAL");
  const [count, setCount] = useState(2);
  const [customAmounts, setCustomAmounts] = useState<string[]>(["", ""]);
  const [reason, setReason] = useState("");

  const intent = useIdempotencyIntent(() =>
    buildOperationalIdempotencyKey({ operation: "supervisor:split-bill", orderId: order.id }),
  );

  const equalPreview = useMemo(
    () => (mode === "EQUAL" ? computeEqualSplitPreview(total, count) : null),
    [mode, count, total],
  );
  const equalValid = mode === "EQUAL" && validateEqualCount(count).valid && Boolean(equalPreview);
  const customValidation = useMemo(
    () => (mode === "CUSTOM" ? validateCustomSplit(customAmounts, total) : null),
    [mode, customAmounts, total],
  );
  const isValid = mode === "EQUAL" ? equalValid : Boolean(customValidation?.valid);

  const mutation = useMutation({
    mutationFn: () => {
      const input =
        mode === "EQUAL"
          ? buildEqualSplitInput(count, reason)
          : buildCustomSplitInput(
              customAmounts.map((amount) => ({ amount })),
              reason,
            );
      return splitSupervisorBill(token, branchId, order.id, input, intent.begin());
    },
    onSuccess: (result) => {
      // Non-physical: only order metadata changed. Refresh the canonical order.
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "order-detail", branchId, order.id] });
      intent.reset();
      showToast({
        tone: "success",
        title: "Bill split recorded",
        description: `${result.splitGroups.length} payable groups allocated for the cashier. No payment was collected.`,
      });
      onClose();
    },
    onError: (error) => {
      showToast({
        tone: "danger",
        title: "Could not split bill",
        description: error instanceof Error ? error.message : "Retry when the connection is stable.",
      });
    },
  });

  // A material change to the split invalidates any in-flight idempotency intent.
  function resetIntent() {
    intent.reset();
  }

  function updateCustomAmount(index: number, value: string) {
    setCustomAmounts((prev) => prev.map((amount, i) => (i === index ? value : amount)));
    resetIntent();
  }

  return (
    <ActionConfirmDialog
      open
      tone="info"
      title="Split bill"
      consequence="Records payable allocation groups for the cashier to collect from separately. The order, items, taxes, and kitchen tickets are unchanged — no payment is collected."
      context={
        <p>
          {getSupervisorOrderLabel(order)}
          {tableLabel ? ` • ${tableLabel}` : ""} • Total {formatSupervisorMoney(total)}
        </p>
      }
      pending={mutation.isPending}
      confirmDisabled={!isValid}
      confirmLabel="Record split"
      error={null}
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
        <div role="radiogroup" aria-label="Split mode" className="flex gap-2">
          {(["EQUAL", "CUSTOM"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={mode === option}
              disabled={mutation.isPending}
              onClick={() => {
                setMode(option);
                resetIntent();
              }}
              className={cn(
                "flex-1 rounded-md border px-3 py-2 text-sm font-semibold focus-visible:shadow-focus",
                mode === option
                  ? "border-brand-navy-900 bg-brand-white text-text-primary shadow-panel"
                  : "border-border-subtle bg-surface text-text-secondary hover:bg-surface-muted",
              )}
            >
              {option === "EQUAL" ? "Equal split" : "Custom amounts"}
            </button>
          ))}
        </div>

        {mode === "EQUAL" ? (
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm font-semibold text-text-secondary">
              <span>Number of groups (2–20)</span>
              <input
                type="number"
                inputMode="numeric"
                min={2}
                max={20}
                step={1}
                value={count}
                disabled={mutation.isPending}
                aria-invalid={!validateEqualCount(count).valid || undefined}
                className="h-11 w-28 rounded-md bg-surface-muted px-3 text-base font-semibold tabular-nums text-text-primary shadow-subtle focus-visible:shadow-focus"
                onChange={(event) => {
                  setCount(Math.floor(Number(event.target.value)) || 0);
                  resetIntent();
                }}
              />
            </label>
            {equalPreview ? (
              <div className="rounded-md bg-surface-muted p-3">
                <ul className="grid max-h-40 gap-1 overflow-y-auto text-sm">
                  {equalPreview.groups.map((group) => (
                    <li key={group.label} className="flex justify-between tabular-nums">
                      <span className="text-text-secondary">{group.label}</span>
                      <span className="font-semibold text-text-primary">{formatSupervisorMoney(group.amount)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 border-t border-border-subtle pt-2 text-sm font-semibold tabular-nums text-text-primary">
                  Allocated {formatSupervisorMoney(equalPreview.allocated)} / {formatSupervisorMoney(total)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-status-warning">{validateEqualCount(count).reason}</p>
            )}
          </div>
        ) : (
          <div className="grid gap-2">
            {customAmounts.map((amount, index) => (
              <div key={index} className="flex items-center gap-2">
                <label className="flex-1 text-sm font-semibold text-text-secondary">
                  <span className="sr-only">Group {index + 1} amount</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    placeholder={`Group ${index + 1} amount`}
                    disabled={mutation.isPending}
                    className="h-11 w-full rounded-md bg-surface-muted px-3 text-base font-semibold tabular-nums text-text-primary shadow-subtle focus-visible:shadow-focus"
                    onChange={(event) => updateCustomAmount(index, event.target.value)}
                  />
                </label>
                {customAmounts.length > 2 ? (
                  <Button
                    variant="tertiary"
                    size="compact"
                    disabled={mutation.isPending}
                    onClick={() => {
                      setCustomAmounts((prev) => prev.filter((_, i) => i !== index));
                      resetIntent();
                    }}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            ))}
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="secondary"
                size="compact"
                disabled={mutation.isPending || customAmounts.length >= 20}
                onClick={() => {
                  setCustomAmounts((prev) => [...prev, ""]);
                  resetIntent();
                }}
              >
                Add group
              </Button>
              {customValidation ? (
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    customValidation.valid ? "text-status-success" : "text-status-warning",
                  )}
                >
                  Allocated {formatSupervisorMoney((customValidation.sumCents / 100).toFixed(2))} /{" "}
                  {formatSupervisorMoney(total)}
                </span>
              ) : null}
            </div>
            {customValidation && !customValidation.valid ? (
              <p className="text-sm text-status-warning">{customValidation.reason}</p>
            ) : null}
          </div>
        )}
      </div>
    </ActionConfirmDialog>
  );
}
