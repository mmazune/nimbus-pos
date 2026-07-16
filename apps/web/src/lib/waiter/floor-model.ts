import type { WaiterOrderApi, WaiterReservationApi, WaiterTableApi } from "./floor-api";

export type WaiterTableStatus = "available" | "occupied" | "reserved";
export type WaiterTableFilter = "all" | WaiterTableStatus | "mine";

export type WaiterTableViewModel = {
  id: string;
  name: string;
  status: WaiterTableStatus;
  capacity: number;
  guestName?: string;
  reservationTime?: string;
  reservationId?: string;
  reservationStatus?: string;
  orderId?: string;
  orderNumber?: string;
  orderStatus?: string;
  billState?: string;
  assignedWaiterId?: string;
  assignedWaiterName?: string;
  isMine: boolean;
  disabledReason?: string;
};

export type WaiterTableIntent =
  | "start-order"
  | "reservation-detail"
  | "own-order"
  | "ownership-blocked"
  | "disabled";

export type WaiterTableAction = {
  intent: WaiterTableIntent;
  title: string;
  message: string;
  table: WaiterTableViewModel;
};

const HIDDEN_TABLE_STATUSES = new Set(["CLEANING", "BLOCKED", "UNAVAILABLE", "OUT_OF_SERVICE"]);
const ACTIVE_ORDER_STATUSES = new Set(["SENT", "IN_KITCHEN", "READY", "SERVED"]);
const RESERVABLE_STATUSES = new Set(["PENDING", "CONFIRMED"]);

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function formatPersonName(user: WaiterOrderApi["user"]) {
  if (!user) return undefined;
  if (user.displayName) return user.displayName;

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return fullName || user.email || undefined;
}

function readMetadataString(metadata: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!metadata) return undefined;

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  return undefined;
}

function normalizeBillState(order: WaiterOrderApi | undefined) {
  const billState = readMetadataString(order?.metadata, ["billState", "billStatus", "bill_state"]);
  return billState || undefined;
}

function normalizeGuestName(order?: WaiterOrderApi, reservation?: WaiterReservationApi) {
  return (
    reservation?.customerName ||
    readMetadataString(order?.metadata, ["guestName", "customerName", "guest_name", "customer_name"]) ||
    undefined
  );
}

function normalizeReservationTime(value: string | null | undefined) {
  if (!value) return undefined;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function sortByOperationalPriority(a: WaiterTableViewModel, b: WaiterTableViewModel) {
  const rank: Record<WaiterTableStatus, number> = {
    occupied: 0,
    reserved: 1,
    available: 2,
  };

  if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
}

export function normalizeWaiterTables({
  tables,
  activeOrders,
  upcomingReservations,
  currentUserId,
}: {
  tables: WaiterTableApi[];
  activeOrders: WaiterOrderApi[];
  upcomingReservations: WaiterReservationApi[];
  currentUserId?: string | null;
}): WaiterTableViewModel[] {
  const orderByTable = new Map<string, WaiterOrderApi>();
  for (const order of activeOrders) {
    if (!order.tableId || !ACTIVE_ORDER_STATUSES.has(String(order.status || "").toUpperCase())) {
      continue;
    }

    if (!orderByTable.has(order.tableId)) {
      orderByTable.set(order.tableId, order);
    }
  }

  const reservationByTable = new Map<string, WaiterReservationApi>();
  for (const reservation of upcomingReservations) {
    const tableId = reservation.tableId || reservation.table?.id;
    if (!tableId || !RESERVABLE_STATUSES.has(String(reservation.status || "").toUpperCase())) {
      continue;
    }

    if (!reservationByTable.has(tableId)) {
      reservationByTable.set(tableId, reservation);
    }
  }

  return tables
    .filter((table) => {
      const backendStatus = String(table.status || "").toUpperCase();
      return table.isActive !== false && !HIDDEN_TABLE_STATUSES.has(backendStatus);
    })
    .map((table) => {
      const order = orderByTable.get(table.id);
      const reservation = reservationByTable.get(table.id);
      const backendStatus = String(table.status || "").toUpperCase();

      let status: WaiterTableStatus = "available";
      if (order || backendStatus === "OCCUPIED") {
        status = "occupied";
      } else if (reservation || backendStatus === "RESERVED") {
        status = "reserved";
      }

      const assignedWaiterId = order?.userId || order?.user?.id || undefined;
      const isMine = Boolean(currentUserId && assignedWaiterId === currentUserId);

      return {
        id: table.id,
        name: table.label || "Table",
        status,
        capacity: table.capacity || reservation?.partySize || 0,
        guestName: normalizeGuestName(order, reservation),
        reservationTime: normalizeReservationTime(reservation?.reservationAt),
        reservationId: reservation?.id,
        reservationStatus: reservation?.status || undefined,
        orderId: order?.id,
        orderNumber: order?.orderNumber || undefined,
        orderStatus: order?.status || undefined,
        billState: normalizeBillState(order),
        assignedWaiterId,
        assignedWaiterName: formatPersonName(order?.user),
        isMine,
      };
    })
    .sort(sortByOperationalPriority);
}

export function filterWaiterTables(
  tables: WaiterTableViewModel[],
  filter: WaiterTableFilter,
  query: string,
) {
  const q = normalizeText(query);

  return tables.filter((table) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "mine" ? table.isMine : table.status === filter);

    if (!matchesFilter) return false;
    if (!q) return true;

    return [table.name, table.guestName, table.orderNumber]
      .map(normalizeText)
      .some((value) => value.includes(q));
  });
}

export function getWaiterTableAction(
  table: WaiterTableViewModel,
  shiftIsOpen: boolean,
): WaiterTableAction {
  if (table.disabledReason) {
    return {
      intent: "disabled",
      title: "Table unavailable",
      message: table.disabledReason,
      table,
    };
  }

  if (table.status === "available") {
    if (!shiftIsOpen) {
      return {
        intent: "disabled",
        title: "Shift not started",
        message: "Start shift before taking orders.",
        table,
      };
    }

    return {
      intent: "start-order",
      title: `Start order for ${table.name}`,
      message: "Create a dine-in order for this available table.",
      table,
    };
  }

  if (table.status === "reserved") {
    return {
      intent: "reservation-detail",
      title: `Reservation for ${table.name}`,
      message: shiftIsOpen
        ? "Open the reservation detail and seat the guest from Reservations."
        : "Shift not started. You can view this reservation, but seating is disabled.",
      table,
    };
  }

  if (table.isMine) {
    return {
      intent: "own-order",
      title: table.orderNumber ? `Order ${table.orderNumber}` : `${table.name} order`,
      message: table.orderId
        ? "Open this waiter-owned order."
        : "This table is occupied, but the active order link was not available in the list response.",
      table,
    };
  }

  return {
    intent: "ownership-blocked",
    title: "This table belongs to another waiter",
    message: "You can view the service state, but editable order actions are blocked.",
    table,
  };
}
