/**
 * The order on a table: its lines (not sent, sent, voided) and every call that
 * changes it. One source for the screen; the session hook in `useOrderSession`
 * holds the lines not yet saved and drives these calls in order.
 */
import { apiRequest } from "@/lib/api/client";

import { toApiAmount, toMinor, type Minor } from "./money";

export type LineState = "unsent" | "sent" | "voided";

export type LineChoice = {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDeltaMinor: Minor;
};

export type OrderLineModel = {
  /** Stable key: the server id once saved, a local key before. */
  key: string;
  serverId: string | null;
  menuItemId: string;
  servingId: string | null;
  name: string;
  servingLabel: string | null;
  choices: LineChoice[];
  note: string;
  quantity: number;
  /** Price of one, with its choices. */
  unitMinor: Minor;
  lineMinor: Minor;
  state: LineState;
  sentAt: string | null;
  station: string | null;
  voidReason: string | null;
  wasMade: boolean | null;
  /** false when the line came from a kitchen ticket, which carries no price. */
  priceKnown?: boolean;
  /** Not sent, and its item is sold out: it cannot go (T2 `unsendable`). */
  unsendable?: boolean;
  /** "19:40": when its item sold out, for the red line's words. */
  soldOutAt?: string;
  /** Held back (starters now, mains later): Send skips it until it is fired. */
  held?: boolean;
  /** Fired and inside its 3-second undo window: goes to the kitchen at `fireAt`. */
  fireAt?: string | null;
  fireId?: string | null;
  /** An allergy said for this line ("nuts"); the kitchen sees it in red. */
  allergy?: string | null;
  takeaway?: boolean;
  guest?: number | null;
};

export type OrderModel = {
  id: string;
  number: string | null;
  status: string;
  tableId: string | null;
  waiterId: string | null;
  waiterName: string | null;
  openedAt: string | null;
  totalMinor: Minor;
  /** Discount taken off the bill (approved discounts only; the server keeps the sum). */
  discountMinor: Minor;
  lines: OrderLineModel[];
};

export type OrderSummary = {
  id: string;
  status: string;
  tableId: string | null;
  waiterId: string | null;
  waiterName: string | null;
  openedAt: string | null;
  totalMinor: Minor;
  itemCount: number;
};

// ── API shapes ──

type ApiChoiceMeta = {
  modifierGroupId?: string;
  modifierGroupName?: string;
  modifierOptionId?: string;
  modifierOptionName?: string;
  priceDelta?: string | number | null;
};

type ApiLine = {
  id: string;
  menuItemId?: string | null;
  menuItemServingId?: string | null;
  quantity?: number | null;
  price?: string | number | null;
  subtotal?: string | number | null;
  notes?: string | null;
  metadata?: { selectedModifiers?: ApiChoiceMeta[]; servingLabel?: string } | null;
  sentAt?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  wasMade?: boolean | null;
  menuItem?: { id: string; name?: string | null; station?: string | null } | null;
  menuItemServing?: { id: string; label?: string | null; format?: string | null } | null;
  unsendable?: boolean | null;
  heldAt?: string | null;
  fireAt?: string | null;
  fireId?: string | null;
  allergy?: string | null;
  takeaway?: boolean | null;
  guest?: number | null;
};

type ApiUser = { id?: string | null; firstName?: string | null; lastName?: string | null } | null;

type ApiOrder = {
  id: string;
  orderNumber?: string | null;
  status?: string | null;
  tableId?: string | null;
  userId?: string | null;
  user?: ApiUser;
  total?: string | number | null;
  discount?: string | number | null;
  createdAt?: string | null;
  items?: ApiLine[] | null;
};

// ── Pure helpers ──

/** "Amina Kato" → "Amina K." (the staff format on the floor). */
export function shortName(user: ApiUser | undefined): string | null {
  const first = (user?.firstName ?? "").trim();
  const last = (user?.lastName ?? "").trim();
  if (!first && !last) return null;
  return last ? `${first} ${last.charAt(0)}.`.trim() : first;
}

const LEAVE_OUT = /(^|\s)(leave out|without|no)\b/i;

