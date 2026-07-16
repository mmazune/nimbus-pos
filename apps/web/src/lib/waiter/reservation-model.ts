import { formatMoney } from "@/lib/waiter/order-model";

import type {
  SeatReservationPayload,
  WaiterReservationApi,
  WaiterReservationDepositApi,
} from "./reservation-api";

export type WaiterReservationFilter = "upcoming" | "today" | "seated" | "late" | "all";

export type WaiterReservationStatusViewModel = {
  raw: string;
  label: string;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
};

export type WaiterReservationGuestViewModel = {
  name: string;
  phone?: string;
  email?: string;
};

export type WaiterReservationTableViewModel = {
  id?: string;
  name: string;
  capacity?: number;
};

export type WaiterReservationSeatResultViewModel = {
  reservationId: string;
  tableId?: string;
  tableName: string;
  orderId?: string;
  orderNumber?: string;
  status: WaiterReservationStatusViewModel;
};

export type WaiterReservationViewModel = {
  id: string;
  reservationNumber: string;
  guest: WaiterReservationGuestViewModel;
  partySize: number;
  partyLabel: string;
  reservationAt?: string;
  timeLabel: string;
  dateLabel: string;
  relativeTimeLabel: string;
  status: WaiterReservationStatusViewModel;
  source?: string;
  table: WaiterReservationTableViewModel;
  depositStatus?: string;
  depositLabel?: string;
  notes?: string;
  specialRequests?: string;
  seatedAt?: string;
  seatedOrderId?: string;
  seatedOrderNumber?: string;
  canSeat: boolean;
  blockedReason?: string;
  searchText: string;
};

function asNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function titleCase(value: string | null | undefined, fallback = "Unavailable") {
  if (!value) return fallback;
  return value.replace(/_/g, " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function normalizeDate(value: string | null | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function isSameLocalDay(value: string | undefined, today = new Date()) {
  const date = normalizeDate(value);
  if (!date) return false;

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function formatTime(value: string | undefined) {
  const date = normalizeDate(value);
  if (!date) return "Time unavailable";

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDate(value: string | undefined) {
  const date = normalizeDate(value);
  if (!date) return "Date unavailable";

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function relativeReservationLabel(value: string | undefined, status: string) {
  const date = normalizeDate(value);
  if (!date) return "Time unavailable";
  if (status === "SEATED") return "Seated";

  const minutes = Math.round((date.getTime() - Date.now()) / 60_000);
  if (minutes < -1) return `${Math.abs(minutes)} min late`;
  if (minutes <= 1) return "Due now";
  if (minutes < 60) return `In ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours < 24) return remaining ? `In ${hours}h ${remaining}m` : `In ${hours}h`;

  return formatDate(value);
}

export function normalizeReservationStatus(
  status: string | null | undefined,
): WaiterReservationStatusViewModel {
  const raw = String(status || "UNKNOWN").toUpperCase();

  if (raw === "CONFIRMED") return { raw, label: "Confirmed", tone: "info" };
  if (raw === "PENDING") return { raw, label: "Pending", tone: "warning" };
  if (raw === "SEATED") return { raw, label: "Seated", tone: "success" };
  if (raw === "COMPLETED") return { raw, label: "Completed", tone: "neutral" };
  if (raw === "CANCELLED" || raw === "NO_SHOW") {
    return { raw, label: titleCase(raw), tone: "danger" };
  }

  return { raw, label: "Status unavailable", tone: "neutral" };
}

function normalizeDeposit(
  deposits: WaiterReservationDepositApi[] | null | undefined,
  depositRequired: string | number | null | undefined,
) {
  const latest = deposits?.[0];
  const required = asNumber(depositRequired);
  const amount = asNumber(latest?.amount) ?? required;

  if (latest?.status) {
    return {
      status: latest.status,
      label: amount === undefined
        ? titleCase(latest.status)
        : `${titleCase(latest.status)} ${formatMoney(amount)}`,
    };
  }

  if (required !== undefined && required > 0) {
    return {
      status: "REQUIRED",
      label: `Deposit required ${formatMoney(required)}`,
    };
  }

  return {};
}

function seatingBlockReason(reservation: WaiterReservationApi, status: string) {
  if (status === "SEATED") return "Reservation is already seated.";
  if (status === "COMPLETED") return "Reservation is already completed.";
  if (status === "CANCELLED") return "Cancelled reservations cannot be seated.";
  if (status === "NO_SHOW") return "No-show reservations cannot be seated.";
  if (status === "PENDING") return "Reservation must be confirmed before seating.";
  if (!reservation.tableId && !reservation.table?.id) return "Assign a table before seating.";
  if (status !== "CONFIRMED") return "Backend state does not allow seating yet.";
  return undefined;
}

export function normalizeWaiterReservation(
  reservation: WaiterReservationApi,
): WaiterReservationViewModel {
  const status = normalizeReservationStatus(reservation.status);
  const tableId = reservation.tableId || reservation.table?.id || undefined;
  const tableName = reservation.table?.label || "Table not assigned";
  const deposit = normalizeDeposit(reservation.deposits, reservation.depositRequired);
  const blockedReason = seatingBlockReason(reservation, status.raw);
  const partySize = reservation.partySize || 0;
  const reservationNumber = reservation.reservationNumber || reservation.id;
  const guestName = reservation.customerName || "Guest not added";
  const source = reservation.source ? titleCase(reservation.source) : undefined;

  const viewModel: WaiterReservationViewModel = {
    id: reservation.id,
    reservationNumber,
    guest: {
      name: guestName,
      phone: reservation.customerPhone || undefined,
      email: reservation.customerEmail || undefined,
    },
    partySize,
    partyLabel: partySize ? `${partySize} ${partySize === 1 ? "guest" : "guests"}` : "Party size unavailable",
    reservationAt: reservation.reservationAt || undefined,
    timeLabel: formatTime(reservation.reservationAt || undefined),
    dateLabel: formatDate(reservation.reservationAt || undefined),
    relativeTimeLabel: relativeReservationLabel(reservation.reservationAt || undefined, status.raw),
    status,
    source,
    table: {
      id: tableId,
      name: tableName,
      capacity: reservation.table?.capacity || undefined,
    },
    depositStatus: deposit.status,
    depositLabel: deposit.label,
    notes: reservation.notes || undefined,
    specialRequests: reservation.specialRequests || undefined,
    seatedAt: reservation.seatedAt || undefined,
    seatedOrderId: reservation.seatedOrderId || reservation.seatedOrder?.id || undefined,
    seatedOrderNumber: reservation.seatedOrder?.orderNumber || undefined,
    canSeat: !blockedReason,
    blockedReason,
    searchText: "",
  };

  viewModel.searchText = [
    viewModel.reservationNumber,
    viewModel.guest.name,
    viewModel.guest.phone,
    viewModel.guest.email,
    viewModel.table.name,
    viewModel.status.label,
    viewModel.status.raw,
    viewModel.source,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return viewModel;
}

export function normalizeWaiterReservations(reservations: WaiterReservationApi[]) {
  return reservations.map(normalizeWaiterReservation);
}

export function filterWaiterReservations(
  reservations: WaiterReservationViewModel[],
  filter: WaiterReservationFilter,
  query: string,
) {
  const q = query.trim().toLowerCase();

  return reservations.filter((reservation) => {
    const status = reservation.status.raw;
    const date = normalizeDate(reservation.reservationAt);
    const isTerminal = status === "CANCELLED" || status === "NO_SHOW" || status === "COMPLETED";
    const isSeated = status === "SEATED" || Boolean(reservation.seatedAt);
    const isLate = Boolean(date && date.getTime() < Date.now() && !isSeated && !isTerminal);

    const matchesFilter =
      filter === "all" ||
      (filter === "upcoming" && !isSeated && !isTerminal && Boolean(date && date.getTime() >= Date.now())) ||
      (filter === "today" && isSameLocalDay(reservation.reservationAt)) ||
      (filter === "seated" && isSeated) ||
      (filter === "late" && isLate);

    if (!matchesFilter) return false;
    if (!q) return true;

    return reservation.searchText.includes(q);
  });
}

export function normalizeSeatResult(
  reservation: WaiterReservationApi,
): WaiterReservationSeatResultViewModel {
  const normalized = normalizeWaiterReservation(reservation);

  return {
    reservationId: normalized.id,
    tableId: normalized.table.id,
    tableName: normalized.table.name,
    orderId: normalized.seatedOrderId,
    orderNumber: normalized.seatedOrderNumber,
    status: normalized.status,
  };
}

export function buildSeatReservationPayload(
  reservation: WaiterReservationViewModel,
): SeatReservationPayload {
  return {
    ...(reservation.table.id ? { tableId: reservation.table.id } : {}),
    createOrder: true,
  };
}
