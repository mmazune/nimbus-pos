import { Badge } from "@/components/ui";
import type { CashierStatusTone } from "@/lib/cashier/order-types";

type CashierReceiptStatusBadgeProps = {
  label: string;
  tone?: CashierStatusTone;
};

export function CashierReceiptStatusBadge({
  label,
  tone = "neutral",
}: CashierReceiptStatusBadgeProps) {
  return <Badge variant={tone}>{label}</Badge>;
}
