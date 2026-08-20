// RELATIVE imports on purpose: `scripts/manager-b3-assertions.ts` executes this
// module directly under `tsx`, which does not resolve the Next.js `@/` alias at
// runtime. Same precedent as `dashboard-model.ts` and `branch-model.ts`.
import { sortOperationalTables } from "../../components/floor/formatters";
import type { OperationalTableViewModel } from "../../components/floor/types";
import { formatWaiterMoney } from "../waiter/formatters";

import type {
  ManagerFloorOrder,
  ManagerFloorReservation,
  ManagerMoney,
  ManagerReservationScope,
  ManagerTableApi,
} from "./operations-types";

/**
 * Manager Operations — pure model (Track B3).
 *
 * No React, no network, no aliased imports: every function here is executable by
 * the assertion script, which is how the "read-only", "bounded" and "no
 * fabricated total" guarantees become checkable rather than merely claimed.
 */

// ── Money ───────────────────────────────────────────────────────────────────

export function toManagerOperationsAmount(value: ManagerMoney): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Reuses the SHARED currency formatter — never a fifth per-surface money format. */
export function formatManagerOperationsMoney(
  value: ManagerMoney,
  currencyCode?: string | null,
  fallback = "Unavailable",
) {
  return formatWaiterMoney(toManagerOperationsAmount(value), currencyCode, fallback);
}

/**
 * Odoo's C4 list ends in a column-totals row. Nimbus's `/pos/orders` returns no
 * aggregate, so this sums THE PAGE and the UI labels it as the page total —
 * never as a branch or day total, which would be a fabricated number.
 *
 * Returns `null` when any row's money is unreadable: a partial sum presented as
 * a total is worse than an honest gap.
 */
export function sumManagerPageMoney(values: readonly ManagerMoney[]): number | null {
  let sum = 0;
  for (const value of values) {
    const amount = toManagerOperationsAmount(value);
    if (amount === null) return null;
    sum += amount;
  }
  return sum;
}

// ── Dates ───────────────────────────────────────────────────────────────────

export function formatManagerDateTime(value: string | null | undefined, fallback = "—") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatManagerDate(value: string | null | undefined, fallback = "—") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

// ── Status vocabulary ───────────────────────────────────────────────────────

export type ManagerStatusTone = "neutral" | "success" | "warning" | "danger" | "info";

export function titleCaseManagerStatus(value: string) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

/**
 * The REAL Nimbus order lifecycle, taken from `ListOrdersQueryDto`'s enum and
 * `OrdersService.transitionOrder` — not Odoo's `Draft ▸ Posted`, which has no
 * Nimbus equivalent. `VOIDED` is deliberately not a pipeline step: it is an exit,
 * not a stage, and rendering it inline would imply every order passes through it.
 */
export const MANAGER_ORDER_PIPELINE = [
  "NEW",
  "SENT",
  "IN_KITCHEN",
  "READY",
  "SERVED",
  "CLOSED",
] as const;

export const MANAGER_ORDER_TERMINAL_STATUSES = ["CLOSED", "VOIDED"] as const;

/** Every status the list filter may send — must be a subset of the DTO's enum. */
export const MANAGER_ORDER_STATUS_FILTERS = [
  "NEW",
  "SENT",
  "IN_KITCHEN",
  "READY",
  "SERVED",
  "CLOSED",
  "VOIDED",
] as const;

export const MANAGER_SERVICE_TYPE_FILTERS = ["DINE_IN", "TAKEAWAY"] as const;

export function managerOrderStatusTone(status: string): ManagerStatusTone {
  switch (status.toUpperCase()) {
    case "CLOSED":
      return "success";
    case "VOIDED":
      return "danger";
    case "READY":
    case "SERVED":
      return "info";
    case "IN_KITCHEN":
    case "SENT":
      return "warning";
    default:
      return "neutral";
  }
}

/**
 * Pipeline position for the C14 statusbar. `-1` means "not on the pipeline" —
 * the only real case is `VOIDED`, and the UI renders that as an exit chip rather
 * than pretending it sits between two stages.
 */
export function managerOrderPipelineIndex(status: string) {
  return MANAGER_ORDER_PIPELINE.indexOf(status.toUpperCase() as (typeof MANAGER_ORDER_PIPELINE)[number]);
}

export const MANAGER_RESERVATION_SCOPES: readonly ManagerReservationScope[] = ["active", "history"];

/** Mirrors `ListReservationsQueryDto`'s enum exactly — never a superset. */
export const MANAGER_RESERVATION_STATUS_FILTERS = [
  "PENDING",
  "CONFIRMED",
  "SEATED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export function managerReservationStatusTone(status: string): ManagerStatusTone {
  switch (status.toUpperCase()) {
    case "COMPLETED":
      return "success";
    case "SEATED":
      return "info";
    case "CONFIRMED":
      return "success";
    case "CANCELLED":
    case "NO_SHOW":
      return "danger";
    default:
      return "warning";
  }
}

