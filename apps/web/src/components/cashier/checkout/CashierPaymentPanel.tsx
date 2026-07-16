import { FormEvent, useEffect, useMemo, useState } from "react";

import { Badge, Button } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatCashierMoney } from "@/lib/cashier/formatters";
import { buildCashierIdempotencyKey } from "@/lib/cashier/idempotency";
import type { CashierOrderViewModel } from "@/lib/cashier/order-types";
import type { CashierManualReferenceMethod, CashierPaymentMethodId } from "@/lib/cashier/payment-types";
import {
  cents,
  formatCashierAmountInput,
  getCashierOutstandingAmount,
  getCashierPaymentMethod,
  mapCashierMutationError,
  validateCashierPaymentInput,
} from "@/lib/cashier/payment-validation";
import { closeCashierOrder, createCashierManualReferencePayment } from "@/lib/cashier/payments";
import type { CashierReadinessSnapshot } from "@/lib/cashier/readiness";

import { CashierCloseOrderPanel } from "./CashierCloseOrderPanel";
import { CashierManualReferenceFields } from "./CashierManualReferenceFields";
import { CashierPaymentAmountField } from "./CashierPaymentAmountField";
import { CashierPaymentBlockedBanner } from "./CashierPaymentBlockedBanner";
import { CashierPaymentHistory } from "./CashierPaymentHistory";
import { CashierPaymentMethodSelector } from "./CashierPaymentMethodSelector";
import { CashierPaymentResultNotice } from "./CashierPaymentResultNotice";
import { CashierSettlementSummary } from "./CashierSettlementSummary";

type CashierPaymentPanelProps = {
  order: CashierOrderViewModel;
  readiness: CashierReadinessSnapshot;
  paymentSummaryBlocked?: boolean;
  onRefresh: () => Promise<void>;
};

type ResultNotice = {
  tone: "success" | "danger";
  title: string;
  detail?: string;
};

