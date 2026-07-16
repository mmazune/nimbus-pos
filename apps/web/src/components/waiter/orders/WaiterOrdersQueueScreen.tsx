import {
  Armchair,
  ArrowRight,
  Bell,
  CheckSquare,
  Clock,
  ClockClockwise,
  Receipt,
  ReceiptX,
  Users,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import {
  Badge,
  BlockedState,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageShell,
  SearchInput,
  Skeleton,
  StatusMessage,
} from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cn } from "@/lib/utils/cn";
import { listWaiterOrders, type WaiterOrdersListQuery } from "@/lib/waiter/order-api";
import {
  filterWaiterOrderQueue,
  normalizeWaiterOrderQueue,
  type WaiterOrderQueueFilter,
  type WaiterOrderQueueItemViewModel,
} from "@/lib/waiter/order-model";
import { useActiveShift } from "@/lib/waiter/useActiveShift";

type FilterConfig = {
  id: WaiterOrderQueueFilter;
  label: string;
  icon: typeof Receipt;
  query: WaiterOrdersListQuery;
};

const FILTERS: FilterConfig[] = [
  {
    id: "active",
    label: "Active",
    icon: ClockClockwise,
    query: { userId: "me", excludeStatus: ["NEW", "CLOSED", "VOIDED"], pageSize: 100 },
  },
  {
    id: "sent",
    label: "Sent",
    icon: Receipt,
    query: { userId: "me", status: "SENT", excludeStatus: "NEW", pageSize: 100 },
  },
  {
    id: "ready",
    label: "Ready",
    icon: Bell,
    query: { userId: "me", status: "READY", excludeStatus: "NEW", pageSize: 100 },
  },
  {
    id: "served",
    label: "Served",
    icon: CheckSquare,
    query: { userId: "me", status: "SERVED", excludeStatus: "NEW", pageSize: 100 },
  },
  {
    id: "closed-today",
    label: "Closed Today",
    icon: ReceiptX,
    query: { userId: "me", status: "CLOSED", excludeStatus: "NEW", pageSize: 100 },
  },
];

function errorCopy(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "NETWORK_ERROR") {
      return {
        title: "Could not reach the API",
        description: "Could not reach the API. Confirm the backend is running at the configured API URL.",
        blocked: false,
      };
    }

    if (error.code === "ORDER_NOT_OWNED_BY_WAITER") {
      return {
        title: "This order belongs to another waiter",
        description: "The queue is restricted to waiter-owned orders.",
        blocked: true,
      };
    }

    if (error.code === "SHIFT_NOT_OPEN") {
      return {
        title: "Shift not started",
        description: "You can read orders when the backend permits it, but service actions stay disabled.",
        blocked: false,
      };
    }

    if (error.isAuthError) {
      return {
        title: "Session expired",
        description: "Log in again to view waiter orders.",
        blocked: false,
      };
    }

    if (error.isForbidden) {
      return {
        title: "Orders access blocked",
        description: "This waiter account cannot read orders for this branch.",
        blocked: true,
      };
    }

    return { title: "Could not load orders", description: error.message, blocked: false };
  }

  return {
    title: "Could not load orders",
    description: error instanceof Error ? error.message : "Try again when the connection is stable.",
    blocked: false,
  };
}

function statusVariant(status: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "SENT" || status === "IN_KITCHEN" || status === "READY") return "info";
  if (status === "SERVED") return "success";
  if (status === "CLOSED") return "neutral";
  if (status === "VOIDED") return "danger";
  return "neutral";
}

