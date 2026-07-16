import { Input } from "@/components/ui";
import { formatCashierMoney } from "@/lib/cashier/formatters";

type CashierPaymentAmountFieldProps = {
  value: string;
  onChange: (value: string) => void;
  outstanding: number;
  currencyCode?: string;
  error?: string;
  disabled?: boolean;
};

export function CashierPaymentAmountField({
  value,
  onChange,
  outstanding,
  currencyCode,
  error,
  disabled,
}: CashierPaymentAmountFieldProps) {
  const errorId = "cashier-payment-amount-error";

  return (
    <label className="block">
      <span className="flex items-center justify-between gap-3 text-sm font-semibold text-text-secondary">
        <span>Amount</span>
        <span className="tabular-nums text-text-muted">
          Outstanding {formatCashierMoney(outstanding, currencyCode)}
        </span>
      </span>
      <Input
        className="mt-2 font-bold tabular-nums"
        name="cashierPaymentAmount"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="0.00"
        aria-describedby={error ? errorId : undefined}
        disabled={disabled}
      />
      {error ? (
        <span id={errorId} className="mt-2 block text-sm font-semibold text-status-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}
