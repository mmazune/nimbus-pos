import { ListChecks } from "@phosphor-icons/react";

import { Skeleton } from "@/components/ui";
import { SupervisorEmptyState } from "@/components/supervisor/states";
import { SupervisorOrderCard } from "@/components/supervisor/orders/SupervisorOrderCard";
import type { SupervisorOrderListItem, SupervisorOrderPayments } from "@/lib/supervisor/orders";

type SupervisorOrderListProps = {
  orders: SupervisorOrderListItem[];
  selectedOrderId?: string | null;
  paymentsByOrderId: Map<string, SupervisorOrderPayments>;
  isLoading?: boolean;
  onSelectOrder: (order: SupervisorOrderListItem) => void;
};

export function SupervisorOrderList({
  isLoading,
  onSelectOrder,
  orders,
  paymentsByOrderId,
  selectedOrderId,
}: SupervisorOrderListProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4" aria-label="Loading orders">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-[164px]" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <SupervisorEmptyState
        icon={<ListChecks size={28} weight="duotone" aria-hidden />}
        title="No orders match this view."
        description="The backend returned no matching active orders for the selected filter and search."
        note="Closed-today history is deferred until the API exposes a safe date filter."
      />
    );
  }

  return (
    <div className="grid gap-4" aria-label="Supervisor order results">
      {orders.map((order) => (
        <SupervisorOrderCard
          key={order.id}
          order={order}
          payments={paymentsByOrderId.get(order.id)}
          selected={order.id === selectedOrderId}
          onSelect={onSelectOrder}
        />
      ))}
    </div>
  );
}