function OrdersSkeleton() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index} className="min-h-[96px]">
          <div className="flex items-center justify-between gap-5">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <Skeleton className="h-12 w-12 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="mt-3 h-4 w-72" />
              </div>
            </div>
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-7 w-32" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function FilterChips({
  activeFilter,
  onChange,
}: {
  activeFilter: WaiterOrderQueueFilter;
  onChange: (filter: WaiterOrderQueueFilter) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {FILTERS.map((filter) => {
        const Icon = filter.icon;
        const active = activeFilter === filter.id;

        return (
          <button
            key={filter.id}
            type="button"
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold",
              "transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96]",
              active
                ? "bg-brand-navy-900 text-text-inverse"
                : "bg-surface-muted text-text-secondary hover:bg-surface",
            )}
            onClick={() => onChange(filter.id)}
          >
            <Icon size={18} weight={active ? "fill" : "bold"} aria-hidden />
            <span>{filter.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function OrderCard({
  order,
  onOpen,
}: {
  order: WaiterOrderQueueItemViewModel;
  onOpen: (order: WaiterOrderQueueItemViewModel) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-lg bg-surface p-5 text-left text-text-primary shadow-subtle",
        "transition-[background-color,box-shadow,transform] duration-150 ease-out hover:bg-surface-raised hover:shadow-panel active:scale-[0.99]",
      )}
      onClick={() => onOpen(order)}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-5">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-status-info-surface text-status-info">
            <Armchair size={24} weight="duotone" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="truncate text-lg font-bold tracking-normal text-text-primary">
                {order.tableName}
              </p>
              <Badge variant={statusVariant(order.status)}>{order.statusLabel}</Badge>
              {order.billState ? <Badge variant="warning">{order.billState}</Badge> : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium text-text-secondary">
              <span className="tabular-nums">{order.orderNumber}</span>
              <span className="inline-flex items-center gap-1.5">
                <Users size={16} weight="bold" aria-hidden />
                {order.guestName}
              </span>
              <span>
                {order.itemCount === undefined
                  ? "Items unavailable"
                  : `${order.itemCount} ${order.itemCount === 1 ? "item" : "items"}`}
              </span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs font-semibold text-text-muted">Time</p>
          <p className="mt-1 flex items-center justify-end gap-1.5 text-sm font-bold tabular-nums text-text-primary">
            <Clock size={16} weight="bold" aria-hidden />
            {order.elapsedLabel || "Time unavailable"}
          </p>
        </div>

        <div className="flex min-w-[150px] items-center justify-end gap-3">
          <div className="text-right">
            <p className="text-xs font-semibold text-text-muted">Total</p>
            <p className="mt-1 text-base font-bold tabular-nums text-text-primary">
              {order.formattedTotal}
            </p>
          </div>
          <ArrowRight size={20} weight="bold" className="text-text-muted" aria-hidden />
        </div>
      </div>
    </button>
  );
}

export function WaiterOrdersQueueScreen() {
  const router = useRouter();
  const { accessToken, branchId, clearSession, user } = useAuth();
  const activeShift = useActiveShift();
  const [activeFilter, setActiveFilter] = useState<WaiterOrderQueueFilter>("active");
  const [search, setSearch] = useState("");
  const [blockedOrder, setBlockedOrder] = useState<WaiterOrderQueueItemViewModel | null>(null);

  const filter = FILTERS.find((entry) => entry.id === activeFilter) || FILTERS[0];

  const ordersQuery = useQuery({
    queryKey: ["waiter", "orders-queue", branchId, activeFilter],
    enabled: Boolean(accessToken && branchId),
    queryFn: () => listWaiterOrders(accessToken as string, branchId as string, filter.query),
    retry: 1,
  });

  useEffect(() => {
    if (ordersQuery.error instanceof ApiError && ordersQuery.error.isAuthError) {
      clearSession();
    }
  }, [clearSession, ordersQuery.error]);

  const queue = useMemo(
    () => normalizeWaiterOrderQueue(ordersQuery.data?.data || [], user?.id),
    [ordersQuery.data?.data, user?.id],
  );

  const visibleOrders = useMemo(
    () => filterWaiterOrderQueue(queue, activeFilter, search),
    [activeFilter, queue, search],
  );

  function openOrder(order: WaiterOrderQueueItemViewModel) {
    if (!order.canOpen) {
      setBlockedOrder(order);
      return;
    }

    void router.push(`/waiter/orders/${order.id}`);
  }

  if (ordersQuery.isError) {
    const copy = errorCopy(ordersQuery.error);

    return (
      <PageShell title="Orders" subtitle="Your active service orders.">
        {copy.blocked ? (
          <BlockedState title={copy.title} description={copy.description} />
        ) : (
          <ErrorState title={copy.title} description={copy.description} />
        )}
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Orders"
      subtitle="Your active service orders."
      actions={<Badge variant="info">userId=me</Badge>}
    >
      {!activeShift.isLoading && !activeShift.data ? (
        <StatusMessage tone="warning" title="Shift not started">
          Orders remain readable when the backend permits it. This screen does not expose write
          actions.
        </StatusMessage>
      ) : null}

      {blockedOrder ? (
        <BlockedState
          title="This order belongs to another waiter"
          description={blockedOrder.blockedReason || "Editable order actions are blocked."}
          action={
            <Button variant="secondary" onClick={() => setBlockedOrder(null)}>
              Keep viewing queue
            </Button>
          }
        />
      ) : null}

      <Card className="grid grid-cols-[1fr_360px] items-center gap-5">
        <FilterChips activeFilter={activeFilter} onChange={setActiveFilter} />
        <SearchInput
          value={search}
          aria-label="Search orders"
          placeholder="Search order, table, guest, status"
          onChange={(event) => setSearch(event.target.value)}
        />
      </Card>

      {ordersQuery.isLoading ? (
        <OrdersSkeleton />
      ) : visibleOrders.length === 0 ? (
        <EmptyState
          icon={<Receipt size={32} weight="duotone" />}
          title={search ? "No orders match this search" : "No active orders. Start service from Floor."}
          description={
            search
              ? "Try another order number, table, guest, or status."
              : "Use Floor to start or continue table service."
          }
          action={
            <Button size="pos" onClick={() => void router.push("/waiter/floor")}>
              Go to Floor
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {visibleOrders.map((order) => (
            <OrderCard key={order.id} order={order} onOpen={openOrder} />
          ))}
        </div>
      )}

      {ordersQuery.isFetching && !ordersQuery.isLoading ? (
        <div className="fixed bottom-24 right-8 z-40 rounded-lg bg-surface px-4 py-3 text-sm font-semibold text-text-secondary shadow-panel">
          Refreshing orders
        </div>
      ) : null}

      {ordersQuery.isSuccess && queue.some((order) => !order.canOpen) ? (
        <StatusMessage tone="warning" title="Blocked order hidden from editing">
          One order in the response did not match the current waiter. Opening it is blocked.
        </StatusMessage>
      ) : null}

      {ordersQuery.isSuccess && ordersQuery.data?.total !== undefined ? (
        <p className="text-sm font-semibold text-text-muted">
          Showing <span className="tabular-nums">{visibleOrders.length}</span> of{" "}
          <span className="tabular-nums">{ordersQuery.data.total}</span> orders in this filter.
        </p>
      ) : null}

      {ordersQuery.isSuccess && visibleOrders.length > 0 ? (
        <div className="sr-only" aria-live="polite">
          Orders loaded.
        </div>
      ) : null}

      {ordersQuery.isError ? (
        <div className="sr-only" aria-live="assertive">
          Orders failed to load.
        </div>
      ) : null}

      {ordersQuery.isSuccess && activeFilter === "closed-today" && queue.length > 0 && visibleOrders.length === 0 ? (
        <StatusMessage tone="info" title="No closed orders today">
          Closed Today is filtered locally from closed orders returned by the API.
        </StatusMessage>
      ) : null}
    </PageShell>
  );
}
