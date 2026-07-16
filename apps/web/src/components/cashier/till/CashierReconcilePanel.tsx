import { FormEvent, useMemo, useState } from "react";

import { Button, Input, StatusMessage } from "@/components/ui";
import { formatCashierMoney } from "@/lib/cashier/formatters";
import type { CashierReconcileTillInput, CashierTillViewModel } from "@/lib/cashier/till-types";
import { validateReconcileInput } from "@/lib/cashier/till-validation";

import { CashierTillBlockedBanner } from "./CashierTillBlockedBanner";

type CashierReconcilePanelProps = {
  till: CashierTillViewModel | null;
  disabledReasons: string[];
  isSubmitting?: boolean;
  error?: string | null;
  onConfirm: (input: CashierReconcileTillInput) => void;
};

export function CashierReconcilePanel({
  till,
  disabledReasons,
  isSubmitting,
  error,
  onConfirm,
}: CashierReconcilePanelProps) {
  const [countedCash, setCountedCash] = useState("");
  const [varianceReason, setVarianceReason] = useState("");
  const [notes, setNotes] = useState("");

  const validation = useMemo(
    () => validateReconcileInput({ countedCash, varianceReason, notes, expectedCash: till?.expectedCash }),
    [countedCash, notes, till?.expectedCash, varianceReason],
  );
  const blocked = disabledReasons.length > 0;
  const variancePrefix = validation.previewVariance !== undefined && validation.previewVariance > 0 ? "+" : "";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blocked || !validation.canSubmit || !validation.value) return;
    onConfirm(validation.value);
  }

  return (
    <section className="rounded-lg bg-surface p-5 shadow-subtle" aria-labelledby="cashier-reconcile-title">
      <h2 id="cashier-reconcile-title" className="text-lg font-bold text-text-primary">
        Reconcile Till
      </h2>
      <p className="mt-1 text-sm leading-6 text-text-secondary">
        Expected cash: <span className="font-semibold tabular-nums">{formatCashierMoney(till?.expectedCash, till?.currencyCode)}</span>
      </p>

      <form className="mt-4 space-y-4" onSubmit={submit}>
        <label className="block" htmlFor="cashier-counted-cash">
          <span className="text-sm font-semibold text-text-secondary">Counted Cash</span>
          <Input
            id="cashier-counted-cash"
            name="countedCash"
            className="mt-2 tabular-nums"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={countedCash}
            onChange={(event) => setCountedCash(event.target.value)}
            placeholder="50000.00..."
            disabled={isSubmitting || blocked}
          />
        </label>

        <div className="rounded-md bg-surface-muted p-4">
          <p className="text-sm font-semibold text-text-secondary">Variance Preview</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-text-primary">
            {validation.previewVariance === undefined
              ? "Unavailable"
              : `${variancePrefix}${formatCashierMoney(validation.previewVariance, till?.currencyCode)}`}
          </p>
          {validation.previewVariance !== undefined && Math.abs(validation.previewVariance) > 0.01 ? (
            <p className="mt-2 text-sm font-semibold text-status-warning">
              Variance is non-zero. A variance reason is required.
            </p>
          ) : null}
        </div>

        <label className="block" htmlFor="cashier-variance-reason">
          <span className="text-sm font-semibold text-text-secondary">Variance Reason</span>
          <Input
            id="cashier-variance-reason"
            name="varianceReason"
            className="mt-2"
            value={varianceReason}
            onChange={(event) => setVarianceReason(event.target.value)}
            placeholder="Reason if count differs..."
            autoComplete="off"
            disabled={isSubmitting || blocked}
          />
        </label>

        <label className="block" htmlFor="cashier-reconcile-notes">
          <span className="text-sm font-semibold text-text-secondary">Notes</span>
          <Input
            id="cashier-reconcile-notes"
            name="notes"
            className="mt-2"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional reconciliation note..."
            autoComplete="off"
            disabled={isSubmitting || blocked}
          />
        </label>

        <CashierTillBlockedBanner reasons={disabledReasons} />

        {validation.reasons.length && !blocked ? (
          <p className="text-sm font-semibold text-status-danger" id="cashier-reconcile-error">
            {validation.reasons[0]}
          </p>
        ) : null}
        {error ? <StatusMessage tone="danger" title="Reconciliation failed">{error}</StatusMessage> : null}

        <Button size="pos" type="submit" disabled={isSubmitting || blocked || !validation.canSubmit} className="w-full">
          {isSubmitting ? "Reconciling..." : "Reconcile Till"}
        </Button>
      </form>
    </section>
  );
}
