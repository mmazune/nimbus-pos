import { ArrowCounterClockwise } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui";
import { asCashierNumber } from "@/lib/cashier/formatters";
import { deriveRefundThresholdState } from "@/lib/cashier/refund-state";
import {
  CASHIER_REFUND_AUTO_APPROVAL_THRESHOLD,
  type CashierRefundPaymentOption,
} from "@/lib/cashier/refund-types";
import { validateRefundInput } from "@/lib/cashier/refund-validation";

import { CashierRefundConfirmDialog } from "./CashierRefundConfirmDialog";
import { CashierRefundPaymentSelector } from "./CashierRefundPaymentSelector";
import { CashierRefundThresholdNotice } from "./CashierRefundThresholdNotice";

type CashierRefundFormProps = {
  paymentOptions: CashierRefundPaymentOption[];
  selectedPaymentId?: string;
  currencyCode?: string | null;
  remainingRefundable?: number;
  blockedReason?: string | null;
  isSubmitting?: boolean;
  onPaymentChange: (paymentId: string) => void;
  onSubmit: (input: { paymentId: string; amount: number; reason: string }) => Promise<void>;
};

export function CashierRefundForm({
  paymentOptions,
  selectedPaymentId,
  currencyCode,
  remainingRefundable,
  blockedReason,
  isSubmitting,
  onPaymentChange,
  onSubmit,
}: CashierRefundFormProps) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selectedPayment = useMemo(
    () => paymentOptions.find((payment) => payment.id === selectedPaymentId),
    [paymentOptions, selectedPaymentId],
  );
  const parsedAmount = asCashierNumber(amount);
  const validation = validateRefundInput({
    amount,
    reason,
    selectedPayment,
    remainingRefundable,
  });
  const showErrors = attempted || Boolean(blockedReason);
  const threshold = deriveRefundThresholdState(parsedAmount, CASHIER_REFUND_AUTO_APPROVAL_THRESHOLD);

  function requestSubmit() {
    setAttempted(true);
    if (!validation.valid || blockedReason) return;
    setConfirmOpen(true);
  }

  async function confirmSubmit() {
    if (!selectedPayment || parsedAmount === undefined || !validation.valid) return;
    await onSubmit({
      paymentId: selectedPayment.id,
      amount: parsedAmount,
      reason: reason.trim(),
    });
    setConfirmOpen(false);
    setAttempted(false);
    setAmount("");
    setReason("");
  }

  return (
    <section className="rounded-lg bg-surface p-4 shadow-subtle" aria-labelledby="cashier-refund-form-title">
      <h3 id="cashier-refund-form-title" className="font-bold text-text-primary">
        Create Refund Request
      </h3>

      <div className="mt-4 grid gap-4">
        <CashierRefundPaymentSelector
          payments={paymentOptions}
          selectedPaymentId={selectedPaymentId}
          currencyCode={currencyCode}
          onChange={onPaymentChange}
        />
        {showErrors && validation.paymentError ? (
          <p className="text-sm font-semibold text-status-danger">{validation.paymentError}</p>
        ) : null}

        <div>
          <label htmlFor="cashier-refund-amount" className="text-sm font-bold text-text-primary">
            Refund amount ({currencyCode || "currency"})
          </label>
          <input
            id="cashier-refund-amount"
            name="refundAmount"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            autoComplete="off"
            value={amount}
            aria-describedby={showErrors && validation.amountError ? "cashier-refund-amount-error" : undefined}
            className="mt-2 min-h-12 w-full rounded-md bg-surface-muted px-3 text-base font-bold tabular-nums text-text-primary outline-none transition-[box-shadow,background-color] duration-150 ease-out focus-visible:bg-surface focus-visible:shadow-focus"
            onChange={(event) => setAmount(event.target.value)}
          />
          {showErrors && validation.amountError ? (
            <p id="cashier-refund-amount-error" className="mt-2 text-sm font-semibold text-status-danger">
              {validation.amountError}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="cashier-refund-reason" className="text-sm font-bold text-text-primary">
            Reason
          </label>
          <textarea
            id="cashier-refund-reason"
            name="refundReason"
            rows={3}
            maxLength={500}
            autoComplete="off"
            value={reason}
            aria-describedby={showErrors && validation.reasonError ? "cashier-refund-reason-error" : undefined}
            className="mt-2 w-full rounded-md bg-surface-muted px-3 py-3 text-sm font-semibold text-text-primary outline-none transition-[box-shadow,background-color] duration-150 ease-out focus-visible:bg-surface focus-visible:shadow-focus"
            onChange={(event) => setReason(event.target.value)}
          />
          {showErrors && validation.reasonError ? (
            <p id="cashier-refund-reason-error" className="mt-2 text-sm font-semibold text-status-danger">
              {validation.reasonError}
            </p>
          ) : null}
        </div>

        <CashierRefundThresholdNotice amount={parsedAmount} currencyCode={currencyCode || "UGX"} />

        <Button
          size="pos"
          leadingIcon={<ArrowCounterClockwise size={20} weight="bold" aria-hidden />}
          disabled={isSubmitting || Boolean(blockedReason)}
          onClick={requestSubmit}
        >
          {isSubmitting ? "Submitting refund..." : "Create refund request"}
        </Button>
      </div>

      <CashierRefundConfirmDialog
        open={confirmOpen}
        amount={parsedAmount}
        currencyCode={currencyCode}
        expectedPending={threshold.overThreshold}
        isSubmitting={isSubmitting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void confirmSubmit()}
      />
    </section>
  );
}
