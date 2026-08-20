import { CheckCircle, Table } from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Button, Input } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthProvider";
import { buildCashierIdempotencyKey } from "@/lib/cashier/idempotency";
import type { CashierOrderViewModel } from "@/lib/cashier/order-types";
import { listCashierTables, transferCashierOrderTable } from "@/lib/cashier/resolution";
import type { TransferCashierOrderTableInput } from "@/lib/cashier/resolution-types";
import { mapCashierResolutionError } from "@/lib/cashier/resolution-validation";

import { CashierResolutionConfirmDialog } from "./CashierResolutionConfirmDialog";
import { CashierResolutionResultNotice } from "./CashierResolutionResultNotice";
import { formatOperationalTableLabel } from "@/components/floor/formatters";

type CashierTransferTablePanelProps = {
  order: CashierOrderViewModel;
  disabledReasons: string[];
  onRefresh: () => Promise<void>;
};

type ResultState = {
  tone: "success" | "danger";
  title: string;
  message?: string;
} | null;

export function CashierTransferTablePanel({ order, disabledReasons, onRefresh }: CashierTransferTablePanelProps) {
  const { accessToken, branchId } = useAuth();
  const [targetTableId, setTargetTableId] = useState("");
  const [reason, setReason] = useState("");
  const [pendingInput, setPendingInput] = useState<TransferCashierOrderTableInput | null>(null);
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

  const submitReasons = [...disabledReasons];
  if (tablesQuery.isLoading) submitReasons.push("Table list is loading.");
  if (tablesQuery.isError) submitReasons.push("Table list did not load.");
  if (!tableOptions.length && !tablesQuery.isLoading && !tablesQuery.isError) {
    submitReasons.push("No active target tables are available.");
  }
  if (!targetTableId) submitReasons.push("Choose a target table.");
  if (!reason.trim()) submitReasons.push("Reason is required.");

  const mutation = useMutation({
    mutationFn: async (input: TransferCashierOrderTableInput) => {
      if (!accessToken || !branchId) throw new Error("Cashier session is missing.");
      return transferCashierOrderTable({
        token: accessToken,
        branchId,
        orderId: order.id,
        idempotencyKey: buildCashierIdempotencyKey({
          operation: "transfer-table",
          orderId: order.id,
          method: input.targetTableId,
        }),
        input,
      });
    },
    onSuccess: async (response) => {
      setResult({
        tone: "success",
        title: "Table transferred.",
        message: response.table?.label ? `Order moved to ${response.table.label}.` : "Order table assignment was updated.",
      });
      setTargetTableId("");
      setReason("");
      setPendingInput(null);
      await onRefresh();
    },
    onError: (error) => {
      setResult({
        tone: "danger",
        title: "Table transfer failed.",
        message: mapCashierResolutionError(error, "Could not transfer table."),
      });
    },
  });

  const disabled = disabledReasons.length > 0 || mutation.isPending;

  return (
    <section className="rounded-md bg-surface p-3 shadow-subtle" aria-labelledby="cashier-transfer-table-title">
      <div className="flex items-center gap-2">
        <Table size={20} weight="bold" className="text-brand-navy-900" aria-hidden />
        <h5 id="cashier-transfer-table-title" className="font-bold text-text-primary">
          Transfer table
        </h5>
      </div>
      <p className="mt-1 text-sm font-medium text-text-secondary">
        Changes table assignment only. It does not alter payments or KDS work.
      </p>

      {result ? (
        <div className="mt-3">
          <CashierResolutionResultNotice tone={result.tone} title={result.title} message={result.message} />
        </div>
      ) : null}

      <div className="mt-3 grid gap-3">
        <select
          className="min-h-11 w-full rounded-md bg-surface-muted px-4 text-base text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy-900 disabled:text-text-muted"
          value={targetTableId}
          disabled={disabled || tablesQuery.isLoading || tablesQuery.isError}
          aria-label="Transfer target table"
          onChange={(event) => setTargetTableId(event.target.value)}
        >
          <option value="">Choose target table</option>
          {tableOptions.map((table) => (
            <option key={table.id} value={table.id}>
              <span title={table.label || table.id}>{formatOperationalTableLabel(table.label) || table.label || table.id}</span>
            </option>
          ))}
        </select>
        <Input
          value={reason}
          disabled={disabled}
          maxLength={200}
          placeholder="Reason required"
          aria-label="Table transfer reason"
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
              targetTableId,
              reason: reason.trim(),
            })
          }
        >
          Transfer
        </Button>
      </div>

      <CashierResolutionConfirmDialog
        open={Boolean(pendingInput)}
        title="Transfer this table?"
        confirmLabel="Transfer table"
        isSubmitting={mutation.isPending}
        onCancel={() => setPendingInput(null)}
        onConfirm={() => pendingInput && mutation.mutate(pendingInput)}
      >
        <p>This updates the order table assignment only. Payment and KDS state remain governed by backend workflow.</p>
      </CashierResolutionConfirmDialog>
    </section>
  );
}