/** "Double · Cola", "Medium · No onions", then the note. */
export function choicesText(
  line: Pick<OrderLineModel, "servingLabel" | "choices" | "note"> & Partial<Pick<OrderLineModel, "allergy" | "takeaway" | "held" | "guest">>,
): string {
  const parts: string[] = [];
  if (line.held) parts.push("Held for later");
  if (line.servingLabel) parts.push(line.servingLabel);
  for (const c of line.choices) {
    // A choice saved without a name (an older line or an API-made one) shows nothing, never a bare "·".
    if (!c.optionName.trim()) continue;
    parts.push(LEAVE_OUT.test(c.groupName) ? `No ${c.optionName.toLowerCase()}` : c.optionName);
  }
  if (line.allergy) parts.push(`${line.allergy} allergy`);
  if (line.takeaway) parts.push("Takeaway");
  if (typeof line.guest === "number") parts.push(`Guest ${line.guest}`);
  if (line.note.trim()) parts.push(line.note.trim());
  return parts.join(" · ");
}

export function mapLine(raw: ApiLine): OrderLineModel {
  const quantity = raw.quantity ?? 1;
  const unit = toMinor(raw.price) ?? 0;
  const servingRaw = raw.metadata?.servingLabel ?? raw.menuItemServing?.label ?? null;
  const servingLabel = servingRaw && servingRaw.toLowerCase() !== "standard" ? servingRaw : null;
  return {
    key: raw.id,
    serverId: raw.id,
    menuItemId: raw.menuItemId ?? raw.menuItem?.id ?? "",
    servingId: raw.menuItemServingId ?? raw.menuItemServing?.id ?? null,
    name: (raw.menuItem?.name ?? "").trim() || "Item",
    servingLabel,
    choices: (raw.metadata?.selectedModifiers ?? []).map((m) => ({
      groupId: m.modifierGroupId ?? "",
      groupName: m.modifierGroupName ?? "",
      optionId: m.modifierOptionId ?? "",
      optionName: m.modifierOptionName ?? "",
      priceDeltaMinor: toMinor(m.priceDelta) ?? 0,
    })),
    note: raw.notes ?? "",
    quantity,
    unitMinor: unit,
    lineMinor: toMinor(raw.subtotal) ?? unit * quantity,
    state: raw.voidedAt ? "voided" : raw.sentAt ? "sent" : "unsent",
    sentAt: raw.sentAt ?? null,
    station: raw.menuItem?.station ?? null,
    voidReason: raw.voidReason ?? null,
    wasMade: raw.wasMade ?? null,
    unsendable: Boolean(raw.unsendable) && !raw.sentAt && !raw.voidedAt,
    held: Boolean(raw.heldAt) && !raw.sentAt && !raw.fireAt,
    fireAt: !raw.sentAt ? raw.fireAt ?? null : null,
    fireId: raw.fireId ?? null,
    allergy: raw.allergy?.trim() || null,
    takeaway: Boolean(raw.takeaway),
    guest: raw.guest ?? null,
  };
}

export function mapOrder(raw: ApiOrder): OrderModel {
  return {
    id: raw.id,
    number: raw.orderNumber ?? null,
    status: raw.status ?? "NEW",
    tableId: raw.tableId ?? null,
    waiterId: raw.userId ?? raw.user?.id ?? null,
    waiterName: shortName(raw.user),
    openedAt: raw.createdAt ?? null,
    totalMinor: toMinor(raw.total) ?? 0,
    discountMinor: toMinor(raw.discount) ?? 0,
    lines: (raw.items ?? []).map(mapLine),
  };
}

export function mapSummary(raw: ApiOrder): OrderSummary {
  return {
    id: raw.id,
    status: raw.status ?? "NEW",
    tableId: raw.tableId ?? null,
    waiterId: raw.userId ?? raw.user?.id ?? null,
    waiterName: shortName(raw.user),
    openedAt: raw.createdAt ?? null,
    totalMinor: toMinor(raw.total) ?? 0,
    itemCount: (raw.items ?? []).length,
  };
}

/** The total of every line that is not voided. */
export function linesTotal(lines: OrderLineModel[]): Minor {
  return lines.reduce((sum, l) => (l.state === "voided" ? sum : sum + l.lineMinor), 0);
}

/** Item count as the drawings count it: the sum of quantities on lines that are not voided. */
export function itemCount(lines: OrderLineModel[]): number {
  return lines.reduce((sum, l) => (l.state === "voided" ? sum : sum + l.quantity), 0);
}

export type SentRound = { sentAt: string; lines: OrderLineModel[] };