export function CashierPaymentPanel({
  order,
  readiness,
  paymentSummaryBlocked,
  onRefresh,
}: CashierPaymentPanelProps) {
  const { accessToken, branchId } = useAuth();
  const [methodId, setMethodId] = useState<CashierPaymentMethodId>("CASH");
  const [amountInput, setAmountInput] = useState("");
  const [reference, setReference] = useState("");
  const [payerPhone, setPayerPhone] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ResultNotice | null>(null);

  const method = getCashierPaymentMethod(methodId);
  const outstanding = getCashierOutstandingAmount(order);

  useEffect(() => {
    setAmountInput(formatCashierAmountInput(outstanding));
    setReference("");
    setPayerPhone("");
    setNote("");
    setResult(null);
  }, [methodId, order.id, outstanding]);

  const validation = useMemo(
    () =>
      validateCashierPaymentInput({
        amountInput,
        methodId,
        order,
        readiness,
        reference,
        paymentSummaryBlocked,
      }),
    [amountInput, methodId, order, paymentSummaryBlocked, readiness, reference],
  );

  const amountError = validation.reasons.find((reason) => reason.startsWith("Amount") || reason.startsWith("Use "));
  const expectedRemaining =
    validation.amount === undefined ? outstanding : Math.max(0, outstanding - validation.amount);
  const canSubmit = validation.canSubmit && Boolean(accessToken && branchId) && !isSubmitting;
  const isManualReference = method.id !== "CASH";

  async function refreshAfterMutation() {
    await onRefresh();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !accessToken || !branchId || validation.amount === undefined) return;

    setIsSubmitting(true);
    setResult(null);

    const idempotencyKey = buildCashierIdempotencyKey({
      operation: method.id === "CASH" ? "close-order" : "manual-reference",
      orderId: order.id,
      method: method.id,
    });

    try {
      if (method.id === "CASH") {
        const response = await closeCashierOrder({
          token: accessToken,
          branchId,
          orderId: order.id,
          idempotencyKey,
          input: {
            payments: [
              {
                method: "CASH",
                amount: validation.amount,
                metadata: {
                  capture: "cashier_final_cash_close",
                },
              },
            ],
            reason: note.trim() || undefined,
          },
        });
        await refreshAfterMutation();
        setResult({
          tone: "success",
          title: "Order closed.",
          detail:
            cents(Number(response.changeDue || 0)) && Number(response.changeDue || 0) > 0
              ? `Change due ${formatCashierMoney(response.changeDue, order.currencyCode)}.`
              : "Cash payment recorded with final settlement.",
        });
      } else {
        const backendMethod = method.backendMethod as CashierManualReferenceMethod;
        const response = await createCashierManualReferencePayment({
          token: accessToken,
          branchId,
          idempotencyKey,
          input: {
            orderId: order.id,
            method: backendMethod,
            provider: method.provider,
            amount: validation.amount,
            externalTransactionId: reference.trim(),
            payerPhone: payerPhone.trim() || undefined,
            note: note.trim() || undefined,
          },
        });
        await refreshAfterMutation();
        setResult({
          tone: "success",
          title: response.autoSettled ? "Payment recorded. Order closed." : "Payment recorded.",
          detail: response.autoSettled
            ? "Receipt can be viewed from Receipts."
            : "Payment summary refreshed for the remaining balance.",
        });
        setReference("");
        setPayerPhone("");
        setNote("");
      }
    } catch (error) {
      setResult({
        tone: "danger",
        title: "Payment failed.",
        detail: mapCashierMutationError(error, "Could not record the payment."),
      });
      await refreshAfterMutation();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-5" aria-labelledby="cashier-payment-panel-title">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-text-secondary">Checkout</p>
            <h3 id="cashier-payment-panel-title" className="mt-1 text-xl font-bold tracking-normal text-text-primary">
              Payment entry
            </h3>
          </div>
          <Badge variant={order.payment.tone}>{order.payment.label}</Badge>
        </div>
        <p className="mt-2 text-sm font-medium text-text-secondary">
          PesaPal is owner SaaS billing only, excluded from diner checkout.
        </p>
      </div>

      <CashierSettlementSummary order={order} />

      <form className="space-y-4" onSubmit={handleSubmit}>
        <CashierPaymentMethodSelector
          value={methodId}
          onChange={setMethodId}
          cashBlocked={readiness.till.status !== "active"}
        />

        <div className="rounded-md bg-surface-muted p-3 text-sm font-semibold text-text-secondary">
          {method.caveat}
        </div>

        <CashierPaymentAmountField
          value={amountInput}
          onChange={setAmountInput}
          outstanding={outstanding}
          currencyCode={order.currencyCode}
          error={amountError}
          disabled={isSubmitting}
        />

        {isManualReference ? (
          <CashierManualReferenceFields
            reference={reference}
            onReferenceChange={setReference}
            payerPhone={payerPhone}
            onPayerPhoneChange={setPayerPhone}
            note={note}
            onNoteChange={setNote}
            showPhone={method.provider === "MTN" || method.provider === "AIRTEL"}
            referenceRequired={method.requiresReference}
            disabled={isSubmitting}
          />
        ) : (
          <label className="block">
            <span className="text-sm font-semibold text-text-secondary">Cash note</span>
            <input
              className="mt-2 min-h-11 w-full rounded-md bg-surface px-4 text-base text-text-primary shadow-subtle transition-[background-color,box-shadow] duration-150 ease-out placeholder:text-text-muted disabled:bg-surface-muted disabled:text-text-muted"
              name="cashierCashNote"
              autoComplete="off"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional note"
              disabled={isSubmitting}
            />
          </label>
        )}

        <div className="rounded-md bg-surface-muted p-3 text-sm font-medium text-text-secondary">
          After this payment, remaining balance will be{" "}
          <span className="font-bold tabular-nums text-text-primary">
            {formatCashierMoney(expectedRemaining, order.currencyCode)}
          </span>
          .
        </div>

        <CashierPaymentBlockedBanner reasons={validation.reasons} />

        <Button className="w-full" size="pos" type="submit" disabled={!canSubmit}>
          {isSubmitting
            ? "Processing"
            : method.id === "CASH"
              ? "Close with cash payment"
              : `Record ${method.shortLabel} reference`}
        </Button>
      </form>

      {result ? (
        <CashierPaymentResultNotice tone={result.tone} title={result.title} detail={result.detail} />
      ) : null}

      <div>
        <h3 className="font-bold text-text-primary">Payment history</h3>
        <div className="mt-3">
          <CashierPaymentHistory order={order} />
        </div>
      </div>

      <CashierCloseOrderPanel order={order} />
    </section>
  );
}
