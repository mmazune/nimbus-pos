import { Badge } from "@/components/ui";
import type { CashierStatusTone } from "@/lib/cashier/order-types";

type CashierRefundStatusBadgeProps = {
  label: string;
  tone: CashierStatusTone;
};

export function CashierRefundStatusBadge({ label, tone }: CashierRefundStatusBadgeProps) {
  return <Badge variant={tone}>{label}</Badge>;
}