/** Sent lines grouped by Send, newest first ("SENT 20:15", then "SENT 19:42"). Voided lines stay in their round. */
export function sentRounds(lines: OrderLineModel[]): SentRound[] {
  const map = new Map<string, OrderLineModel[]>();
  for (const l of lines) {
    if (l.state === "unsent" || !l.sentAt) continue;
    const k = l.sentAt;
    map.set(k, [...(map.get(k) ?? []), l]);
  }
  return [...map.entries()]
    .map(([sentAt, ls]) => ({ sentAt, lines: ls }))
    .sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
}

export const OPEN_STATES = ["NEW", "SENT", "IN_KITCHEN", "READY", "SERVED"];
export const PAYABLE_STATES = ["SENT", "IN_KITCHEN", "READY", "SERVED"];

// ── Calls ──

type Ctx = { token: string; branchId: string };

function choicesMeta(line: Pick<OrderLineModel, "choices" | "servingLabel">) {
  if (!line.choices.length && !line.servingLabel) return undefined;
  return {
    ...(line.servingLabel ? { servingLabel: line.servingLabel } : {}),
    selectedModifiers: line.choices.map((c) => ({
      modifierGroupId: c.groupId,
      modifierGroupName: c.groupName,
      modifierOptionId: c.optionId,
      modifierOptionName: c.optionName,
      priceDelta: toApiAmount(c.priceDeltaMinor),
    })),
  };
}

export async function findOpenOrders(ctx: Ctx, tableId: string): Promise<OrderSummary[]> {
  const res = await apiRequest<{ data?: ApiOrder[] }>(
    `/api/pos/orders?tableId=${encodeURIComponent(tableId)}&excludeStatus=CLOSED,VOIDED&pageSize=20`,
    ctx,
  );
  return (res.data ?? []).filter((o) => OPEN_STATES.includes(o.status ?? "")).map(mapSummary);
}

export async function getOrder(ctx: Ctx, orderId: string): Promise<OrderModel> {
  return mapOrder(await apiRequest<ApiOrder>(`/api/pos/orders/${orderId}`, ctx));
}

export async function createOrder(ctx: Ctx, tableId: string): Promise<OrderModel> {
  return mapOrder(
    await apiRequest<ApiOrder>("/api/pos/orders", { ...ctx, method: "POST", body: { serviceType: "DINE_IN", tableId } }),
  );
}

export async function addLine(ctx: Ctx, orderId: string, line: OrderLineModel): Promise<OrderLineModel> {
  const meta = choicesMeta(line);
  return mapLine(
    await apiRequest<ApiLine>(`/api/pos/orders/${orderId}/items`, {
      ...ctx,
      method: "POST",
      body: {
        menuItemId: line.menuItemId,
        ...(line.servingId ? { menuItemServingId: line.servingId } : {}),
        quantity: line.quantity,
        ...(line.note.trim() ? { notes: line.note.trim() } : {}),
        ...(meta ? { metadata: meta } : {}),
        ...(typeof line.guest === "number" ? { guest: line.guest } : {}),
        ...(line.held ? { hold: true } : {}),
        ...(line.allergy ? { allergy: line.allergy } : {}),
        ...(line.takeaway ? { takeaway: true } : {}),
      },
    }),
  );
}

export async function patchLine(ctx: Ctx, orderId: string, line: OrderLineModel): Promise<OrderLineModel> {
  const meta = choicesMeta(line);
  return mapLine(
    await apiRequest<ApiLine>(`/api/pos/orders/${orderId}/items/${line.serverId}`, {
      ...ctx,
      method: "PATCH",
      body: { quantity: line.quantity, notes: line.note.trim(), ...(meta ? { metadata: meta } : {}) },
    }),
  );
}

export async function deleteLine(ctx: Ctx, orderId: string, serverId: string): Promise<void> {
  await apiRequest(`/api/pos/orders/${orderId}/items/${serverId}`, { ...ctx, method: "DELETE" });
}

/** A line Send could not send (T2): its item sold out, or fewer left than asked for. */
export type SkippedLine = { name: string; quantity: number; reason: "SOLD_OUT" | "NOT_ENOUGH_LEFT" | string; left?: number | null };

export type SendReport = { skipped: SkippedLine[]; held: number; sent: number };

/** The code the API puts at the top of a refusal ("ITEM_SOLD_OUT", "NOTHING_SENDABLE", …). */
export function serverCode(e: unknown): string | null {
  const d = e && typeof e === "object" && "details" in e ? (e as { details?: unknown }).details : null;
  return d && typeof d === "object" && typeof (d as { code?: unknown }).code === "string" ? (d as { code: string }).code : null;
}

