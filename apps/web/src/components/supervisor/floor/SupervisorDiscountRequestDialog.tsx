import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { useToast } from "@/components/providers/ToastProvider";
import { cn } from "@/lib/utils/cn";
import {
  computeDiscountPreview,
  discountRequestErrorCopy,
  validateDiscountValue,
} from "@/lib/supervisor/order-financials";
import {
  formatSupervisorMoney,
  getSupervisorOrderLabel,
  requestSupervisorOrderDiscount,
  toMoneyNumber,
  type SupervisorDiscountType,
  type SupervisorOrderDetail,
} from "@/lib/supervisor/orders";

type SupervisorDiscountRequestDialogProps = {
  order: SupervisorOrderDetail;
  token: string;
  branchId: string;
  tableLabel?: string | null;
  onClose: () => void;
  onCompleted: () => void;
};

const TYPE_OPTIONS: { value: SupervisorDiscountType; label: string }[] = [
  { value: "PERCENTAGE", label: "Percentage" },
  { value: "FIXED", label: "Fixed amount" },
];

export function SupervisorDiscountRequestDialog({
  branchId,
  onClose,
  onCompleted,
  order,
  tableLabel,
  token,
}: SupervisorDiscountRequestDialogProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const subtotal = order.subtotal ?? order.total ?? 0;
  const [type, setType] = useState<SupervisorDiscountType>("PERCENTAGE");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");

  const valueValidity = useMemo(
    () => (value.trim() ? validateDiscountValue(type, value, subtotal) : { valid: false as const }),
    [type, value, subtotal],
  );
  const preview = useMemo(() => computeDiscountPreview(type, value, subtotal), [type, value, subtotal]);
  const reasonValid = reason.trim().length > 0;
  const canSubmit = valueValidity.valid && reasonValid;

  const mutation = useMutation({
    mutationFn: () => {
      const check = validateDiscountValue(type, value, subtotal);
      if (!check.valid) throw new Error(check.reason || "Enter a valid discount value.");
      return requestSupervisorOrderDiscount(token, branchId, order.id, {
        type,
        value: Number(value),
        reason: reason.trim(),
      });
    },
    onSuccess: (discount) => {
      const approved = discount.status === "APPROVED";
      // Totals are backend-authoritative — re-fetch the order + its discounts rather
      // than optimistically applying a final total. Narrow: order + discount domain only.
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "order-detail", branchId, order.id] });
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "order-discounts", branchId, order.id] });
      if (approved) {
        void queryClient.invalidateQueries({ queryKey: ["supervisor", "floor", branchId] });
      }
      // Pending requests surface in the Supervisor Approvals discount queue only.
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "approvals", "discounts", branchId] });

      showToast({
        tone: "success",
        title: approved ? "Discount applied" : "Discount sent for approval",
        description: approved
          ? `${getSupervisorOrderLabel(order)} discount was auto-approved within the branch threshold.`
          : `${getSupervisorOrderLabel(order)} discount is pending manager approval.`,
      });
      onCompleted();
    },
    onError: (error) => {
      showToast({ tone: "danger", title: "Could not request discount", description: discountRequestErrorCopy(error) });
    },
  });

  return (
    <ActionConfirmDialog
      open
      size="lg"
      tone="warning"
      title="Request an order discount"
      consequence="Requests an order-level discount against the subtotal. Small adjustments auto-approve within the branch threshold; larger ones need manager approval. It does not collect payment, close, or void the order."
      context={
        <p>
          {getSupervisorOrderLabel(order)}
          {" • "}
          {order.serviceType === "TAKEAWAY" ? "Takeaway" : tableLabel || "Tableless"}
        </p>
      }
      reason={{
        label: "Reason (required)",
        placeholder: "e.g. Prompt 3B3A discount validation",
        value: reason,
        onChange: setReason,
        required: true,
      }}
      pending={mutation.isPending}
      confirmDisabled={!canSubmit}
      confirmLabel="Request discount"
      error={mutation.isError ? discountRequestErrorCopy(mutation.error) : null}
      onCancel={() => {
        if (mutation.isPending) return;
        onClose();
      }}
      onConfirm={() => mutation.mutate()}
    >
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md bg-surface-muted p-3">
            <p className="text-xs font-semibold uppercase tracking-normal text-text-muted">Subtotal (basis)</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">{formatSupervisorMoney(subtotal)}</p>
          </div>
          <div className="rounded-md bg-surface-muted p-3">
            <p className="text-xs font-semibold uppercase tracking-normal text-text-muted">Current total</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">{formatSupervisorMoney(order.total)}</p>
          </div>
        </div>

        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold text-text-secondary">Discount type</legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Discount type">
            {TYPE_OPTIONS.map((option) => {
              const active = type === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setType(option.value)}
                  className={cn(
                    "min-h-11 rounded-md border px-3 text-sm font-semibold focus-visible:shadow-focus",
                    active
                      ? "border-brand-navy-900 bg-brand-white text-text-primary shadow-panel"
                      : "border-border-subtle bg-surface text-text-secondary hover:bg-surface-muted",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="grid gap-1 text-sm font-semibold text-text-secondary">
          <span>{type === "PERCENTAGE" ? "Percentage (0.01–100)" : "Fixed amount (UGX)"}</span>
          <input
            type="text"
            inputMode="decimal"
            className="min-h-12 rounded-md bg-surface-muted px-3 text-base font-semibold text-text-primary shadow-subtle focus-visible:shadow-focus"
            value={value}
            disabled={mutation.isPending}
            aria-invalid={value.trim() !== "" && !valueValidity.valid ? true : undefined}
            aria-describedby="supervisor-discount-value-help"
            onChange={(event) => setValue(event.target.value)}
          />
          <span id="supervisor-discount-value-help" className="text-sm font-normal text-text-muted">
            {value.trim() && !valueValidity.valid && "reason" in valueValidity
              ? valueValidity.reason
              : type === "PERCENTAGE"
                ? "A percentage of the subtotal."
                : "A fixed amount, not exceeding the subtotal."}
          </span>
        </label>

        <div className="rounded-md bg-status-info-surface p-3">
          <p className="text-xs font-semibold uppercase tracking-normal text-text-muted">Estimated effect (confirmed after submit)</p>
          {preview ? (
            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-text-secondary">
                −{formatSupervisorMoney(preview.discountAmount)} discount
              </p>
              <p className="text-lg font-bold tabular-nums text-text-primary">
                {formatSupervisorMoney(preview.newTotal)}
                <span className="ml-1 text-sm font-normal text-text-muted">est. total</span>
              </p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-text-muted">Enter a valid value to preview the effect.</p>
          )}
          {toMoneyNumber(subtotal) <= 0 ? (
            <p className="mt-1 text-sm text-status-warning">This order has no positive subtotal to discount.</p>
          ) : null}
        </div>
      </div>
    </ActionConfirmDialog>
  );
}
