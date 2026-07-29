import type { QueryClient } from "@tanstack/react-query";

import { ApiError, apiRequest } from "@/lib/api/client";

export type SupervisorReservationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "SEATED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export type SupervisorReservationSource =
  | "WALK_IN"
  | "PHONE"
  | "WHATSAPP"
  | "INSTAGRAM"
  | "MANUAL"
  | "OTHER"
  | string;

export type SupervisorReservationDepositStatus =
  | "PENDING"
  | "RECEIVED"
  | "APPLIED"
  | "REFUNDED"
  | "FORFEITED"
  | "VOIDED"
  | string;

export type SupervisorReservationEventType =
  | "CREATED"
  | "CONFIRMED"
  | "DEPOSIT_RECORDED"
  | "TABLE_ASSIGNED"
  | "SEATED"
  | "CANCELLED"
  | "NO_SHOW"
  | "DEPOSIT_REFUNDED"
  | "DEPOSIT_FORFEITED"
  | string;

export type SupervisorReservationTable = {
  id: string;
  label?: string | null;
  capacity?: number | null;
  status?: string | null;
  floorPlanId?: string | null;
  floorPlan?: {
    id: string;
    name?: string | null;
  } | null;
};

export type SupervisorReservationOrder = {
  id: string;
  orderNumber?: string | null;
  status?: string | null;
  tableId?: string | null;
};

export type SupervisorReservationDeposit = {
  id: string;
  amount?: string | number | null;
  status?: SupervisorReservationDepositStatus | null;
  method?: string | null;
  reference?: string | null;
  paymentId?: string | null;
  recordedAt?: string | null;
  notes?: string | null;
};

export type SupervisorReservationEvent = {
  id: string;
  type?: SupervisorReservationEventType | null;
  actorUserId?: string | null;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | null;
};

export type SupervisorReservation = {
  id: string;
  orgId?: string;
  branchId?: string;
  reservationNumber?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  partySize?: number | null;
  reservationAt?: string | null;
  expectedDurationMinutes?: number | null;
  source?: SupervisorReservationSource | null;
  status?: SupervisorReservationStatus | string | null;
  notes?: string | null;
  specialRequests?: string | null;
  tableId?: string | null;
  seatedOrderId?: string | null;
  depositRequired?: string | number | null;
  confirmedAt?: string | null;
  seatedAt?: string | null;
  cancelledAt?: string | null;
  noShowAt?: string | null;
  completedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  table?: SupervisorReservationTable | null;
  deposits?: SupervisorReservationDeposit[] | null;
  events?: SupervisorReservationEvent[] | null;
  seatedOrder?: SupervisorReservationOrder | null;
  // Prompt 4A — server-derived Attention signal (never persisted). Terminal
  // rows are always overdue:false. Present on `scope=active`/list responses.
  overdue?: boolean;
  overdueByMinutes?: number;
};

export type SupervisorPaginatedReservations = {
  data: SupervisorReservation[];
  total: number;
  page: number;
  pageSize: number;
  // Prompt 4A — canonical pagination + scope metadata.
  totalPages?: number;
  scope?: "active" | "history" | null;
};

/**
 * Prompt 4A canonical reservation query. `scope` groups active vs. history
 * server-side so Prompt 4B renders Arriving/Seated/Attention/History without a
 * browser-side triple-query merge. `from`/`to` bound history by date range.
 */
export type SupervisorReservationsQuery = {
  status?: SupervisorReservationStatus;
  scope?: "active" | "history";
  date?: string;
  from?: string;
  to?: string;
  upcoming?: boolean;
  tableId?: string;
  page?: number;
  pageSize?: number;
};

export type SupervisorReservationTone = "neutral" | "success" | "warning" | "danger" | "info";

export type SupervisorReservationFilter =
  | "all"
  | "today"
  | "upcoming"
  | "pending"
  | "confirmed"
  | "seated"
  | "awaiting-table"
  | "cancelled-no-show"
  | "deposit-watch";

export type SupervisorReservationSort =
  | "time-asc"
  | "created-desc"
  | "party-desc"
  | "status"
  | "table"
  | "guest";

export type SupervisorReservationSeatingState =
  | "awaiting-table"
  | "table-assigned"
  | "seated"
  | "terminal"
  | "unknown";

export type SupervisorReservationDepositState =
  | "present"
  | "pending"
  | "required"
  | "none"
  | "refunded"
  | "forfeited"
  | "unavailable";

export type SupervisorReservationExceptionTag = {
  key: string;
  label: string;
  tone: SupervisorReservationTone;
};

