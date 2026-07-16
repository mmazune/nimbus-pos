import { Badge } from "@/components/ui";
import type { CashierStatusTone } from "@/lib/cashier/order-types";

type CashierQueueStatusBadgeProps = {
  label: string;
  tone: CashierStatusTone;
};

export function CashierQueueStatusBadge({ label, tone }: CashierQueueStatusBadgeProps) {
  return <Badge variant={tone}>{label}</Badge>;
}
