import { Badge } from "@/components/ui";
import {
  getPaymentStateLabel,
  getPaymentStateTone,
  getSupervisorOrderStatusLabel,
  type SupervisorOrderStatus,
  type SupervisorPaymentState,
} from "@/lib/supervisor/orders";

export function SupervisorOrderStatusBadge({ status }: { status: string | null | undefined }) {
  const normalized = status as SupervisorOrderStatus;
  const variant =
    normalized === "READY"
      ? "success"
      : normalized === "SERVED" || normalized === "IN_KITCHEN"
        ? "info"
        : normalized === "VOIDED"
          ? "danger"
          : normalized === "CLOSED"
            ? "neutral"
            : "warning";

  return <Badge variant={variant}>{getSupervisorOrderStatusLabel(status)}</Badge>;
}

export function SupervisorPaymentBadge({ state }: { state: SupervisorPaymentState }) {
  return <Badge variant={getPaymentStateTone(state)}>{getPaymentStateLabel(state)}</Badge>;
}
