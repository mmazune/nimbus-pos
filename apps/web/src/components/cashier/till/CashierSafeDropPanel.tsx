import { FormEvent, useMemo, useState } from "react";

import { Button, Input, StatusMessage } from "@/components/ui";
import { formatCashierMoney } from "@/lib/cashier/formatters";
import type { CashierSafeDropInput, CashierTillViewModel } from "@/lib/cashier/till-types";
import { validateSafeDropInput } from "@/lib/cashier/till-validation";

import { CashierTillBlockedBanner } from "./CashierTillBlockedBanner";

type CashierSafeDropPanelProps = {
  till: CashierTillViewModel | null;
  disabledReasons: string[];
  isSubmitting?: boolean;
  error?: string | null;
  onConfirm: (input: CashierSafeDropInput) => void;
};

export function CashierSafeDropPanel({
  till,
  disabledReasons,
  isSubmitting,
  error,
  onConfirm,
}: CashierSafeDropPanelProps) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const validation = useMemo(
    () => validateSafeDropInput({ amount, reason, expectedCash: till?.expectedCash }),
    [amount, reason, till?.expectedCash],
  );
  const blocked = disabledReasons.length > 0;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blocked || !validation.canSubmit || !validation.value) return;
    onConfirm(validation.value);
  }

  return (
    <section className="rounded-lg bg-surface p-5 shadow-subtle" aria-labelledby="cashier-safe-drop-title">
      <h2 id="cashier-safe-drop-title" className="text-lg font-bold text-text-primary">
        Safe Drop
      </h2>
      <p className="mt-1 text-sm leading-6 text-text-secondary">
        Expected cash: <span className="font-semibold tabular-nums">{formatCashierMoney(till?.expectedCash, till?.currencyCode)}</span>
      </p>

      <form className="mt-4 space-y-4" onSubmit={submit}>
        <label className="block" htmlFor="cashier-safe-drop-amount">
          <span className="text-sm font-semibold text-text-secondary">Amount</span>
          <Input
            id="cashier-safe-drop-amount"
            name="amount"
            className="mt-2 tabular-nums"
            type="number"
            min={0.01}
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="10000.00..."
            disabled={isSubmitting || blocked}
          />
        </label>

        <label className="block" htmlFor="cashier-safe-drop-reason">
          <span className="text-sm font-semibold text-text-secondary">Reason</span>
          <Input
            id="cashier-safe-drop-reason"
            name="reason"
            className="mt-2"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Excess cash removal..."
            autoComplete="off"
            disabled={isSubmitting || blocked}
          />
        </label>

        <CashierTillBlockedBanner reasons={disabledReasons} />

        {validation.reasons.length && !blocked ? (
          <p className="text-sm font-semibold text-status-danger" id="cashier-safe-drop-error">
            {validation.reasons[0]}
          </p>
        ) : null}
        {error ? <StatusMessage tone="danger" title="Safe drop failed">{error}</StatusMessage> : null}

        <Button size="pos" type="submit" disabled={isSubmitting || blocked || !validation.canSubmit} className="w-full">
          {isSubmitting ? "Recording..." : "Record Safe Drop"}
        </Button>
      </form>
    </section>
  );
}
