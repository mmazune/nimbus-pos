import { formatOperationalStaffIdentity } from "@/components/floor/formatters";
import { apiRequest } from "@/lib/api/client";
import type {
  ManagerFloorOrder,
  ManagerFloorReservation,
  ManagerOrderDetail,
  ManagerOrderDetailApi,
  ManagerOrderLine,
  ManagerOrderLineApi,
  ManagerOrderRow,
  ManagerOrdersListApi,
  ManagerOrderApi,
  ManagerOrdersPage,
  ManagerReservationApi,
  ManagerReservationRow,
  ManagerReservationScope,
  ManagerReservationsListApi,
  ManagerReservationsPage,
  ManagerTableApi,
} from "@/lib/manager/operations-types";

export type { ManagerFloorOrder, ManagerFloorReservation };

/**
 * Manager Operations — request layer (Track B3).
 *
 * Four rules this module exists to enforce:
 *
 * 1. **Bounded, always.** `/pos/orders` has no `@Max` and no server clamp
 *    (MP0-11 / C-12) — `?pageSize=500` really did return 303 rows in the M-P0
 *    audit. Every call here sends an explicit page size from one constant, and
 *    the page size is never taken from user input.
 * 2. **Branch-scoped, always.** Every request passes `branchId`, which
 *    `apiRequest` turns into `X-Branch-Id`. No Operations endpoint is org-scoped,
 *    so unlike Staff there is no client-side re-filter here.
 * 3. **Projected at the boundary.** The row types are built field by field, so
 *    guest contact details, raw metadata and anything else the endpoint adds
 *    later never reach React state or the query cache.
 * 4. **Read-only.** There is no exported function in this module that issues a
 *    POST, PATCH, PUT or DELETE. The B3 assertion script proves it.
 */

/**
 * One page size for every Operations list. 25 matches the Odoo control-panel
 * default the reference screenshots show (`1-25 / 312`) and keeps a single
 * unbounded-endpoint bound to audit.
 */
export const MANAGER_LIST_PAGE_SIZE = 25;

/** Table reads are a floor snapshot, not a paged list — bounded well above any real floor. */
export const MANAGER_FLOOR_TABLE_LIMIT = 200;

function text(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
}

