import { FormEvent, useMemo, useState } from "react";

import { Button, Input, StatusMessage } from "@/components/ui";
import type {
  CashierReceiptSendChannel,
  CashierReceiptSendInput,
  CashierReceiptViewModel,
} from "@/lib/cashier/receipt-types";
import {
  CASHIER_RECEIPT_SEND_CHANNELS,
  validateReceiptSendInput,
} from "@/lib/cashier/receipt-validation";

import { CashierReceiptCaveatBanner } from "./CashierReceiptCaveatBanner";

type CashierReceiptSendDialogProps = {
  receipt: CashierReceiptViewModel;
  isSubmitting?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (input: CashierReceiptSendInput) => void;
};

export function CashierReceiptSendDialog({
  receipt,
  isSubmitting,
  error,
  onCancel,
  onSubmit,
}: CashierReceiptSendDialogProps) {
  const [channel, setChannel] = useState<CashierReceiptSendChannel>("email");
  const [recipient, setRecipient] = useState("");
  const [locale, setLocale] = useState("");
  const [note, setNote] = useState("");

  const input = useMemo(
    () => ({
      channel,
      recipient: recipient.trim(),
      locale: locale.trim() || undefined,
      note: note.trim() || undefined,
    }),
    [channel, locale, note, recipient],
  );
  const validation = validateReceiptSendInput(input);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validation.canSubmit) return;
    onSubmit(input);
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-brand-navy-950/40 px-6">
      <form
        className="w-full max-w-[500px] rounded-lg bg-page p-5 shadow-overlay"
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cashier-send-title"
      >
        <h2 id="cashier-send-title" className="text-xl font-bold tracking-normal text-text-primary">
          Record Send Request
        </h2>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          Record a pending digital receipt request for {receipt.receiptNumber}.
        </p>

        <div className="mt-4">
          <CashierReceiptCaveatBanner type="send" />
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm font-semibold text-text-secondary">Channel</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {CASHIER_RECEIPT_SEND_CHANNELS.map((option) => (
              <label
                key={option.id}
                className={`flex min-h-11 cursor-pointer items-center justify-center rounded-md px-3 text-sm font-semibold transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96] ${
                  channel === option.id
                    ? "bg-brand-navy-900 text-text-inverse shadow-subtle"
                    : "bg-surface-muted text-text-secondary hover:bg-surface"
                }`}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name="receiptChannel"
                  value={option.id}
                  checked={channel === option.id}
                  onChange={() => setChannel(option.id)}
                  disabled={isSubmitting}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="mt-4 block" htmlFor="cashier-send-recipient">
          <span className="text-sm font-semibold text-text-secondary">Recipient</span>
          <Input
            id="cashier-send-recipient"
            name="recipient"
            className="mt-2"
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            placeholder={channel === "email" ? "guest@example.com..." : "+256700000000..."}
            autoComplete="off"
            spellCheck={false}
            disabled={isSubmitting}
          />
        </label>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label htmlFor="cashier-send-locale">
            <span className="text-sm font-semibold text-text-secondary">Locale</span>
            <Input
              id="cashier-send-locale"
              name="locale"
              className="mt-2"
              value={locale}
              onChange={(event) => setLocale(event.target.value)}
              placeholder="en-UG..."
              autoComplete="off"
              disabled={isSubmitting}
            />
          </label>
          <label htmlFor="cashier-send-note">
            <span className="text-sm font-semibold text-text-secondary">Note</span>
            <Input
              id="cashier-send-note"
              name="note"
              className="mt-2"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional note..."
              autoComplete="off"
              disabled={isSubmitting}
            />
          </label>
        </div>

        {validation.reasons.length ? (
          <p className="mt-3 text-sm font-semibold text-status-danger" id="cashier-send-error">
            {validation.reasons[0]}
          </p>
        ) : null}
        {error ? (
          <div className="mt-3">
            <StatusMessage tone="danger" title="Send request failed.">
              {error}
            </StatusMessage>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="secondary" size="pos" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button size="pos" type="submit" disabled={isSubmitting || !validation.canSubmit}>
            {isSubmitting ? "Recording..." : "Record send request"}
          </Button>
        </div>
      </form>
    </div>
  );
}