function skippedOf(raw: unknown): SkippedLine[] {
  return Array.isArray(raw)
    ? raw.map((k: { name?: string; quantity?: number; reason?: string; left?: number | null }) => ({
        name: k.name ?? "An item",
        quantity: k.quantity ?? 1,
        reason: k.reason ?? "SOLD_OUT",
        left: k.left ?? null,
      }))
    : [];
}

/** Send: the server sends what it can, skips what sold out and says which (never all or nothing). */
export async function sendOrder(ctx: Ctx, orderId: string): Promise<SendReport> {
  try {
    const res = await apiRequest<{ sent?: unknown[]; skipped?: unknown; held?: unknown[] }>(`/api/pos/orders/${orderId}/send`, {
      ...ctx,
      method: "POST",
      body: {},
    });
    return { skipped: skippedOf(res?.skipped), held: res?.held?.length ?? 0, sent: res?.sent?.length ?? 0 };
  } catch (e) {
    // Only held lines were new: they are saved and wait for Fire; nothing goes to the kitchen yet.
    if (serverCode(e) === "NOTHING_TO_SEND") return { skipped: [], held: 1, sent: 0 };
    if (serverCode(e) === "NOTHING_SENDABLE") {
      return { skipped: skippedOf((e as { details?: { skipped?: unknown } }).details?.skipped), held: 0, sent: 0 };
    }
    throw e;
  }
}

export type VoidReason =
  | "GUEST_CHANGED_MIND"
  | "WRONG_ITEM"
  | "KITCHEN_RAN_OUT"
  | "TOOK_TOO_LONG"
  | "GUEST_COMPLAINT"
  | "OTHER";

export async function voidLine(
  ctx: Ctx,
  orderId: string,
  serverId: string,
  body: { reason: VoidReason; wasMade: boolean; quantity?: number; note?: string },
): Promise<void> {
  await apiRequest(`/api/orders/${orderId}/items/${serverId}/void`, { ...ctx, method: "POST", body });
}

export async function requestBill(ctx: Ctx, orderId: string): Promise<void> {
  await apiRequest(`/api/pos/orders/${orderId}/request-bill`, { ...ctx, method: "POST", body: {} });
}

export type PayMethod = "CASH" | "CARD" | "MOMO";

export type PayResult = { changeMinor: Minor | null };

export async function payAndClose(
  ctx: Ctx,
  orderId: string,
  payments: Array<{ method: PayMethod; amountMinor: Minor }>,
): Promise<PayResult> {
  const res = await apiRequest<{ change?: string | number | null; changeDue?: string | number | null; payments?: Array<{ changeGiven?: string | number | null }> }>(
    `/api/pos/orders/${orderId}/close`,
    { ...ctx, method: "POST", body: { payments: payments.map((p) => ({ method: p.method, amount: toApiAmount(p.amountMinor) })) } },
  );
  const fromRows = (res.payments ?? []).reduce<Minor | null>((sum, p) => {
    const c = toMinor(p.changeGiven);
    return c === null ? sum : (sum ?? 0) + c;
  }, null);
  return { changeMinor: toMinor(res.change ?? res.changeDue) ?? fromRows };
}

// ── Table actions (supervisor, manager) ──

export type FreeTable = { id: string; label: string; seats: number | null };

