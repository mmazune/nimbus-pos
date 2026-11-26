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
export function choicesText(line: Pick<OrderLineModel, "servingLabel" | "choices" | "note">): string {
  const parts: string[] = [];
  if (line.servingLabel) parts.push(line.servingLabel);
  for (const c of line.choices) {
    parts.push(LEAVE_OUT.test(c.groupName) ? `No ${c.optionName.toLowerCase()}` : c.optionName);
  }
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

export async function sendOrder(ctx: Ctx, orderId: string): Promise<void> {
  await apiRequest(`/api/pos/orders/${orderId}/send`, { ...ctx, method: "POST", body: {} });
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

export type OtherOrder = { id: string; tableLabel: string; waiterName: string | null; totalMinor: Minor };

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
