import { FormEvent, useMemo, useState } from "react";

import { Button, Input, StatusMessage } from "@/components/ui";
import type { CashierReceiptReprintInput, CashierReceiptViewModel } from "@/lib/cashier/receipt-types";
import { validateReceiptReprintInput } from "@/lib/cashier/receipt-validation";

import { CashierReceiptCaveatBanner } from "./CashierReceiptCaveatBanner";

type CashierReceiptReprintDialogProps = {
  receipt: CashierReceiptViewModel;
  isSubmitting?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (input: CashierReceiptReprintInput) => void;
};

export function CashierReceiptReprintDialog({
  receipt,
  isSubmitting,
  error,
  onCancel,
  onSubmit,
}: CashierReceiptReprintDialogProps) {
  const [copies, setCopies] = useState("1");
  const [reason, setReason] = useState("Guest requested a duplicate receipt.");

  const input = useMemo(
    () => ({ copies: Number(copies), reason: reason.trim() || undefined }),
    [copies, reason],
  );
  const validation = validateReceiptReprintInput(input);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validation.canSubmit) return;
    onSubmit({ copies: validation.copies, reason: input.reason });
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-brand-navy-950/40 px-6">
      <form
        className="w-full max-w-[460px] rounded-lg bg-page p-5 shadow-overlay"
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cashier-reprint-title"
      >
        <h2 id="cashier-reprint-title" className="text-xl font-bold tracking-normal text-text-primary">
          Reprint Metadata
        </h2>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          Record a reprint request for {receipt.receiptNumber}.
        </p>

        <div className="mt-4">
          <CashierReceiptCaveatBanner type="print" />
        </div>

        <label className="mt-4 block" htmlFor="cashier-reprint-copies">
          <span className="text-sm font-semibold text-text-secondary">Copies</span>
          <Input
            id="cashier-reprint-copies"
            name="copies"
            className="mt-2"
            type="number"
            min={1}
            max={10}
            inputMode="numeric"
            value={copies}
            onChange={(event) => setCopies(event.target.value)}
            disabled={isSubmitting}
          />
        </label>

        <label className="mt-4 block" htmlFor="cashier-reprint-reason">
          <span className="text-sm font-semibold text-text-secondary">Reason</span>
          <Input
            id="cashier-reprint-reason"
            name="reason"
            className="mt-2"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Guest requested a duplicate receipt..."
            autoComplete="off"
            disabled={isSubmitting}
          />
        </label>

        {validation.reasons.length ? (
          <p className="mt-3 text-sm font-semibold text-status-danger" id="cashier-reprint-error">
            {validation.reasons[0]}
          </p>
        ) : null}
        {error ? (
          <div className="mt-3">
            <StatusMessage tone="danger" title="Reprint request failed.">
              {error}
            </StatusMessage>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="secondary" size="pos" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button size="pos" type="submit" disabled={isSubmitting || !validation.canSubmit}>
            {isSubmitting ? "Recording..." : "Record reprint request"}
          </Button>
        </div>
      </form>
    </div>
  );
}
