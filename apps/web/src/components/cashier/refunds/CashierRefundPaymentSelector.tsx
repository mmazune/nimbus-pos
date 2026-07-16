import { CreditCard, Money } from "@phosphor-icons/react";

import { formatCashierDateTime, formatCashierMoney, titleCaseCashier } from "@/lib/cashier/formatters";
import type { CashierRefundPaymentOption } from "@/lib/cashier/refund-types";
import { cn } from "@/lib/utils/cn";

type CashierRefundPaymentSelectorProps = {
  payments: CashierRefundPaymentOption[];
  selectedPaymentId?: string;
  currencyCode?: string | null;
  onChange: (paymentId: string) => void;
};

export function CashierRefundPaymentSelector({
  payments,
  selectedPaymentId,
  currencyCode,
  onChange,
}: CashierRefundPaymentSelectorProps) {
  return (
    <section className="rounded-lg bg-surface p-4 shadow-subtle" aria-labelledby="cashier-refund-payment-title">
      <h3 id="cashier-refund-payment-title" className="font-bold text-text-primary">
        Payment Selection
      </h3>

      {payments.length === 0 ? (
        <p className="mt-3 rounded-md bg-surface-muted p-3 text-sm font-semibold text-text-secondary">
          No refundable payment exists for this order.
        </p>
      ) : (
        <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Refund payment">
          {payments.map((option) => {
            const selected = option.id === selectedPaymentId;
            const disabled = Boolean(option.disabledReason);
            const Icon = option.method === "CASH" ? Money : CreditCard;

            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${titleCaseCashier(option.method)} payment ${formatCashierMoney(option.amount, currencyCode)}`}
                disabled={disabled}
                title={option.disabledReason || "Select payment for refund"}
                className={cn(
                  "min-h-16 rounded-md p-3 text-left",
                  "transition-[background-color,box-shadow,transform] duration-150 ease-out",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy-900",
                  !disabled && "active:scale-[0.96]",
                  selected ? "bg-brand-navy-900 text-text-inverse shadow-subtle" : "bg-surface-muted text-text-primary hover:bg-surface",
                  disabled && "cursor-not-allowed opacity-60 hover:bg-surface-muted",
                )}
                onClick={() => onChange(option.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon size={20} weight="bold" aria-hidden />
                      <p className="font-bold">{titleCaseCashier(option.method)}</p>
                    </div>
                    <p className={cn("mt-1 text-xs font-semibold", selected ? "text-text-inverse" : "text-text-secondary")}>
                      {option.provider ? `Provider ${option.provider}` : "Provider follows payment method"}
                      {option.reference ? ` - Ref ${option.reference}` : ""}
                    </p>
                    <p className={cn("mt-1 text-xs font-semibold", selected ? "text-text-inverse" : "text-text-muted")}>
                      {option.postedAt ? formatCashierDateTime(option.postedAt) : "Posted time unavailable"}
                    </p>
                    {option.disabledReason ? (
                      <p className="mt-2 text-xs font-bold">{option.disabledReason}</p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold tabular-nums">{formatCashierMoney(option.amount, currencyCode)}</p>
                    <p className={cn("mt-1 text-xs font-semibold", selected ? "text-text-inverse" : "text-text-muted")}>
                      Refundable {formatCashierMoney(option.refundableAmount, currencyCode)}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