export type SupervisorReservationViewModel = {
  id: string;
  reservationNumber: string;
  guestName: string;
  guestInitials: string;
  partySize: number | null;
  partyLabel: string;
  reservationAt: string | null;
  timeLabel: string;
  dateLabel: string;
  createdLabel: string;
  updatedLabel: string;
  statusRaw: string;
  statusLabel: string;
  statusTone: SupervisorReservationTone;
  sourceLabel: string;
  tableId: string | null;
  tableLabel: string;
  tableCapacityLabel: string;
  seatingState: SupervisorReservationSeatingState;
  seatingLabel: string;
  depositState: SupervisorReservationDepositState;
  depositLabel: string;
  tags: SupervisorReservationExceptionTag[];
  notes?: string;
  specialRequests?: string;
  searchText: string;
  raw: SupervisorReservation;
};

export const supervisorReservationFilters: Array<{ value: SupervisorReservationFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "seated", label: "Seated" },
  { value: "awaiting-table", label: "Awaiting table" },
  { value: "cancelled-no-show", label: "Cancelled / no-show" },
  { value: "deposit-watch", label: "Deposit watch" },
];

export const supervisorReservationSorts: Array<{ value: SupervisorReservationSort; label: string }> = [
  { value: "time-asc", label: "Reservation time" },
  { value: "created-desc", label: "Created time" },
  { value: "party-desc", label: "Party size" },
  { value: "status", label: "Status" },
  { value: "table", label: "Table" },
  { value: "guest", label: "Guest name" },
];

function appendParam(params: URLSearchParams, key: string, value: string | number | boolean | undefined) {
  if (value === undefined || value === null || value === "") return;
  params.set(key, String(value));
}

function buildReservationsPath(query: SupervisorReservationsQuery = {}) {
  const params = new URLSearchParams();
  appendParam(params, "status", query.status);
  appendParam(params, "scope", query.scope);
  appendParam(params, "date", query.date);
  appendParam(params, "from", query.from);
  appendParam(params, "to", query.to);
  appendParam(params, "upcoming", query.upcoming);
  appendParam(params, "tableId", query.tableId);
  appendParam(params, "page", query.page);
  appendParam(params, "pageSize", query.pageSize);

  const qs = params.toString();
  return `/api/reservations${qs ? `?${qs}` : ""}`;
}

export function fetchSupervisorReservations(
  token: string,
  branchId: string,
  query: SupervisorReservationsQuery = {},
) {
  return apiRequest<SupervisorPaginatedReservations>(buildReservationsPath(query), { token, branchId });
}

export function fetchSupervisorUpcomingReservations(token: string, branchId: string) {
  return apiRequest<SupervisorReservation[]>("/api/reservations/upcoming", { token, branchId });
}

/**
 * Prompt 4A canonical helpers. These replace the legacy all/today/upcoming
 * triple-query + `mergeSupervisorReservationRows` browser merge: the server now
 * separates active vs. history, so Prompt 4B fetches each scope directly and
 * paginates history independently — no client-side dedupe of overlapping lists.
 */
export function fetchSupervisorActiveReservations(
  token: string,
  branchId: string,
  query: Omit<SupervisorReservationsQuery, "scope"> = {},
) {
  return apiRequest<SupervisorPaginatedReservations>(
    buildReservationsPath({ ...query, scope: "active" }),
    { token, branchId },
  );
}

export function fetchSupervisorReservationHistory(
  token: string,
  branchId: string,
  query: Omit<SupervisorReservationsQuery, "scope"> = {},
) {
  return apiRequest<SupervisorPaginatedReservations>(
    buildReservationsPath({ ...query, scope: "history" }),
    { token, branchId },
  );
}

/** Manual SEATED → COMPLETED completion (Supervisor, `pos:reservation:update`). */
export function completeSupervisorReservation(
  token: string,
  branchId: string,
  reservationId: string,
  note?: string,
) {
  return apiRequest<SupervisorReservation>(`/api/reservations/${reservationId}/complete`, {
    method: "POST",
    body: note ? { note } : {},
    token,
    branchId,
  });
}

/**
 * React Query key factory for reservation data. A single source of truth so
 * mutations invalidate exactly the reservation surfaces (active queue, history,
 * detail, events) and never menu / profile / auth / shift / approvals caches.
 */
export const supervisorReservationKeys = {
  all: ["supervisor", "reservations"] as const,
  lists: () => [...supervisorReservationKeys.all, "list"] as const,
  list: (query: SupervisorReservationsQuery = {}) =>
    [...supervisorReservationKeys.lists(), query] as const,
  active: (query: Omit<SupervisorReservationsQuery, "scope"> = {}) =>
    [...supervisorReservationKeys.lists(), "active", query] as const,
  history: (query: Omit<SupervisorReservationsQuery, "scope"> = {}) =>
    [...supervisorReservationKeys.lists(), "history", query] as const,
  upcoming: () => [...supervisorReservationKeys.all, "upcoming"] as const,
  details: () => [...supervisorReservationKeys.all, "detail"] as const,
  detail: (reservationId: string) =>
    [...supervisorReservationKeys.details(), reservationId] as const,
  events: (reservationId: string) =>
    [...supervisorReservationKeys.all, "events", reservationId] as const,
};

