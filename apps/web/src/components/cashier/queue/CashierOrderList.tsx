import { Receipt, WarningCircle } from "@phosphor-icons/react";

import { Button, EmptyState, Skeleton } from "@/components/ui";
import type { CashierOrderViewModel } from "@/lib/cashier/order-types";

import { CashierOrderCard } from "./CashierOrderCard";

type CashierOrderListProps = {
  orders: CashierOrderViewModel[];
  total?: number;
  selectedOrderId?: string | null;
  isLoading?: boolean;
  isRefreshing?: boolean;
  error?: string;
  search: string;
  onSelect: (orderId: string) => void;
  onRetry: () => void;
};

function OrdersSkeleton() {
  return (
    <div className="grid gap-3" aria-label="Loading cashier orders">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-lg bg-surface p-5 shadow-subtle">
          <div className="grid grid-cols-[minmax(0,1fr)_180px_170px] items-center gap-5">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-md" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="mt-3 h-4 w-72" />
              </div>
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CashierOrderList({
  orders,
  total,
  selectedOrderId,
  isLoading,
  isRefreshing,
  error,
  search,
  onSelect,
  onRetry,
}: CashierOrderListProps) {
  if (isLoading) return <OrdersSkeleton />;

  if (error) {
    return (
      <EmptyState
        icon={<WarningCircle size={32} weight="duotone" aria-hidden />}
        title="Could not load cashier queue"
        description={error}
        action={
          <Button variant="secondary" onClick={onRetry}>
            Retry queue
          </Button>
        }
      />
    );
  }

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<Receipt size={32} weight="duotone" aria-hidden />}
        title={search ? "No orders match this search" : "No bills waiting for checkout."}
        description={
          search
            ? "Try another order number, table, server, guest, or status."
            : "Active payable orders will appear here after the backend returns SENT, IN_KITCHEN, READY, or SERVED orders."
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3">
        {orders.map((order) => (
          <CashierOrderCard
            key={order.id}
            order={order}
            selected={selectedOrderId === order.id}
            onSelect={onSelect}
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-4 text-sm font-semibold text-text-muted">
        <span>
          Showing <span className="tabular-nums">{orders.length}</span>
          {total !== undefined ? (
            <>
              {" "}of <span className="tabular-nums">{total}</span>
            </>
          ) : null}{" "}
          active payable orders.
        </span>
        {isRefreshing ? <span aria-live="polite">Refreshing queue</span> : null}
      </div>
    </div>
  );
}
