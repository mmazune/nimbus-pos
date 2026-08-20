/**
 * Manager Operations — wire types and the SAFE row shapes (Track B3).
 *
 * Two layers on purpose:
 *
 * - `*Api` types describe what the endpoint actually sends. They exist so the
 *   projection functions in `operations-api.ts` can be typed against reality
 *   rather than against what we wish the payload were.
 * - `Manager*Row` types are what the rest of the app is allowed to see. Every
 *   field is constructed explicitly at the API-client boundary, so an endpoint
 *   that grows a field tomorrow cannot silently widen a Manager surface.
 *
 * Operations is READ-ONLY oversight. Nothing in this module models a mutation:
 * there is no tender, no order-builder line edit, no table-status write, no
 * close, and no KDS. Any decision write B3 might have surfaced (discount /
 * refund / post-close void) is deliberately absent — see the completion report's
 * "read-only vs escalations" resolution.
 */

/** A Prisma Decimal over the wire — always a string, never a number. */
export type ManagerMoney = string | number | null | undefined;

// ── Orders (GET /api/pos/orders, GET /api/pos/orders/:id) ───────────────────

export type ManagerOrderApi = {
  id: string;
  orderNumber?: string | null;
  status?: string | null;
  serviceType?: string | null;
  subtotal?: ManagerMoney;
  tax?: ManagerMoney;
  discount?: ManagerMoney;
  total?: ManagerMoney;
  createdAt?: string | null;
  updatedAt?: string | null;
  tableId?: string | null;
  table?: { id: string; label?: string | null } | null;
  userId?: string | null;
  user?: { id: string; firstName?: string | null; lastName?: string | null } | null;
  items?: Array<{ id: string }> | null;
  notes?: string | null;
};

export type ManagerOrdersListApi = {
  data?: ManagerOrderApi[] | null;
  total?: number;
  page?: number;
  pageSize?: number;
};

/** One row of the Odoo-C4 orders list. */
export type ManagerOrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  serviceType: string;
  tableLabel: string | null;
  /** `First L.` — the shared operational staff format, never a full surname. */
  serverName: string | null;
  itemCount: number | null;
  subtotal: ManagerMoney;
  tax: ManagerMoney;
  discount: ManagerMoney;
  total: ManagerMoney;
  createdAt: string | null;
};

export type ManagerOrdersPage = {
  rows: ManagerOrderRow[];
  /** The endpoint's own `total` — the pager is never fed a client-side length. */
  total: number;
  page: number;
  pageSize: number;
};

export type ManagerOrderLineApi = {
  id: string;
  quantity?: number | null;
  status?: string | null;
  notes?: string | null;
  price?: ManagerMoney;
  subtotal?: ManagerMoney;
  menuItem?: { id?: string | null; name?: string | null } | null;
  menuItemServing?: { id?: string | null; name?: string | null } | null;
};

export type ManagerOrderDetailApi = ManagerOrderApi & {
  items?: ManagerOrderLineApi[] | null;
  anomalyFlags?: unknown;
  splitFromOrderId?: string | null;
  mergedIntoOrderId?: string | null;
};

export type ManagerOrderLine = {
  id: string;
  name: string;
  servingName: string | null;
  quantity: number | null;
  status: string | null;
  unitPrice: ManagerMoney;
  lineTotal: ManagerMoney;
};

/** The read-only C5 record. No `actionsAvailable`, because none are offered. */
export type ManagerOrderDetail = ManagerOrderRow & {
  lines: ManagerOrderLine[];
  splitFromOrderId: string | null;
  mergedIntoOrderId: string | null;
  updatedAt: string | null;
};

// ── Reservations (GET /api/reservations) ────────────────────────────────────

export type ManagerReservationApi = {
  id: string;
  reservationNumber?: string | null;
  guestName?: string | null;
  guestPhone?: string | null;
  guestEmail?: string | null;
  partySize?: number | null;
  reservationAt?: string | null;
  status?: string | null;
  tableId?: string | null;
  table?: { id: string; label?: string | null } | null;
  seatedOrderId?: string | null;
  createdAt?: string | null;
};

export type ManagerReservationsListApi = {
  data?: ManagerReservationApi[] | null;
  total?: number;
  page?: number;
  pageSize?: number;
};

/**
 * Reservation row. Guest CONTACT details are deliberately not carried:
 * Operations is oversight, it never phones a guest, and the Supervisor
 * precedent puts contact behind a workspace that Manager does not have.
 */
export type ManagerReservationRow = {
  id: string;
  reservationNumber: string;
  guestName: string | null;
  partySize: number | null;
  reservationAt: string | null;
  status: string;
  tableLabel: string | null;
  hasSeatedOrder: boolean;
};

export type ManagerReservationsPage = {
  rows: ManagerReservationRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type ManagerReservationScope = "active" | "history";

/**
 * Floor decoration needs the `tableId` that the plain list-row projections drop.
 * These two live HERE rather than beside their projection functions in
 * `operations-api.ts` because `operations-model.ts` consumes them, and that
 * module has to stay free of aliased imports so the assertion script can execute
 * it directly under `tsx`.
 */
export type ManagerFloorOrder = ManagerOrderRow & { tableId: string | null };

export type ManagerFloorReservation = ManagerReservationRow & { tableId: string | null };

// ── Tables (GET /api/tables) ────────────────────────────────────────────────

export type ManagerTableApi = {
  id: string;
  label?: string | null;
  capacity?: number | null;
  status?: string | null;
  isActive?: boolean | null;
  floorPlan?: { id?: string | null; name?: string | null } | null;
  floorPlanId?: string | null;
};