/**
 * The exact query-key roots to invalidate after any reservation mutation.
 * Scoped so a reservation change never invalidates unrelated caches (menu,
 * profile, auth, active shift, approvals, all orders, cashier queues).
 */
export function supervisorReservationInvalidationKeys(
  reservationId?: string,
): ReadonlyArray<readonly unknown[]> {
  const keys: ReadonlyArray<readonly unknown[]> = [
    supervisorReservationKeys.lists(),
    supervisorReservationKeys.upcoming(),
  ];
  return reservationId
    ? [
        ...keys,
        supervisorReservationKeys.detail(reservationId),
        supervisorReservationKeys.events(reservationId),
      ]
    : keys;
}

export function fetchSupervisorReservationDetail(token: string, branchId: string, reservationId: string) {
  return apiRequest<SupervisorReservation>(`/api/reservations/${reservationId}`, { token, branchId });
}

export function fetchSupervisorReservationDeposits(token: string, branchId: string, reservationId: string) {
  return apiRequest<SupervisorReservationDeposit[]>(`/api/reservations/${reservationId}/deposits`, {
    token,
    branchId,
  });
}

export function fetchSupervisorReservationEvents(token: string, branchId: string, reservationId: string) {
  return apiRequest<SupervisorReservationEvent[]>(`/api/reservations/${reservationId}/events`, {
    token,
    branchId,
  });
}

export function toSupervisorReservationMoneyNumber(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function formatSupervisorReservationMoney(value: string | number | null | undefined) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(toSupervisorReservationMoneyNumber(value));
}

export function todayIsoDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateTimeMs(value: string | null | undefined) {
  return parseDate(value)?.getTime() || 0;
}

