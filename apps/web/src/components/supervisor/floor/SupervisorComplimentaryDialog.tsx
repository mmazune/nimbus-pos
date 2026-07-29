import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { useToast } from "@/components/providers/ToastProvider";
import {
  buildComplimentaryDiscountInput,
  COMPLIMENTARY_CATEGORIES,
  discountRequestErrorCopy,
  type ComplimentaryCategory,
} from "@/lib/supervisor/order-financials";
import {
  formatSupervisorMoney,
  getSupervisorOrderLabel,
  requestSupervisorOrderDiscount,
  type SupervisorOrderDetail,
} from "@/lib/supervisor/orders";

type SupervisorComplimentaryDialogProps = {
  order: SupervisorOrderDetail;
  token: string;
  branchId: string;
  tableLabel?: string | null;
  onClose: () => void;
  onCompleted: () => void;
};

export function SupervisorComplimentaryDialog({
  branchId,
  onClose,
  onCompleted,
  order,
  tableLabel,
  token,
}: SupervisorComplimentaryDialogProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [category, setCategory] = useState<ComplimentaryCategory>("SERVICE_RECOVERY");
  const [reason, setReason] = useState("");

  const subtotal = order.subtotal ?? order.total ?? 0;
  const reasonValid = reason.trim().length > 0;

  const mutation = useMutation({
    mutationFn: () => {
      if (!reasonValid) throw new Error("A complimentary reason is required.");
      // Whole-order comp = a verified 100% discount request with persisted metadata.
      return requestSupervisorOrderDiscount(
        token,
        branchId,
        order.id,
        buildComplimentaryDiscountInput(reason, category),
      );
    },
    onSuccess: (discount) => {
      const approved = discount.status === "APPROVED";
      // Totals are backend-authoritative — re-fetch order + discounts. Discount domain only.
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "order-detail", branchId, order.id] });
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "order-discounts", branchId, order.id] });
      void queryClient.invalidateQueries({ queryKey: ["supervisor", "approvals", "discounts", branchId] });
      if (approved) {
        void queryClient.invalidateQueries({ queryKey: ["supervisor", "floor", branchId] });
      }
      showToast({
        tone: "success",
        title: approved ? "Complimentary applied" : "Complimentary sent for approval",
        description: approved
          ? `${getSupervisorOrderLabel(order)} was comped (auto-approved within the branch threshold).`
          : `${getSupervisorOrderLabel(order)} complimentary is pending manager approval.`,
      });
      onCompleted();
    },
    onError: (error) => {
      showToast({ tone: "danger", title: "Could not comp order", description: discountRequestErrorCopy(error) });
    },
  });

  return (
    <ActionConfirmDialog
      open
      size="lg"
      tone="warning"
      title="Make this order complimentary"
      consequence="Comps the WHOLE order via a 100% discount against the subtotal. Small comps auto-approve within the branch threshold; larger ones need manager approval. This is NOT a void and does NOT refund an existing payment."
      context={
        <p>
          {getSupervisorOrderLabel(order)}
          {" • "}
          {order.serviceType === "TAKEAWAY" ? "Takeaway" : tableLabel || "Tableless"}
        </p>
      }
      reason={{
        label: "Complimentary reason (required)",
        placeholder: "e.g. Prompt 3B3B complimentary validation",
        value: reason,
        onChange: setReason,
        required: true,
      }}
      pending={mutation.isPending}
      confirmDisabled={!reasonValid}
      confirmLabel="Comp whole order"
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
            <p className="text-xs font-semibold uppercase tracking-normal text-text-muted">Subtotal</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">{formatSupervisorMoney(subtotal)}</p>
          </div>
          <div className="rounded-md bg-status-info-surface p-3">
            <p className="text-xs font-semibold uppercase tracking-normal text-text-muted">Est. resulting total</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">
              {formatSupervisorMoney(0)}
              <span className="ml-1 text-sm font-normal text-text-muted">(confirmed after submit)</span>
            </p>
          </div>
        </div>

        <label className="grid gap-1 text-sm font-semibold text-text-secondary">
          <span>Category</span>
          <select
            className="min-h-11 rounded-md bg-surface-muted px-3 text-base font-semibold text-text-primary shadow-subtle focus-visible:shadow-focus"
            value={category}
            disabled={mutation.isPending}
            onChange={(event) => setCategory(event.target.value as ComplimentaryCategory)}
          >
            {COMPLIMENTARY_CATEGORIES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
    </ActionConfirmDialog>
  );
}
