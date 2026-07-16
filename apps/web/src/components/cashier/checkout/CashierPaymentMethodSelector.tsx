import { Bank, CreditCard, DeviceMobile, Money } from "@phosphor-icons/react";

import { Badge } from "@/components/ui";
import { CASHIER_PAYMENT_METHODS } from "@/lib/cashier/payment-validation";
import type { CashierPaymentMethodId } from "@/lib/cashier/payment-types";
import { cn } from "@/lib/utils/cn";

type CashierPaymentMethodSelectorProps = {
  value: CashierPaymentMethodId;
  onChange: (value: CashierPaymentMethodId) => void;
  cashBlocked?: boolean;
};

function methodIcon(methodId: CashierPaymentMethodId) {
  if (methodId === "CASH") return Money;
  if (methodId === "CARD_REFERENCE") return CreditCard;
  if (methodId === "BANK_TRANSFER") return Bank;
  return DeviceMobile;
}

export function CashierPaymentMethodSelector({
  value,
  onChange,
  cashBlocked,
}: CashierPaymentMethodSelectorProps) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-text-secondary">Payment method</legend>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {CASHIER_PAYMENT_METHODS.map((method) => {
          const Icon = methodIcon(method.id);
          const selected = value === method.id;
          const blocked = method.id === "CASH" && cashBlocked;

          return (
            <label
              key={method.id}
              className={cn(
                "flex min-h-[74px] cursor-pointer flex-col justify-between rounded-md bg-surface-muted p-3 shadow-subtle",
                "transition-[background-color,box-shadow,transform] duration-150 ease-out active:scale-[0.96]",
                "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-navy-900",
                selected ? "bg-brand-navy-900 text-text-inverse" : "text-text-primary hover:bg-surface",
                blocked && !selected ? "opacity-70" : "",
              )}
            >
              <input
                className="sr-only"
                type="radio"
                name="cashier-payment-method"
                value={method.id}
                checked={selected}
                onChange={() => onChange(method.id)}
              />
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-bold">
                  <Icon size={20} weight="bold" aria-hidden />
                  {method.shortLabel}
                </span>
                {blocked ? <Badge variant="warning">Till</Badge> : null}
              </span>
              <span className={cn("mt-2 text-xs font-semibold", selected ? "text-brand-silver" : "text-text-secondary")}>
                {method.supportsPartial ? "Split tender" : "Final cash close"}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