function formatDateTime(value: string | null | undefined, fallback = "Time unavailable") {
  const date = parseDate(value);
  if (!date) return fallback;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatShortTime(value: string | null | undefined) {
  const date = parseDate(value);
  if (!date) return "Time unavailable";

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatShortDate(value: string | null | undefined) {
  const date = parseDate(value);
  if (!date) return "Date unavailable";

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function titleCase(value: string | null | undefined, fallback = "Unavailable") {
  if (!value) return fallback;
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isSameLocalDay(value: string | null | undefined, date = new Date()) {
  const parsed = parseDate(value);
  if (!parsed) return false;

  return (
    parsed.getFullYear() === date.getFullYear() &&
    parsed.getMonth() === date.getMonth() &&
    parsed.getDate() === date.getDate()
  );
}

function isUpcoming(value: string | null | undefined) {
  const parsed = parseDate(value);
  return Boolean(parsed && parsed.getTime() >= Date.now());
}

function initialsFromGuestName(value: string) {
  const initials = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "GU";
}

export function getSupervisorReservationStatusLabel(status: string | null | undefined) {
  const raw = String(status || "UNKNOWN").toUpperCase();
  if (raw === "NO_SHOW") return "No-show";
  if (raw === "UNKNOWN") return "Status unknown";
  return titleCase(raw, "Status unknown");
}

export function getSupervisorReservationStatusTone(status: string | null | undefined): SupervisorReservationTone {
  const raw = String(status || "").toUpperCase();
  if (raw === "SEATED" || raw === "COMPLETED") return "success";
  if (raw === "CONFIRMED") return "info";
  if (raw === "PENDING") return "warning";
  if (raw === "CANCELLED" || raw === "NO_SHOW") return "danger";
  return "neutral";
}

export function getSupervisorReservationSeatingState(
  reservation: SupervisorReservation,
): SupervisorReservationSeatingState {
  const status = String(reservation.status || "").toUpperCase();
  if (status === "SEATED" || reservation.seatedAt) return "seated";
  if (status === "CANCELLED" || status === "NO_SHOW" || status === "COMPLETED") return "terminal";
  if (reservation.tableId || reservation.table?.id) return "table-assigned";
  if (status === "PENDING" || status === "CONFIRMED") return "awaiting-table";
  return "unknown";
}

export function getSupervisorReservationSeatingLabel(state: SupervisorReservationSeatingState) {
  const labels: Record<SupervisorReservationSeatingState, string> = {
    "awaiting-table": "Awaiting table",
    "table-assigned": "Table assigned",
    seated: "Seated",
    terminal: "Terminal",
    unknown: "Seating unknown",
  };
  return labels[state];
}

export function getSupervisorReservationDepositState(
  reservation: Pick<SupervisorReservation, "depositRequired" | "deposits">,
): SupervisorReservationDepositState {
  const deposits = reservation.deposits || [];
  const latest = deposits[0];
  const required = toSupervisorReservationMoneyNumber(reservation.depositRequired);

  if (!latest && required <= 0) return "none";
  if (!latest && required > 0) return "required";

  const status = String(latest?.status || "").toUpperCase();
  if (status === "RECEIVED" || status === "APPLIED") return "present";
  if (status === "PENDING") return "pending";
  if (status === "REFUNDED") return "refunded";
  if (status === "FORFEITED" || status === "VOIDED") return "forfeited";
  return "unavailable";
}

export function getSupervisorReservationDepositLabel(
  reservation: Pick<SupervisorReservation, "depositRequired" | "deposits">,
) {
  const deposits = reservation.deposits || [];
  const latest = deposits[0];
  const state = getSupervisorReservationDepositState(reservation);
  const latestAmount = toSupervisorReservationMoneyNumber(latest?.amount);
  const required = toSupervisorReservationMoneyNumber(reservation.depositRequired);
  const amount = latestAmount > 0 ? latestAmount : required;

  if (state === "none") return "Deposit status unavailable";
  if (state === "required") return `Deposit required ${formatSupervisorReservationMoney(amount)}`;
  if (state === "present") return `Deposit present ${formatSupervisorReservationMoney(amount)}`;
  if (state === "pending") return `Deposit pending ${formatSupervisorReservationMoney(amount)}`;
  if (state === "refunded") return `Deposit refunded ${formatSupervisorReservationMoney(amount)}`;
  if (state === "forfeited") return `Deposit final ${formatSupervisorReservationMoney(amount)}`;
  return "Deposit status unavailable";
}

export function getSupervisorReservationExceptionTags(
  reservation: SupervisorReservation,
): SupervisorReservationExceptionTag[] {
  const tags: SupervisorReservationExceptionTag[] = [];
  const status = String(reservation.status || "").toUpperCase();
  const seatingState = getSupervisorReservationSeatingState(reservation);
  const depositState = getSupervisorReservationDepositState(reservation);
  const partySize = reservation.partySize || 0;

  if (status === "CONFIRMED") tags.push({ key: "confirmed", label: "Confirmed", tone: "info" });
  if (status === "PENDING") tags.push({ key: "pending", label: "Pending confirmation", tone: "warning" });
  if (seatingState === "awaiting-table") {
    tags.push({ key: "awaiting-table", label: "Awaiting table", tone: "warning" });
  }
  if (seatingState === "table-assigned") {
    tags.push({ key: "table-assigned", label: "Table assigned", tone: "success" });
  }
  if (seatingState === "seated") tags.push({ key: "seated", label: "Seated", tone: "success" });
  if (status === "CANCELLED") tags.push({ key: "cancelled", label: "Cancelled", tone: "danger" });
  if (status === "NO_SHOW") tags.push({ key: "no-show", label: "No-show", tone: "danger" });
  if (depositState === "present") tags.push({ key: "deposit-present", label: "Deposit present", tone: "info" });
  if (depositState === "pending" || depositState === "required") {
    tags.push({ key: "deposit-pending", label: "Deposit pending", tone: "warning" });
  }
  if (partySize >= 8) tags.push({ key: "large-party", label: "Large party", tone: "info" });
  if (isSameLocalDay(reservation.reservationAt)) tags.push({ key: "today", label: "Today", tone: "info" });
  if (isUpcoming(reservation.reservationAt)) tags.push({ key: "upcoming", label: "Upcoming", tone: "neutral" });

  return tags;
}

export function normalizeSupervisorReservation(
  reservation: SupervisorReservation,
): SupervisorReservationViewModel {
  const statusRaw = String(reservation.status || "UNKNOWN").toUpperCase();
  const guestName = reservation.customerName?.trim() || "Guest unavailable";
  const partySize = typeof reservation.partySize === "number" ? reservation.partySize : null;
  const seatingState = getSupervisorReservationSeatingState(reservation);
  const tableId = reservation.tableId || reservation.table?.id || null;
  const tableLabel = reservation.table?.label || (tableId ? tableId : "Table unassigned");
  const depositState = getSupervisorReservationDepositState(reservation);
  const tags = getSupervisorReservationExceptionTags(reservation);

  const viewModel: SupervisorReservationViewModel = {
    id: reservation.id,
    reservationNumber: reservation.reservationNumber || reservation.id,
    guestName,
    guestInitials: initialsFromGuestName(guestName),
    partySize,
    partyLabel: partySize ? `${partySize} ${partySize === 1 ? "guest" : "guests"}` : "Party size unavailable",
    reservationAt: reservation.reservationAt || null,
    timeLabel: formatShortTime(reservation.reservationAt),
    dateLabel: formatShortDate(reservation.reservationAt),
    createdLabel: formatDateTime(reservation.createdAt, "Created time unavailable"),
    updatedLabel: formatDateTime(reservation.updatedAt, "Updated time unavailable"),
    statusRaw,
    statusLabel: getSupervisorReservationStatusLabel(statusRaw),
    statusTone: getSupervisorReservationStatusTone(statusRaw),
    sourceLabel: reservation.source ? titleCase(reservation.source) : "Source unavailable",
    tableId,
    tableLabel,
    tableCapacityLabel:
      typeof reservation.table?.capacity === "number"
        ? `${reservation.table.capacity} seats`
        : "Table capacity unavailable",
    seatingState,
    seatingLabel: getSupervisorReservationSeatingLabel(seatingState),
    depositState,
    depositLabel: getSupervisorReservationDepositLabel(reservation),
    tags,
    notes: reservation.notes || undefined,
    specialRequests: reservation.specialRequests || undefined,
    searchText: "",
    raw: reservation,
  };

  viewModel.searchText = [
    viewModel.id,
    viewModel.reservationNumber,
    viewModel.guestName,
    viewModel.partyLabel,
    viewModel.tableLabel,
    viewModel.statusLabel,
    viewModel.statusRaw,
    viewModel.sourceLabel,
    viewModel.notes,
    viewModel.specialRequests,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return viewModel;
}

export function normalizeSupervisorReservations(reservations: SupervisorReservation[]) {
  return reservations.map(normalizeSupervisorReservation);
}

export function mergeSupervisorReservationRows(...groups: SupervisorReservation[][]) {
  const map = new Map<string, SupervisorReservation>();
  groups.flat().forEach((reservation) => {
    map.set(reservation.id, {
      ...(map.get(reservation.id) || {}),
      ...reservation,
      deposits: reservation.deposits || map.get(reservation.id)?.deposits,
      events: reservation.events || map.get(reservation.id)?.events,
    });
  });
  return Array.from(map.values());
}

export function filterSupervisorReservations({
  filter,
  query,
  reservations,
  tableId,
}: {
  filter: SupervisorReservationFilter;
  query: string;
  reservations: SupervisorReservationViewModel[];
  tableId?: string | null;
}) {
  const needle = query.trim().toLowerCase();

  return reservations.filter((reservation) => {
    if (tableId && reservation.tableId !== tableId) return false;

    const status = reservation.statusRaw;
    const matchesFilter =
      filter === "all" ||
      (filter === "today" && isSameLocalDay(reservation.reservationAt)) ||
      (filter === "upcoming" && isUpcoming(reservation.reservationAt)) ||
      (filter === "pending" && status === "PENDING") ||
      (filter === "confirmed" && status === "CONFIRMED") ||
      (filter === "seated" && status === "SEATED") ||
      (filter === "awaiting-table" && reservation.seatingState === "awaiting-table") ||
      (filter === "cancelled-no-show" && (status === "CANCELLED" || status === "NO_SHOW")) ||
      (filter === "deposit-watch" &&
        (reservation.depositState === "present" ||
          reservation.depositState === "pending" ||
          reservation.depositState === "required"));

    if (!matchesFilter) return false;
    if (!needle) return true;

    return reservation.searchText.includes(needle);
  });
}

export function sortSupervisorReservations(
  reservations: SupervisorReservationViewModel[],
  sort: SupervisorReservationSort,
) {
  return [...reservations].sort((a, b) => {
    if (sort === "created-desc") return dateTimeMs(b.raw.createdAt) - dateTimeMs(a.raw.createdAt);
    if (sort === "party-desc") return (b.partySize || 0) - (a.partySize || 0);
    if (sort === "status") return a.statusLabel.localeCompare(b.statusLabel);
    if (sort === "table") return a.tableLabel.localeCompare(b.tableLabel, undefined, { numeric: true });
    if (sort === "guest") return a.guestName.localeCompare(b.guestName);
    return dateTimeMs(a.reservationAt) - dateTimeMs(b.reservationAt);
  });
}

export function countSupervisorReservations(reservations: SupervisorReservationViewModel[]) {
  return {
    today: reservations.filter((reservation) => isSameLocalDay(reservation.reservationAt)).length,
    upcoming: reservations.filter((reservation) => isUpcoming(reservation.reservationAt)).length,
    confirmed: reservations.filter((reservation) => reservation.statusRaw === "CONFIRMED").length,
    seated: reservations.filter((reservation) => reservation.statusRaw === "SEATED").length,
    awaitingTable: reservations.filter((reservation) => reservation.seatingState === "awaiting-table").length,
    terminal: reservations.filter(
      (reservation) => reservation.statusRaw === "CANCELLED" || reservation.statusRaw === "NO_SHOW",
    ).length,
    depositWatch: reservations.filter(
      (reservation) =>
        reservation.depositState === "present" ||
        reservation.depositState === "pending" ||
        reservation.depositState === "required",
    ).length,
  };
}

// ============================================================================
// Prompt 4B — Reservation lifecycle mutations (Supervisor).
//
// The Supervisor role already holds EVERY reservation permission
// (`pos:reservation:` create / read / confirm / seat / cancel / no-show /
// update[=complete] / table:assign / deposit:*) — verified in packages/db seed
// (Supervisor block). These helpers therefore expose already-verified backend
// endpoints; Prompt 4B adds NO permission and NO backend contract change.
//
// Canonical transition map (apps/api reservations.service VALID_TRANSITIONS):
//   PENDING   → CONFIRMED | CANCELLED | NO_SHOW
//   CONFIRMED → SEATED    | CANCELLED | NO_SHOW
//   SEATED    → COMPLETED
//   terminal  → (none)
// Seat additionally requires an assigned table. Overdue grace = 15 min and is
// server-derived for PENDING/CONFIRMED only (SEATED is never `overdue`).
// ============================================================================

export type CreateSupervisorReservationInput = {
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  partySize: number;
  /** ISO 8601 instant (`@IsDateString`). */
  reservationAt: string;
  expectedDurationMinutes?: number;
  source?: string;
  tableId?: string;
  depositRequired?: number;
  notes?: string;
  specialRequests?: string;
};

export type SeatSupervisorReservationInput = {
  tableId?: string;
  createOrder?: boolean;
  orderNotes?: string;
};

export type SupervisorReservationCancelOutcome = "REFUND" | "FORFEIT" | "NO_DEPOSIT";
export type SupervisorReservationNoShowOutcome = "FORFEIT" | "REFUND" | "NO_DEPOSIT";

/** POST /api/reservations (`pos:reservation:create`). Returns the canonical row. */
export function createSupervisorReservation(
  token: string,
  branchId: string,
  input: CreateSupervisorReservationInput,
) {
  return apiRequest<SupervisorReservation>("/api/reservations", {
    method: "POST",
    body: input,
    token,
    branchId,
  });
}

/** PATCH /api/reservations/:id/confirm (`pos:reservation:confirm`). PENDING → CONFIRMED. */
export function confirmSupervisorReservation(
  token: string,
  branchId: string,
  reservationId: string,
  notes?: string,
) {
  return apiRequest<SupervisorReservation>(`/api/reservations/${reservationId}/confirm`, {
    method: "PATCH",
    body: notes ? { notes } : {},
    token,
    branchId,
  });
}

/** PATCH /api/reservations/:id/assign-table (`pos:reservation:table:assign`). Assign / reassign. */
export function assignSupervisorReservationTable(
  token: string,
  branchId: string,
  reservationId: string,
  tableId: string,
) {
  return apiRequest<SupervisorReservation>(`/api/reservations/${reservationId}/assign-table`, {
    method: "PATCH",
    body: { tableId },
    token,
    branchId,
  });
}

/** PATCH /api/reservations/:id/seat (`pos:reservation:seat`). CONFIRMED → SEATED (table required). */
export function seatSupervisorReservation(
  token: string,
  branchId: string,
  reservationId: string,
  input: SeatSupervisorReservationInput = {},
) {
  return apiRequest<SupervisorReservation>(`/api/reservations/${reservationId}/seat`, {
    method: "PATCH",
    body: input,
    token,
    branchId,
  });
}

/** PATCH /api/reservations/:id/cancel (`pos:reservation:cancel`). Active → CANCELLED. Reason required. */
export function cancelSupervisorReservation(
  token: string,
  branchId: string,
  reservationId: string,
  reason: string,
  depositOutcome?: SupervisorReservationCancelOutcome,
) {
  return apiRequest<SupervisorReservation>(`/api/reservations/${reservationId}/cancel`, {
    method: "PATCH",
    body: depositOutcome ? { reason, depositOutcome } : { reason },
    token,
    branchId,
  });
}

/** PATCH /api/reservations/:id/no-show (`pos:reservation:no-show`). PENDING/CONFIRMED → NO_SHOW. */
export function markSupervisorReservationNoShow(
  token: string,
  branchId: string,
  reservationId: string,
  input: { reason?: string; depositOutcome?: SupervisorReservationNoShowOutcome } = {},
) {
  const body: Record<string, unknown> = {};
  if (input.reason) body.reason = input.reason;
  if (input.depositOutcome) body.depositOutcome = input.depositOutcome;
  return apiRequest<SupervisorReservation>(`/api/reservations/${reservationId}/no-show`, {
    method: "PATCH",
    body,
    token,
    branchId,
  });
}

// ── Cross-role (Waiter) invalidation ────────────────────────────────────────
// A Supervisor reservation mutation persists canonically; Waiter's next fetch
// sees it. Within a shared React Query cache we still invalidate the Waiter
// reservation + floor surfaces NARROWLY (never menu / profile / auth / shift /
// orders-queue broadly). Keys mirror WaiterReservationsScreen exactly.
export function waiterReservationInvalidationKeys(
  reservationId?: string,
): ReadonlyArray<readonly unknown[]> {
  const keys: Array<readonly unknown[]> = [
    ["waiter", "reservations"],
    ["waiter", "floor"],
  ];
  if (reservationId) keys.push(["waiter", "reservation"]);
  return keys;
}

// ============================================================================
// Prompt 4B — View grouping (Arriving / Seated / Attention / History).
// These are UI groupings over the server-separated active/history scopes, never
// persisted statuses. Arriving/Seated/Attention derive from ONE bounded
// `scope=active` response (no browser triple-query merge); History is its own
// server-paginated `scope=history` query.
// ============================================================================

export type SupervisorReservationView = "arriving" | "seated" | "attention" | "history";

export const supervisorReservationViews: Array<{
  value: SupervisorReservationView;
  label: string;
}> = [
  { value: "arriving", label: "Arriving" },
  { value: "seated", label: "Seated" },
  { value: "attention", label: "Attention" },
  { value: "history", label: "History" },
];

export function isSupervisorReservationView(value: unknown): value is SupervisorReservationView {
  return value === "arriving" || value === "seated" || value === "attention" || value === "history";
}

export type SupervisorReservationAttentionReason = {
  key: string;
  label: string;
  tone: SupervisorReservationTone;
};

/** Human overdue label from server-derived minutes (e.g. "42 minutes overdue"). */
export function formatSupervisorReservationOverdue(minutes: number | null | undefined): string {
  const value = typeof minutes === "number" && Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
  if (value < 60) return `${value} minute${value === 1 ? "" : "s"} overdue`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  if (rest === 0) return `${hours} hour${hours === 1 ? "" : "s"} overdue`;
  return `${hours}h ${rest}m overdue`;
}

function reservationSeatedOrderStatus(reservation: SupervisorReservation): string {
  return String(reservation.seatedOrder?.status || "").toUpperCase();
}

function reservationHasLinkedOrder(reservation: SupervisorReservation): boolean {
  return Boolean(reservation.seatedOrderId || reservation.seatedOrder?.id);
}

function reservationHasTable(reservation: SupervisorReservation): boolean {
  return Boolean(reservation.tableId || reservation.table?.id);
}

/**
 * Derive the Attention signal for a single reservation. Terminal rows are never
 * Attention. Overdue uses the server-derived `overdue`/`overdueByMinutes` (never
 * inferred from the clock alone); the SEATED inconsistencies are structural and
 * derived here because the backend only flags overdue for PENDING/CONFIRMED.
 * Copy is operational, never implementation ("Seated without a linked order",
 * not "backend mismatch").
 */
export function getSupervisorReservationAttention(reservation: SupervisorReservation): {
  isAttention: boolean;
  reasons: SupervisorReservationAttentionReason[];
} {
  const status = String(reservation.status || "").toUpperCase();
  if (status === "COMPLETED" || status === "CANCELLED" || status === "NO_SHOW") {
    return { isAttention: false, reasons: [] };
  }

  const reasons: SupervisorReservationAttentionReason[] = [];

  if (reservation.overdue && (status === "PENDING" || status === "CONFIRMED")) {
    reasons.push({
      key: "overdue",
      label: formatSupervisorReservationOverdue(reservation.overdueByMinutes),
      tone: "danger",
    });
    if (!reservationHasTable(reservation)) {
      reasons.push({ key: "overdue-no-table", label: "Table assignment needs review", tone: "warning" });
    }
  }

  if (status === "SEATED") {
    if (!reservationHasLinkedOrder(reservation)) {
      reasons.push({ key: "seated-no-order", label: "Seated without a linked order", tone: "warning" });
    } else {
      const orderStatus = reservationSeatedOrderStatus(reservation);
      if (orderStatus === "CLOSED" || orderStatus === "COMPLETED" || orderStatus === "PAID") {
        reasons.push({ key: "seated-closed-order", label: "Linked order is closed", tone: "warning" });
      }
    }
    if (!reservationHasTable(reservation)) {
      reasons.push({ key: "seated-no-table", label: "Seated without a table", tone: "warning" });
    }
  }

  return { isAttention: reasons.length > 0, reasons };
}

export type SupervisorReservationGroups = {
  arriving: SupervisorReservationViewModel[];
  seated: SupervisorReservationViewModel[];
  attention: SupervisorReservationViewModel[];
  counts: { arriving: number; seated: number; attention: number };
};

/**
 * Split a bounded `scope=active` response into the three operational groupings.
 * `arriving` = PENDING/CONFIRMED on the selected operational date (chronological);
 * `seated` = SEATED (visit context); `attention` = any active row with an
 * Attention signal (date-independent — overdue rows are in the past). One row
 * may legitimately appear in both Seated and Attention (a seated visit whose
 * linked order is inconsistent) — the views are lenses, not partitions.
 */
export function groupSupervisorActiveReservations(
  reservations: SupervisorReservationViewModel[],
  selectedDate: string,
): SupervisorReservationGroups {
  const arriving: SupervisorReservationViewModel[] = [];
  const seated: SupervisorReservationViewModel[] = [];
  const attention: SupervisorReservationViewModel[] = [];

  for (const reservation of reservations) {
    const status = reservation.statusRaw;
    const attentionSignal = getSupervisorReservationAttention(reservation.raw);
    if (attentionSignal.isAttention) attention.push(reservation);

    if (status === "SEATED") {
      seated.push(reservation);
      continue;
    }
    if (
      (status === "PENDING" || status === "CONFIRMED") &&
      isSameLocalDay(reservation.reservationAt, new Date(`${selectedDate}T12:00:00`))
    ) {
      arriving.push(reservation);
    }
  }

  return {
    arriving,
    seated,
    attention,
    counts: { arriving: arriving.length, seated: seated.length, attention: attention.length },
  };
}

// ============================================================================
// Prompt 4B — Action availability (mirrors backend VALID_TRANSITIONS exactly).
// Never offer an action the service would 409. `changeTable`/`assignTable` are
// the two faces of table assignment (reassign vs first assignment).
// ============================================================================

export type SupervisorReservationActions = {
  confirm: boolean;
  assignTable: boolean;
  changeTable: boolean;
  seat: boolean;
  complete: boolean;
  cancel: boolean;
  noShow: boolean;
  /** True for COMPLETED/CANCELLED/NO_SHOW — the detail workspace is read-only. */
  terminal: boolean;
};

export function getSupervisorReservationActions(
  reservation: SupervisorReservation,
): SupervisorReservationActions {
  const status = String(reservation.status || "").toUpperCase();
  const hasTable = reservationHasTable(reservation);
  const isPending = status === "PENDING";
  const isConfirmed = status === "CONFIRMED";
  const isSeated = status === "SEATED";
  const isActivePreSeat = isPending || isConfirmed;
  const terminal = status === "COMPLETED" || status === "CANCELLED" || status === "NO_SHOW";

  return {
    confirm: isPending,
    // assign-table endpoint permits PENDING/CONFIRMED/SEATED (not terminal).
    assignTable: (isActivePreSeat || isSeated) && !hasTable,
    changeTable: (isActivePreSeat || isSeated) && hasTable,
    seat: isConfirmed,
    complete: isSeated,
    cancel: isActivePreSeat,
    noShow: isActivePreSeat,
    terminal,
  };
}

// ── Operational error mapping ────────────────────────────────────────────────
// Map backend errors to clear operator copy. Never surface raw Prisma/SQL. A
// 409 on a lifecycle action almost always means the row moved underneath us
// (stale state) — the caller should refetch canonical detail.
export function supervisorReservationActionErrorCopy(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isAuthError) return "Your session expired. Please log in again.";
    if (error.isForbidden) return "This account cannot perform this reservation action.";
    if (error.status === 404) return "This reservation could not be found. It may have been removed.";
    if (error.status === 409) {
      const message = error.message || "";
      if (/conflicting reservation/i.test(message)) {
        return "That table already has a conflicting reservation in this time window.";
      }
      if (/transition/i.test(message)) {
        return "This reservation already moved to a new state. Its details have been refreshed.";
      }
      return "This reservation changed since it was loaded. Its details have been refreshed.";
    }
    if (error.status === 400) {
      const message = error.message || "";
      if (/table must be assigned/i.test(message)) return "Assign a table before seating this reservation.";
      if (/table not found/i.test(message)) return "That table is not available in this branch.";
      if (message) return message;
      return "The reservation request was rejected. Check the details and try again.";
    }
    return error.message || "The reservation action could not be completed.";
  }
  return error instanceof Error && error.message
    ? error.message
    : "The reservation action could not be completed.";
}

/** Whether a 409/state error should trigger a canonical detail refetch. */
export function isSupervisorReservationStaleStateError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 409 || error.status === 404);
}

// ── Date navigation (operational day toolbar) ────────────────────────────────
export function shiftSupervisorReservationDate(isoDate: string, deltaDays: number): string {
  const base = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(base.getTime())) return todayIsoDate();
  base.setDate(base.getDate() + deltaDays);
  const offset = base.getTimezoneOffset();
  return new Date(base.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function formatSupervisorReservationDayLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  const label = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
  if (isoDate === todayIsoDate()) return `Today · ${label}`;
  return label;
}

// ── Post-mutation cache invalidation (single source of truth) ────────────────
// Invalidate EXACTLY the reservation + floor surfaces (Supervisor active/history/
// detail/events/upcoming, Supervisor Floor overlay, Waiter reservations/floor).
// Never menu / profile / auth / shift / approvals / all-orders / cashier caches.
// Secondary invalidations are fire-and-forget so mutation pending state clears
// on the canonical response, not on downstream refetch settlement.
export function invalidateSupervisorReservationCaches(
  queryClient: QueryClient,
  branchId: string,
  reservationId?: string,
) {
  for (const key of supervisorReservationInvalidationKeys(reservationId)) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
  // Supervisor Floor reservation overlay.
  void queryClient.invalidateQueries({ queryKey: ["supervisor", "floor", branchId] });
  // Cross-role Waiter visibility (narrow).
  for (const key of waiterReservationInvalidationKeys(reservationId)) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
}