export async function listFreeTables(ctx: Ctx, exceptId: string): Promise<FreeTable[]> {
  const rows = await apiRequest<Array<{ id: string; label?: string | null; capacity?: number | null; status?: string | null; isActive?: boolean | null }>>(
    "/api/tables",
    ctx,
  );
  return (rows ?? [])
    .filter((t) => t.id !== exceptId && t.status === "AVAILABLE" && t.isActive !== false)
    .map((t) => ({ id: t.id, label: (t.label ?? "").trim() || "Table", seats: t.capacity ?? null }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}

export async function moveToTable(ctx: Ctx, orderId: string, targetTableId: string): Promise<void> {
  await apiRequest(`/api/pos/orders/${orderId}/transfer-table`, { ...ctx, method: "POST", body: { targetTableId } });
}

/** Returns the discount's status: APPROVED (taken) or PENDING (waiting for approval above the venue's limit). */
export async function askForDiscount(ctx: Ctx, orderId: string, percent: number, reason: string): Promise<string> {
  const res = await apiRequest<{ status?: string | null }>(`/api/pos/orders/${orderId}/discounts`, {
    ...ctx,
    method: "POST",
    body: { type: "PERCENTAGE", value: percent, reason },
  });
  return res?.status ?? "PENDING";
}

export async function cancelOrder(ctx: Ctx, orderId: string, reason: string): Promise<void> {
  await apiRequest(`/api/pos/orders/${orderId}/void`, { ...ctx, method: "POST", body: { reason } });
}

/** Completed payments already posted on the order (the API sums them as `totalPaid`). */
export async function paidOn(ctx: Ctx, orderId: string): Promise<Minor> {
  const res = await apiRequest<{ totalPaid?: string | number | null }>(`/api/pos/orders/${orderId}/payments`, ctx);
  return toMinor(res?.totalPaid) ?? 0;
}

export type OtherOrder = { id: string; tableId: string; waiterId: string | null; tableLabel: string; waiterName: string | null; totalMinor: Minor };

/** Other open orders on other tables in this branch: the targets for Join tables. */
export async function listOtherOpenOrders(ctx: Ctx, exceptOrderId: string): Promise<OtherOrder[]> {
  const res = await apiRequest<{ data?: ApiOrder[] & Array<{ table?: { label?: string | null } | null }> }>(
    "/api/pos/orders?excludeStatus=CLOSED,VOIDED&pageSize=100",
    ctx,
  );
  return (res.data ?? [])
    .filter((o) => o.id !== exceptOrderId && o.tableId && OPEN_STATES.includes(o.status ?? ""))
    .map((o) => ({
      id: o.id,
      tableId: o.tableId as string,
      waiterId: o.userId ?? null,
      tableLabel: ((o as { table?: { label?: string | null } | null }).table?.label ?? "").trim() || "Table",
      waiterName: shortName(o.user),
      totalMinor: toMinor(o.total) ?? 0,
    }))
    .sort((a, b) => a.tableLabel.localeCompare(b.tableLabel, undefined, { numeric: true }));
}

/** Join tables: this order's lines move into the target order (one bill). */
export async function joinInto(ctx: Ctx, sourceOrderId: string, targetOrderId: string): Promise<void> {
  await apiRequest("/api/pos/orders/merge", { ...ctx, method: "POST", body: { sourceOrderId, targetOrderId } });
}

export type StaffMember = { userId: string; name: string };

/** Active staff of this branch with a login: the targets for Change waiter. */
export async function listStaff(ctx: Ctx): Promise<StaffMember[]> {
  type Row = { userId?: string | null; firstName?: string | null; lastName?: string | null; status?: string | null; branchId?: string | null };
  const res = await apiRequest<Row[] | { data?: Row[] }>("/api/hr/employees?take=100", ctx);
  const rows = Array.isArray(res) ? res : res?.data ?? [];
  const seen = new Set<string>();
  return rows
    .filter((e) => e.userId && (e.status ?? "ACTIVE") === "ACTIVE" && e.branchId === ctx.branchId)
    .filter((e) => (seen.has(e.userId as string) ? false : (seen.add(e.userId as string), true)))
    .map((e) => ({ userId: e.userId as string, name: shortName({ firstName: e.firstName, lastName: e.lastName }) ?? "Staff" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function changeWaiter(ctx: Ctx, orderId: string, targetUserId: string): Promise<void> {
  await apiRequest(`/api/pos/orders/${orderId}/transfer-server`, { ...ctx, method: "POST", body: { targetUserId } });
}

/** Split bill: records equal parts for the cashier (the API keeps one bill; payment still closes it in one go). */
export async function splitEqually(ctx: Ctx, orderId: string, count: number): Promise<void> {
  await apiRequest(`/api/pos/orders/${orderId}/split-bill`, { ...ctx, method: "POST", body: { mode: "EQUAL", count } });
}

/** The signed-in person's own open till (cash needs one, or it falls outside every till's count). */
export async function hasOpenTill(ctx: Ctx): Promise<boolean> {
  const till = await apiRequest<{ id?: string } | null>("/api/tills/active", ctx);
  return Boolean(till && till.id);
}

export const TABLE_STATUSES = ["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"] as const;
export type TableStatus = (typeof TABLE_STATUSES)[number];

export async function setTableStatus(ctx: Ctx, tableId: string, status: TableStatus): Promise<void> {
  await apiRequest(`/api/tables/${tableId}/status`, { ...ctx, method: "PATCH", body: { status } });
}

/**
 * Another waiter's lines, as the kitchen sees them. The order read refuses a waiter
 * (`assertWaiterOrderOwnership`), but `pos:kds:read` lists every ticket with its
 * order lines; this keeps the lines of one order. Sent lines only (unsent lines
 * have no ticket). Stopgap until a waiter-readable order view exists (T2).
 */
export async function linesFromKitchen(ctx: Ctx, orderId: string): Promise<OrderLineModel[]> {
  type Item = {
    orderItemId?: string;
    quantity?: number;
    menuItemName?: string | null;
    menuItemId?: string | null;
    serving?: { id?: string; label?: string | null } | null;
    notes?: string | null;
    voided?: boolean;
    voidReason?: string | null;
    wasMade?: boolean | null;
  };
  type Ticket = { orderId?: string; station?: string; createdAt?: string; items?: Item[] };
  const seen = new Map<string, OrderLineModel>();
  const pageSize = 200;
  for (let page = 1; page <= 20; page += 1) {
    const res = await apiRequest<{ data?: Ticket[]; total?: number }>(`/api/kds/queue?page=${page}&pageSize=${pageSize}`, ctx);
    const rows = res.data ?? [];
    for (const t of rows) {
      if (t.orderId !== orderId) continue;
      // One Send makes one ticket per station a few milliseconds apart: group them by the minute.
      const sentAt = t.createdAt ? `${t.createdAt.slice(0, 16)}:00.000Z` : null;
      for (const it of t.items ?? []) {
        if (!it.orderItemId) continue;
        const label = it.serving?.label && it.serving.label.toLowerCase() !== "standard" ? it.serving.label : null;
        seen.set(it.orderItemId, {
          key: it.orderItemId,
          serverId: it.orderItemId,
          menuItemId: it.menuItemId ?? "",
          servingId: it.serving?.id ?? null,
          name: (it.menuItemName ?? "").trim() || "Item",
          servingLabel: label,
          choices: [],
          note: it.notes ?? "",
          quantity: it.quantity ?? 1,
          unitMinor: 0,
          lineMinor: 0,
          state: it.voided ? "voided" : "sent",
          sentAt,
          station: t.station ?? null,
          voidReason: it.voidReason ?? null,
          wasMade: it.wasMade ?? null,
          priceKnown: false,
        });
      }
    }
    if (rows.length < pageSize || page * pageSize >= (res.total ?? 0)) break;
  }
  return [...seen.values()];
}

/**
 * "Take it over": a supervisor enters their own PIN on this device. That PIN opens a
 * one-off supervisor session used for this single transfer-server call, which is then
 * logged out. The PIN is never stored, logged or sent anywhere else.
 */
export async function takeOverWithSupervisorPin(ctx: Ctx, orderId: string, pin: string, toUserId: string): Promise<void> {
  const login = await apiRequest<{ accessToken?: string }>("/api/auth/quick-pin-login", {
    method: "POST",
    branchId: ctx.branchId,
    body: { branchId: ctx.branchId, pin, platform: "POS_DESKTOP" },
  });
  const supervisor = login.accessToken;
  if (!supervisor) throw new Error("That PIN did not sign in.");
  try {
    await apiRequest(`/api/pos/orders/${orderId}/transfer-server`, {
      method: "POST",
      token: supervisor,
      branchId: ctx.branchId,
      body: { targetUserId: toUserId, reason: "Taken over with a supervisor PIN" },
    });
  } finally {
    await apiRequest("/api/auth/logout", { method: "POST", token: supervisor, branchId: ctx.branchId, body: {} }).catch(() => undefined);
  }
}

// ── Hold and fire (T2 E5): starters now, mains later ──

export async function holdLine(ctx: Ctx, orderId: string, itemId: string, held: boolean) {
  return apiRequest(`/api/pos/orders/${orderId}/lines/${itemId}/hold`, { ...ctx, method: "POST", body: { held } });
}

export type FireResult = { fireId: string; fireAt: string; undoUntil: string; itemIds: string[] };

/** Fire held lines: they go to the kitchen when the 3-second undo window ends (on the server's clock). */
export async function fireLines(ctx: Ctx, orderId: string, itemIds?: string[]): Promise<FireResult> {
  return apiRequest<FireResult>(`/api/pos/orders/${orderId}/fire`, { ...ctx, method: "POST", body: itemIds?.length ? { itemIds } : {} });
}

export async function undoFire(ctx: Ctx, orderId: string, fireId: string) {
  return apiRequest(`/api/pos/orders/${orderId}/fire/${fireId}/undo`, { ...ctx, method: "POST", body: {} });
}
