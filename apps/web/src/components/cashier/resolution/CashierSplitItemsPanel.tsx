import { ArrowsSplit, CheckCircle } from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Badge, Button, Input, StatusMessage } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthProvider";
import { buildCashierIdempotencyKey } from "@/lib/cashier/idempotency";
import type { CashierOrderViewModel } from "@/lib/cashier/order-types";
import { listCashierTables, splitCashierItems } from "@/lib/cashier/resolution";
import type { SplitCashierItemsInput } from "@/lib/cashier/resolution-types";
import { mapCashierResolutionError, validateResolutionItemSelection } from "@/lib/cashier/resolution-validation";

import { CashierResolutionConfirmDialog } from "./CashierResolutionConfirmDialog";
import { CashierResolutionResultNotice } from "./CashierResolutionResultNotice";
import { CashierSplitItemSelector } from "./CashierSplitItemSelector";

type CashierSplitItemsPanelProps = {
  order: CashierOrderViewModel;
  disabledReasons: string[];
  onRefresh: () => Promise<void>;
};

type ResultState = {
  tone: "success" | "danger";
  title: string;
  message?: string;
} | null;

export function CashierSplitItemsPanel({ order, disabledReasons, onRefresh }: CashierSplitItemsPanelProps) {
  const { accessToken, branchId } = useAuth();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [targetTableId, setTargetTableId] = useState("");
  const [pendingInput, setPendingInput] = useState<SplitCashierItemsInput | null>(null);
  const [result, setResult] = useState<ResultState>(null);

  const tablesQuery = useQuery({
    queryKey: ["cashier", "tables", branchId],
    enabled: Boolean(accessToken && branchId),
    queryFn: () => listCashierTables(accessToken as string, branchId as string),
    retry: 1,
    staleTime: 60_000,
  });

  const tableOptions = useMemo(
    () =>
      (tablesQuery.data || []).filter((table) => table.id && table.id !== order.tableId && table.isActive !== false),
    [order.tableId, tablesQuery.data],
  );

  const validation = validateResolutionItemSelection({
    order,
    quantities,
    requireReason: true,
    reason,
  });

  const mutation = useMutation({
    mutationFn: async (input: SplitCashierItemsInput) => {
      if (!accessToken || !branchId) throw new Error("Cashier session is missing.");
      return splitCashierItems({
        token: accessToken,
        branchId,
        orderId: order.id,
        idempotencyKey: buildCashierIdempotencyKey({
          operation: "split-items",
          orderId: order.id,
        }),
        input,
      });
    },
    onSuccess: async (response) => {
      const childLabel = response.childOrder?.orderNumber || response.childOrder?.id || "child order";
      setResult({
        tone: "success",
        title: "Items split to child order.",
        message: `${childLabel} was created in NEW status. Service/KDS workflow is not triggered from cashier.`,
      });
      setQuantities({});
      setReason("");
      setNotes("");
      setTargetTableId("");
      setPendingInput(null);
      await onRefresh();
    },
    onError: (error) => {
      setResult({
        tone: "danger",
        title: "Split items failed.",
        message: mapCashierResolutionError(error, "Could not split items."),
      });
    },
  });

  const disabled = disabledReasons.length > 0 || mutation.isPending;
  const submitReasons = disabledReasons.concat(validation.reasons);

  function setLineQuantity(lineId: string, quantity: number) {
    setQuantities((current) => ({ ...current, [lineId]: quantity }));
  }

  function buildInput(): SplitCashierItemsInput {
    return {
      items: validation.selected,
      targetTableId: targetTableId || undefined,
      reason: reason.trim(),
      notes: notes.trim() || undefined,
    };
  }

  return (
    <section className="rounded-lg bg-surface-muted p-4" aria-labelledby="cashier-split-items-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ArrowsSplit size={22} weight="bold" className="text-brand-navy-900" aria-hidden />
            <h4 id="cashier-split-items-title" className="font-bold text-text-primary">
              Split items
            </h4>
          </div>
          <p className="mt-1 text-sm font-medium text-text-secondary">
            Creates a new child order. It does not send the child order to KDS from cashier.
          </p>
        </div>
        <Badge variant="warning">Child order NEW</Badge>
      </div>

      <div className="mt-4">
        <StatusMessage tone="warning" title="KDS boundary">
          <span>
            Split items creates a new child order in NEW status. The child order is not automatically sent to KDS and
            may not appear in the payable queue until service workflow continues.
          </span>
        </StatusMessage>
      </div>

      {result ? (
        <div className="mt-4">
          <CashierResolutionResultNotice tone={result.tone} title={result.title} message={result.message} />
        </div>
      ) : null}

      <div className="mt-4">
        <CashierSplitItemSelector
          order={order}
          quantities={quantities}
          disabled={disabled}
          onQuantityChange={setLineQuantity}
        />
      </div>

      <div className="mt-4 grid gap-3">
        <label className="block text-sm font-semibold text-text-primary" htmlFor="cashier-split-item-target-table">
          Optional target table
        </label>
        <select
          id="cashier-split-item-target-table"
          className="min-h-11 w-full rounded-md bg-surface px-4 text-base text-text-primary shadow-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy-900 disabled:bg-surface-muted disabled:text-text-muted"
          value={targetTableId}
          disabled={disabled || tablesQuery.isLoading || tablesQuery.isError}
          onChange={(event) => setTargetTableId(event.target.value)}
        >
          <option value="">Keep source table</option>
          {tableOptions.map((table) => (
            <option key={table.id} value={table.id}>
              {table.label || table.id}
            </option>
          ))}
        </select>

        {tablesQuery.isError ? (
          <p className="text-sm font-medium text-status-warning">
            Table list did not load. Split can still proceed without target table reassignment.
          </p>
        ) : null}

        <label className="block text-sm font-semibold text-text-primary" htmlFor="cashier-split-item-reason">
          Reason
        </label>
        <Input
          id="cashier-split-item-reason"
          value={reason}
          disabled={disabled}
          maxLength={200}
          placeholder="Required"
          onChange={(event) => setReason(event.target.value)}
        />

        <label className="block text-sm font-semibold text-text-primary" htmlFor="cashier-split-item-notes">
          Notes
        </label>
        <Input
          id="cashier-split-item-notes"
          value={notes}
          disabled={disabled}
          maxLength={200}
          placeholder="Optional"
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      {submitReasons.length ? (
        <div className="mt-4">
          <StatusMessage tone="warning" title="Split items cannot run yet.">
            <span>{submitReasons[0]}</span>
          </StatusMessage>
        </div>
      ) : null}

      <div className="mt-4 flex justify-end">
        <Button
          leadingIcon={<CheckCircle size={18} weight="bold" aria-hidden />}
          disabled={submitReasons.length > 0 || disabled}
          onClick={() => setPendingInput(buildInput())}
        >
          Split items
        </Button>
      </div>

      <CashierResolutionConfirmDialog
        open={Boolean(pendingInput)}
        title="Split selected items?"
        confirmLabel="Create child order"
        isSubmitting={mutation.isPending}
        onCancel={() => setPendingInput(null)}
        onConfirm={() => pendingInput && mutation.mutate(pendingInput)}
      >
        <p>
          This creates a child order in NEW status and does not send it to KDS. Continue only if service workflow will
          handle the child order.
        </p>
      </CashierResolutionConfirmDialog>
    </section>
  );
}