function count(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// ── Orders ──────────────────────────────────────────────────────────────────

export type ManagerOrdersQuery = {
  page: number;
  status?: string | null;
  serviceType?: string | null;
};

export function buildManagerOrdersPath({ page, serviceType, status }: ManagerOrdersQuery) {
  const params = new URLSearchParams();
  params.set("page", String(Math.max(1, Math.trunc(page) || 1)));
  // Explicit bound — never omitted, never widened from the UI (MP0-11).
  params.set("pageSize", String(MANAGER_LIST_PAGE_SIZE));
  if (status) params.set("status", status);
  if (serviceType) params.set("serviceType", serviceType);
  return `/api/pos/orders?${params.toString()}`;
}

export function projectManagerOrderRow(order: ManagerOrderApi): ManagerOrderRow {
  return {
    id: order.id,
    orderNumber: text(order.orderNumber) || order.id,
    status: (text(order.status) || "UNKNOWN").toUpperCase(),
    serviceType: (text(order.serviceType) || "UNKNOWN").toUpperCase(),
    tableLabel: text(order.table?.label),
    // The SHARED operational staff format (`First L.`) — Operations must read the
    // same way the Floor cards every other role sees already do.
    serverName: order.user ? formatOperationalStaffIdentity(order.user) : null,
    itemCount: Array.isArray(order.items) ? order.items.length : null,
    subtotal: order.subtotal ?? null,
    tax: order.tax ?? null,
    discount: order.discount ?? null,
    total: order.total ?? null,
    createdAt: text(order.createdAt),
  };
}

export async function listManagerOrders(
  token: string,
  branchId: string,
  query: ManagerOrdersQuery,
): Promise<ManagerOrdersPage> {
  const response = await apiRequest<ManagerOrdersListApi>(buildManagerOrdersPath(query), {
    token,
    branchId,
  });

  return {
    rows: (response.data || []).map(projectManagerOrderRow),
    // The endpoint's own count — the control-panel pager is contractually fed
    // `{from,to,total}` and must never see a page length (roadmap B1(d)).
    total: count(response.total) ?? 0,
    page: count(response.page) ?? query.page,
    pageSize: count(response.pageSize) ?? MANAGER_LIST_PAGE_SIZE,
  };
}

function projectManagerOrderLine(line: ManagerOrderLineApi): ManagerOrderLine {
  return {
    id: line.id,
    name: text(line.menuItem?.name) || "Menu item unavailable",
    servingName: text(line.menuItemServing?.name),
    quantity: count(line.quantity),
    status: text(line.status),
    unitPrice: line.price ?? null,
    lineTotal: line.subtotal ?? null,
  };
}

export function projectManagerOrderDetail(order: ManagerOrderDetailApi): ManagerOrderDetail {
  return {
    ...projectManagerOrderRow(order as ManagerOrderApi),
    itemCount: Array.isArray(order.items) ? order.items.length : null,
    lines: (order.items || []).map(projectManagerOrderLine),
    splitFromOrderId: text(order.splitFromOrderId),
    mergedIntoOrderId: text(order.mergedIntoOrderId),
    updatedAt: text(order.updatedAt),
  };
}

export async function getManagerOrderDetail(token: string, branchId: string, orderId: string) {
  const response = await apiRequest<ManagerOrderDetailApi>(
    `/api/pos/orders/${encodeURIComponent(orderId)}`,
    { token, branchId },
  );
  return projectManagerOrderDetail(response);
}

// ── Reservations ────────────────────────────────────────────────────────────

export type ManagerReservationsQuery = {
  page: number;
  scope: ManagerReservationScope;
  status?: string | null;
};

export function buildManagerReservationsPath({ page, scope, status }: ManagerReservationsQuery) {
  const params = new URLSearchParams();
  params.set("scope", scope);
  params.set("page", String(Math.max(1, Math.trunc(page) || 1)));
  // /api/reservations clamps to 100 server-side; the client still names its own
  // bound so the request is self-describing and matches the other lists.
  params.set("pageSize", String(MANAGER_LIST_PAGE_SIZE));
  if (status) params.set("status", status);
  return `/api/reservations?${params.toString()}`;
}

export function projectManagerReservationRow(
  reservation: ManagerReservationApi,
): ManagerReservationRow {
  return {
    id: reservation.id,
    reservationNumber: text(reservation.reservationNumber) || reservation.id,
    guestName: text(reservation.guestName),
    partySize: count(reservation.partySize),
    reservationAt: text(reservation.reservationAt),
    status: (text(reservation.status) || "UNKNOWN").toUpperCase(),
    tableLabel: text(reservation.table?.label),
    hasSeatedOrder: Boolean(text(reservation.seatedOrderId)),
    // guestPhone / guestEmail are deliberately dropped here, at the boundary.
  };
}

export async function listManagerReservations(
  token: string,
  branchId: string,
  query: ManagerReservationsQuery,
): Promise<ManagerReservationsPage> {
  const response = await apiRequest<ManagerReservationsListApi>(
    buildManagerReservationsPath(query),
    { token, branchId },
  );

  return {
    rows: (response.data || []).map(projectManagerReservationRow),
    total: count(response.total) ?? 0,
    page: count(response.page) ?? query.page,
    pageSize: count(response.pageSize) ?? MANAGER_LIST_PAGE_SIZE,
  };
}

// ── Floor tables ────────────────────────────────────────────────────────────

/**
 * `GET /api/tables` returns a bare array (M-P0 verified: 22 rows Tapas / 16
 * Rooftop). Manager renders these through the SHARED `OperationalFloor`, so the
 * shape it needs is exactly the shape Waiter/Cashier/Supervisor already use.
 */
export async function listManagerTables(token: string, branchId: string) {
  const response = await apiRequest<ManagerTableApi[] | { data?: ManagerTableApi[] }>(
    "/api/tables",
    { token, branchId },
  );
  const rows = Array.isArray(response) ? response : response?.data || [];
  return rows.slice(0, MANAGER_FLOOR_TABLE_LIMIT);
}

/**
 * The Floor snapshot: tables + the active orders and active reservations that
 * decorate them. This is the SAME three-read domain Cashier C1 and Supervisor
 * use — no Manager-only floor endpoint exists and none was invented.
 *
 * Orders are read with `excludeStatus=CLOSED,VOIDED` so the snapshot is the
 * active floor, not the day's history.
 */
export async function loadManagerFloorSnapshot(token: string, branchId: string) {
  const [tables, orders, reservations] = await Promise.all([
    listManagerTables(token, branchId),
    apiRequest<ManagerOrdersListApi>(
      `/api/pos/orders?excludeStatus=CLOSED,VOIDED&page=1&pageSize=100`,
      { token, branchId },
    ),
    apiRequest<ManagerReservationsListApi>("/api/reservations?scope=active&page=1&pageSize=100", {
      token,
      branchId,
    }),
  ]);

  return {
    tables,
    activeOrders: (orders.data || []).map(projectManagerOrderRowWithTable),
    reservations: (reservations.data || []).map(projectManagerFloorReservation),
  };
}

function projectManagerOrderRowWithTable(order: ManagerOrderApi): ManagerFloorOrder {
  return {
    ...projectManagerOrderRow(order),
    tableId: text(order.tableId) || text(order.table?.id) || null,
  };
}

function projectManagerFloorReservation(
  reservation: ManagerReservationApi,
): ManagerFloorReservation {
  return {
    ...projectManagerReservationRow(reservation),
    tableId: text(reservation.tableId) || text(reservation.table?.id) || null,
  };
}
