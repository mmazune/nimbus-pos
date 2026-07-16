import {
  isCashierInProgressStatus,
  isCashierPayableStatus,
  isCashierReadyServedStatus,
} from "@/lib/cashier/order-state";
import type { CashierOrderViewModel } from "@/lib/cashier/order-types";

export type CashierQueueFilterId =
  | "active-payable"
  | "ready-served"
  | "in-progress"
  | "partially-paid"
  | "closed-today";

export type CashierQueueFilter = {
  id: CashierQueueFilterId;
  label: string;
  description: string;
  disabled?: boolean;
  disabledReason?: string;
};

export const CASHIER_QUEUE_FILTERS: CashierQueueFilter[] = [
  {
    id: "active-payable",
    label: "Active payable",
    description: "SENT, IN_KITCHEN, READY, and SERVED orders.",
  },
  {
    id: "ready-served",
    label: "Ready / served",
    description: "Orders in READY or SERVED status.",
  },
  {
    id: "in-progress",
    label: "In progress",
    description: "Orders in SENT or IN_KITCHEN status.",
  },
  {
    id: "partially-paid",
    label: "Partially paid",
    description: "Derived when payment summary reports paid and outstanding amounts.",
  },
  {
    id: "closed-today",
    label: "Closed orders",
    description: "Closed orders available for receipt and refund review.",
  },
];

export function filterCashierQueueOrders(
  orders: CashierOrderViewModel[],
  filterId: CashierQueueFilterId,
) {
  if (filterId === "ready-served") {
    return orders.filter((order) => isCashierReadyServedStatus(order.status));
  }

  if (filterId === "in-progress") {
    return orders.filter((order) => isCashierInProgressStatus(order.status));
  }

  if (filterId === "partially-paid") {
    return orders.filter((order) => order.payment.state === "partially-paid");
  }

  if (filterId === "closed-today") {
    return orders.filter((order) => order.status === "CLOSED");
  }

  return orders.filter((order) => isCashierPayableStatus(order.status));
}

export function searchCashierQueueOrders(orders: CashierOrderViewModel[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return orders;
  return orders.filter((order) => order.searchText.includes(q));
}