// ── Pager ───────────────────────────────────────────────────────────────────

export type ManagerPagerModel = {
  from: number;
  to: number;
  total: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

/**
 * `{from,to,total}` for the control panel, derived from the SERVER's total.
 * An empty page reports `0-0 / total` rather than `1-0`, and `hasNext` is
 * computed from the total, never from "the page came back full".
 */
export function toManagerPager({
  page,
  pageSize,
  rowCount,
  total,
}: {
  page: number;
  pageSize: number;
  rowCount: number;
  total: number;
}): ManagerPagerModel {
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
  const from = rowCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = rowCount === 0 ? 0 : from + rowCount - 1;
  return {
    from,
    to,
    total: safeTotal,
    hasPrevious: page > 1,
    hasNext: to > 0 && to < safeTotal,
  };
}

// ── Floor view model ────────────────────────────────────────────────────────

export type ManagerFloorTableViewModel = OperationalTableViewModel & {
  raw: ManagerTableApi;
  activeOrder?: ManagerFloorOrder;
  reservation?: ManagerFloorReservation;
};

const HIDDEN_TABLE_STATUSES = new Set(["CLEANING", "BLOCKED", "UNAVAILABLE", "OUT_OF_SERVICE"]);
const ACTIVE_ORDER_STATUSES = new Set(["NEW", "SENT", "IN_KITCHEN", "READY", "SERVED"]);
const ACTIVE_RESERVATION_STATUSES = new Set(["PENDING", "CONFIRMED"]);

function formatReservationTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
}

/**
 * Produces the SAME `OperationalTableViewModel` Waiter, Cashier and Supervisor
 * feed into the shared `OperationalFloor`, so the toolbar, grid, cards, status
 * labels, `First L.` staff formatting, breakpoints and 176px card height are
 * byte-identical for Manager. There is no `ManagerFloor*` component and there
 * must never be one (CLAUDE.md §13).
 *
 * Privacy: no guest name, phone, email, payment or receipt reference is carried
 * onto a Floor card — the locked Waiter rule applies to every consumer.
 */
export function normalizeManagerFloorTables({
  activeOrders,
  reservations,
  tables,
}: {
  activeOrders: readonly ManagerFloorOrder[];
  reservations: readonly ManagerFloorReservation[];
  tables: readonly ManagerTableApi[];
}): ManagerFloorTableViewModel[] {
  const orderByTable = new Map<string, ManagerFloorOrder>();
  activeOrders.forEach((order) => {
    if (!order.tableId || !ACTIVE_ORDER_STATUSES.has(order.status.toUpperCase())) return;
    if (!orderByTable.has(order.tableId)) orderByTable.set(order.tableId, order);
  });

  const reservationByTable = new Map<string, ManagerFloorReservation>();
  reservations.forEach((reservation) => {
    if (!reservation.tableId || !ACTIVE_RESERVATION_STATUSES.has(reservation.status.toUpperCase())) {
      return;
    }
    if (!reservationByTable.has(reservation.tableId)) {
      reservationByTable.set(reservation.tableId, reservation);
    }
  });

  return sortOperationalTables(
    tables
      .filter((table) => {
        const status = String(table.status || "").toUpperCase();
        return table.isActive !== false && !HIDDEN_TABLE_STATUSES.has(status);
      })
      .map((table) => {
        const activeOrder = orderByTable.get(table.id);
        const reservation = reservationByTable.get(table.id);
        const backendStatus = String(table.status || "").toUpperCase();
        const orderStatus = activeOrder?.status.toUpperCase() || "";
        const status =
          (activeOrder && orderStatus !== "NEW") || backendStatus === "OCCUPIED"
            ? "occupied"
            : reservation || backendStatus === "RESERVED"
              ? "reserved"
              : "available";

        return {
          id: table.id,
          label: table.label || "Table",
          floorPlanId: table.floorPlan?.id || table.floorPlanId || null,
          floorPlanName: table.floorPlan?.name || null,
          capacity: table.capacity ?? reservation?.partySize ?? null,
          status,
          assignedStaffId: null,
          // Already `First L.`-formatted at the API boundary by the SHARED helper.
          assignedStaffName: activeOrder?.serverName || null,
          // Manager owns no orders, so "Mine" is never true — the shared toolbar
          // filter still renders, and honestly reports zero.
          isMine: false,
          activeOrderId: activeOrder?.id || null,
          activeOrderStatus: activeOrder?.status || null,
          reservationId: reservation?.id || null,
          reservationStatus: reservation?.status || null,
          reservationTime: formatReservationTime(reservation?.reservationAt),
          attentionState: null,
          disabledReason: null,
          raw: table,
          activeOrder,
          reservation,
        } satisfies ManagerFloorTableViewModel;
      }),
  );
}
