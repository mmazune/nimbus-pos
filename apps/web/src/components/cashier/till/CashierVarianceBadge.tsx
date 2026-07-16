import { Badge } from "@/components/ui";
import { formatCashierMoney } from "@/lib/cashier/formatters";

type CashierVarianceBadgeProps = {
  value?: number;
  currencyCode?: string;
};

export function CashierVarianceBadge({ value, currencyCode }: CashierVarianceBadgeProps) {
  if (value === undefined) return <Badge variant="neutral">Variance unavailable</Badge>;

  const variant = Math.abs(value) <= 0.01 ? "success" : "danger";
  const prefix = value > 0 ? "+" : "";

  return (
    <Badge variant={variant} className="tabular-nums">
      Variance {prefix}
      {formatCashierMoney(value, currencyCode)}
    </Badge>
  );
}
