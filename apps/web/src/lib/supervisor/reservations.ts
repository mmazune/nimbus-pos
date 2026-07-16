import { apiRequest } from "@/lib/api/client";

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
};

export type SupervisorPaginatedReservations = {
  data: SupervisorReservation[];
  total: number;
  page: number;
  pageSize: number;
};

export type SupervisorReservationsQuery = {
  status?: SupervisorReservationStatus;
  date?: string;
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
  appendParam(params, "date", query.date);
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
