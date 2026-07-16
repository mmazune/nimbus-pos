import { CheckCircle, Scales } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Badge, Button, StatusMessage } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthProvider";
import { buildCashierIdempotencyKey } from "@/lib/cashier/idempotency";
import type { CashierOrderViewModel } from "@/lib/cashier/order-types";
import { splitCashierBill } from "@/lib/cashier/resolution";
import type { CashierSplitBillGroupInput, CashierSplitBillMode, SplitCashierBillInput } from "@/lib/cashier/resolution-types";
import { mapCashierResolutionError, validateSplitBillInput } from "@/lib/cashier/resolution-validation";

import { CashierResolutionConfirmDialog } from "./CashierResolutionConfirmDialog";
import { CashierResolutionResultNotice } from "./CashierResolutionResultNotice";
import { CashierSplitBillCustomForm } from "./CashierSplitBillCustomForm";
import { CashierSplitBillEqualForm } from "./CashierSplitBillEqualForm";
import { CashierSplitBillSummary } from "./CashierSplitBillSummary";

type CashierSplitBillPanelProps = {
  order: CashierOrderViewModel;
  disabledReasons: string[];
  onRefresh: () => Promise<void>;
};

type ResultState = {
  tone: "success" | "danger";
  title: string;
  message?: string;
} | null;

export function CashierSplitBillPanel({ order, disabledReasons, onRefresh }: CashierSplitBillPanelProps) {
  const { accessToken, branchId } = useAuth();
  const [mode, setMode] = useState<CashierSplitBillMode>("EQUAL");
  const [equalCount, setEqualCount] = useState(2);
  const [equalReason, setEqualReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [customGroups, setCustomGroups] = useState<CashierSplitBillGroupInput[]>([
    { label: "Guest 1", amount: "" },
    { label: "Guest 2", amount: "" },
  ]);
  const [pendingInput, setPendingInput] = useState<SplitCashierBillInput | null>(null);
  const [result, setResult] = useState<ResultState>(null);

  const validation = useMemo(
    () =>
      validateSplitBillInput({
        order,
        mode,
        equalCount,
        groups: customGroups,
      }),
    [customGroups, equalCount, mode, order],
  );

  const mutation = useMutation({
    mutationFn: async (input: SplitCashierBillInput) => {
      if (!accessToken || !branchId) throw new Error("Cashier session is missing.");
      return splitCashierBill({
        token: accessToken,
        branchId,
        orderId: order.id,
        idempotencyKey: buildCashierIdempotencyKey({
          operation: "split-bill",
          orderId: order.id,
          method: input.mode,
        }),
        input,
      });
    },
    onSuccess: async (response) => {
      setResult({
        tone: "success",
        title: "Split bill recorded.",
        message: response.note || "Allocation metadata was saved on the order.",
      });
      setPendingInput(null);
      await onRefresh();
    },
    onError: (error) => {
      setResult({
        tone: "danger",
        title: "Split bill failed.",
        message: mapCashierResolutionError(error, "Could not record bill split."),
      });
    },
  });

  const disabled = disabledReasons.length > 0 || mutation.isPending;
  const submitReasons = disabledReasons.concat(validation.reasons);

  function buildInput(): SplitCashierBillInput {
    if (mode === "EQUAL") {
      return {
        mode,
        count: equalCount,
        reason: equalReason.trim() || undefined,
      };
    }

    return {
      mode,
      groups: customGroups.map((group, index) => ({
        label: group.label?.trim() || `Guest ${index + 1}`,
        amount: group.amount?.trim(),
      })),
      reason: customReason.trim() || undefined,
    };
  }

  return (
    <section className="rounded-lg bg-surface-muted p-4" aria-labelledby="cashier-split-bill-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Scales size={22} weight="bold" className="text-brand-navy-900" aria-hidden />
            <h4 id="cashier-split-bill-title" className="font-bold text-text-primary">
              Split bill allocation
            </h4>
          </div>
          <p className="mt-1 text-sm font-medium text-text-secondary">
            Split bill creates cashier allocation groups on this order. It does not create separate child orders.
          </p>
        </div>
        <Badge variant="info">Metadata only</Badge>
      </div>

      <div className="mt-4">
        <CashierSplitBillSummary order={order} />
      </div>

      {result ? (
        <div className="mt-4">
          <CashierResolutionResultNotice tone={result.tone} title={result.title} message={result.message} />
        </div>
      ) : null}

      <div className="mt-4 inline-flex rounded-md bg-surface p-1 shadow-subtle" role="group" aria-label="Split bill mode">
        {(["EQUAL", "CUSTOM"] as CashierSplitBillMode[]).map((candidate) => (
          <button
            key={candidate}
            type="button"
            className={`rounded px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy-900 ${
              mode === candidate ? "bg-brand-navy-900 text-text-inverse" : "text-text-secondary hover:bg-surface-muted"
            }`}
            disabled={disabled}
            onClick={() => setMode(candidate)}
          >
            {candidate === "EQUAL" ? "Equal" : "Custom"}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {mode === "EQUAL" ? (
          <CashierSplitBillEqualForm
            order={order}
            count={equalCount}
            reason={equalReason}
            disabled={disabled}
            onCountChange={setEqualCount}
            onReasonChange={setEqualReason}
          />
        ) : (
          <CashierSplitBillCustomForm
            order={order}
            groups={customGroups}
            reason={customReason}
            disabled={disabled}
            onGroupsChange={setCustomGroups}
            onReasonChange={setCustomReason}
          />
        )}
      </div>

      {submitReasons.length ? (
        <StatusMessage tone="warning" title="Split bill cannot be saved yet.">
          <span>{submitReasons[0]}</span>
        </StatusMessage>
      ) : null}

      <div className="mt-4 flex justify-end">
        <Button
          leadingIcon={<CheckCircle size={18} weight="bold" aria-hidden />}
          disabled={submitReasons.length > 0 || disabled}
          onClick={() => setPendingInput(buildInput())}
        >
          Save split
        </Button>
      </div>

      <CashierResolutionConfirmDialog
        open={Boolean(pendingInput)}
        title="Save split allocation?"
        confirmLabel="Save split"
        isSubmitting={mutation.isPending}
        onCancel={() => setPendingInput(null)}
        onConfirm={() => pendingInput && mutation.mutate(pendingInput)}
      >
        <p>
          This records a bill allocation on the parent order. Payments still attach to the parent order.
        </p>
      </CashierResolutionConfirmDialog>
    </section>
  );
}
