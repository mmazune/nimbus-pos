import { FormEvent, useMemo, useState } from "react";

import { Button, Input, StatusMessage } from "@/components/ui";
import type { CashierOpenTillInput } from "@/lib/cashier/till-types";
import { validateOpenTillInput } from "@/lib/cashier/till-validation";

import { CashierTillBlockedBanner } from "./CashierTillBlockedBanner";

type CashierOpenTillPanelProps = {
  disabledReasons: string[];
  isSubmitting?: boolean;
  error?: string | null;
  onConfirm: (input: CashierOpenTillInput) => void;
};

export function CashierOpenTillPanel({
  disabledReasons,
  isSubmitting,
  error,
  onConfirm,
}: CashierOpenTillPanelProps) {
  const [tillCode, setTillCode] = useState("");
  const [openingFloat, setOpeningFloat] = useState("");
  const [notes, setNotes] = useState("");

  const validation = useMemo(
    () => validateOpenTillInput({ tillCode, openingFloat, notes }),
    [notes, openingFloat, tillCode],
  );
  const blocked = disabledReasons.length > 0;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blocked || !validation.canSubmit || !validation.value) return;
    onConfirm(validation.value);
  }

  return (
    <section className="rounded-lg bg-surface p-5 shadow-subtle" aria-labelledby="cashier-open-till-title">
      <h2 id="cashier-open-till-title" className="text-lg font-bold text-text-primary">
        Open Till
      </h2>
      <p className="mt-1 text-sm leading-6 text-text-secondary">
        Cash checkout stays blocked until a till is active.
      </p>

      <form className="mt-4 space-y-4" onSubmit={submit}>
        <label className="block" htmlFor="cashier-open-till-code">
          <span className="text-sm font-semibold text-text-secondary">Till Code</span>
          <Input
            id="cashier-open-till-code"
            name="tillCode"
            className="mt-2"
            value={tillCode}
            onChange={(event) => setTillCode(event.target.value)}
            placeholder="TILL-01..."
            autoComplete="off"
            disabled={isSubmitting || blocked}
          />
        </label>

        <label className="block" htmlFor="cashier-opening-float">
          <span className="text-sm font-semibold text-text-secondary">Opening Float</span>
          <Input
            id="cashier-opening-float"
            name="openingFloat"
            className="mt-2 tabular-nums"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={openingFloat}
            onChange={(event) => setOpeningFloat(event.target.value)}
            placeholder="50000.00..."
            disabled={isSubmitting || blocked}
          />
        </label>

        <label className="block" htmlFor="cashier-open-till-notes">
          <span className="text-sm font-semibold text-text-secondary">Notes</span>
          <Input
            id="cashier-open-till-notes"
            name="notes"
            className="mt-2"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional opening note..."
            autoComplete="off"
            disabled={isSubmitting || blocked}
          />
        </label>

        <CashierTillBlockedBanner reasons={disabledReasons} />

        {validation.reasons.length && !blocked ? (
          <p className="text-sm font-semibold text-status-danger" id="cashier-open-till-error">
            {validation.reasons[0]}
          </p>
        ) : null}
        {error ? <StatusMessage tone="danger" title="Open till failed">{error}</StatusMessage> : null}

        <Button size="pos" type="submit" disabled={isSubmitting || blocked || !validation.canSubmit} className="w-full">
          {isSubmitting ? "Opening..." : "Open Till"}
        </Button>
      </form>
    </section>
  );
}
