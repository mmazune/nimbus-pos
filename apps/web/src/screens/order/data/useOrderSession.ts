/**
 * One table's order for the screen. Holds the lines not yet sent on this device,
 * and turns Send into: (first time only) create the order → add each unsaved line
 * → send. A Send that fails half way keeps the order id and the lines already
 * saved, so a retry never creates a second order or a second copy of a line.
 * A ref lock makes two fast taps one Send.
 *
 * Decision (T3): lines not sent are held on this device until Send, on a free
 * table (R2: nothing is saved before the first Send) and on a table with an order
 * alike, so there is one path to the kitchen. Leaving with lines not sent asks first.
 * Lines that are already not sent on the server (made elsewhere) show as not sent
 * and are changed or removed on the server.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";

import {
  linesFromKitchen,
  paidOn,
  addLine,
  createOrder,
  deleteLine,
  findOpenOrders,
  getOrder,
  itemCount,
  linesTotal,
  patchLine,
  payAndClose,
  requestBill,
  sendOrder,
  serverCode,
  fireLines,
  undoFire,
  type FireResult,
  voidLine,
  type SendReport,
  type LineChoice,
  type OrderLineModel,
  type OrderModel,
  type OrderSummary,
  type PayMethod,
  type PayResult,
  type VoidReason,
} from "./order";
import type { MenuItem, MenuServing } from "./menu";
import type { Minor } from "./money";

type Ctx = { token: string; branchId: string };

let localSeq = 0;
const nextKey = () => `local-${Date.now().toString(36)}-${(localSeq += 1)}`;

export type NewLine = {
  item: MenuItem;
  serving: MenuServing | null;
  choices: LineChoice[];
  note: string;
  quantity: number;
  /** Which guest at the table it is for (by-guest splits); null when it is for the table. */
  guest?: number | null;
  /** Hold it (starters now, mains later): Send skips it until it is fired. */
  hold?: boolean;
  allergy?: string | null;
  takeaway?: boolean;
};

export function unitPriceOf(item: MenuItem, serving: MenuServing | null, choices: LineChoice[]): Minor {
  const base = serving ? serving.priceMinor : item.priceMinor;
  return base + choices.reduce((s, c) => s + c.priceDeltaMinor, 0);
}

export function draftLine(input: NewLine): OrderLineModel {
  const unit = unitPriceOf(input.item, input.serving, input.choices);
  const showServing = input.serving && input.item.servings.length > 1 ? input.serving.label : null;
  return {
    key: nextKey(),
    serverId: null,
    menuItemId: input.item.id,
    servingId: input.serving?.id ?? null,
    name: input.item.name,
    servingLabel: showServing,
    choices: input.choices,
    note: input.note,
    quantity: input.quantity,
    unitMinor: unit,
    lineMinor: unit * input.quantity,
    state: "unsent",
    sentAt: null,
    station: input.item.station,
    voidReason: null,
    wasMade: null,
    guest: input.guest ?? null,
    held: Boolean(input.hold),
    allergy: input.allergy?.trim() || null,
    takeaway: Boolean(input.takeaway),
  };
}

function sameLine(a: OrderLineModel, b: OrderLineModel) {
  return (
    a.menuItemId === b.menuItemId &&
    a.servingId === b.servingId &&
    a.note.trim() === b.note.trim() &&
    (a.guest ?? null) === (b.guest ?? null) &&
    Boolean(a.held) === Boolean(b.held) &&
    (a.allergy ?? "") === (b.allergy ?? "") &&
    Boolean(a.takeaway) === Boolean(b.takeaway) &&
    a.choices.map((c) => c.optionId).sort().join() === b.choices.map((c) => c.optionId).sort().join()
  );
}

export type SessionStatus = "loading" | "error" | "ready";

export type OrderSession = {
  status: SessionStatus;
  error: unknown;
  /** Open orders on this table (more than one: the screen offers a choice). */
  openOrders: OrderSummary[];
  selectOrder: (orderId: string) => void;
  /** The order being shown, null on a free table. */
  order: OrderModel | null;
  /** The summary when the lines cannot be read (another waiter's table). */
  summary: OrderSummary | null;
  /** All lines to show: server lines then this device's lines. */
  lines: OrderLineModel[];
  unsentCount: number;
  totalMinor: Minor;
  /** Completed payments on the order (0 until read). */
  paidMinor: Minor;
  /** False while the payments read is still loading: money actions wait for it. */
  paidKnown: boolean;
  count: number;
  busy: string | null;
  add: (input: NewLine) => OrderLineModel;
  setQuantity: (key: string, quantity: number) => void;
  setNote: (key: string, note: string) => void;
  setChoices: (key: string, choices: LineChoice[], unitMinor: Minor) => void;
  /** Allergy, takeaway, hold and guest on a line not yet saved. */
  setFlags: (key: string, flags: { allergy?: string | null; takeaway?: boolean; held?: boolean; guest?: number | null }) => void;
  remove: (key: string) => void;
  discardUnsent: () => void;
  send: () => Promise<boolean>;
  /** Fire the held lines (all of them): they go after a 3-second undo window. */
  fire: () => Promise<FireResult | null>;
  undo: (fireId: string) => Promise<boolean>;
  voidOne: (line: OrderLineModel, body: { reason: VoidReason; wasMade: boolean; quantity?: number; note?: string }) => Promise<boolean>;
  askForBill: () => Promise<boolean>;
  pay: (payments: Array<{ method: PayMethod; amountMinor: Minor }>) => Promise<PayResult | null>;
  lastError: string | null;
  clearError: () => void;
  /** What the last Send could not send, by name (sold out or not enough left). */
  sendReport: SendReport | null;
  clearSendReport: () => void;
  refresh: () => Promise<void>;
};

function errorText(e: unknown): string {
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return "Something went wrong. Nothing was lost; try again.";
}

export function useOrderSession(args: {
  ctx: Ctx | null;
  /** The table, or null for a takeaway or tableless order opened by id (Find bill, Find order). */
  tableId: string | null;
  /** Open this order (from Find bill, Find order or `?orderId=`). */
  orderId?: string | null;
  canReadOthers: boolean;
  /** Read posted payments (cashier, supervisor, manager): "to pay" and the payment safety gate. */
  canReadPayments: boolean;
  userId: string | null;
  /** Called after a change that the floor should see (send, void, pay). */
  onChanged?: () => void;
}): OrderSession {
  const { ctx, tableId, orderId, canReadOthers, canReadPayments, userId, onChanged } = args;
  const qc = useQueryClient();
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [local, setLocal] = useState<OrderLineModel[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [sendReport, setSendReport] = useState<SendReport | null>(null);
  /** The id of an order this device created whose first Send has not finished. */
  const createdIdRef = useRef<string | null>(null);
  const lockRef = useRef(false);

  const openQ = useQuery({
    queryKey: ["order-screen", "open", ctx?.branchId, tableId],
    enabled: Boolean(ctx && tableId),
    queryFn: () => findOpenOrders(ctx as Ctx, tableId as string),
    staleTime: 5_000,
  });
  const openOrders = useMemo(() => openQ.data ?? [], [openQ.data]);
  // With several orders on a table, the signed-in person's own comes first (two waiters can both Send on one free table).
  const ownFirst = openOrders.find((o) => o.waiterId && o.waiterId === userId) ?? openOrders[0];
  const targetId = chosenId ?? createdIdRef.current ?? orderId ?? ownFirst?.id ?? null;
  const chosen = openOrders.find((o) => o.id === targetId) ?? null;
  // An order opened by id (not in this table's open list) is read when the role may read others'.
  const mayRead = Boolean(targetId && (chosen ? canReadOthers || !chosen.waiterId || chosen.waiterId === userId : canReadOthers));

  const orderQ = useQuery({
    queryKey: ["order-screen", "order", ctx?.branchId, targetId],
    enabled: Boolean(ctx && targetId && mayRead),
    queryFn: () => getOrder(ctx as Ctx, targetId as string),
    staleTime: 2_000,
  });

  const order = mayRead ? orderQ.data ?? null : null;
  const paidQ = useQuery({
    queryKey: ["order-screen", "paid", ctx?.branchId, order?.id],
    enabled: Boolean(ctx && order && canReadPayments),
    queryFn: () => paidOn(ctx as Ctx, (order as OrderModel).id),
    staleTime: 2_000,
  });
  // Another waiter's table: the order read is refused, so the lines come from the kitchen's tickets.
  const kitchenQ = useQuery({
    queryKey: ["order-screen", "kitchen", ctx?.branchId, targetId],
    enabled: Boolean(ctx && targetId && chosen && !mayRead),
    queryFn: () => linesFromKitchen(ctx as Ctx, targetId as string),
    staleTime: 5_000,
  });
  const lines = useMemo(
    () => (chosen && !mayRead ? kitchenQ.data ?? [] : [...(order?.lines ?? []), ...local]),
    [chosen, mayRead, order, local, kitchenQ.data],
  );

  const refresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["order-screen", "open", ctx?.branchId, tableId] });
    await qc.invalidateQueries({ queryKey: ["order-screen", "order", ctx?.branchId] });
    await qc.invalidateQueries({ queryKey: ["order-screen", "paid", ctx?.branchId] });
    await qc.invalidateQueries({ queryKey: ["order-screen", "kitchen", ctx?.branchId] });
  }, [ctx?.branchId, qc, tableId]);

  const add = useCallback((input: NewLine) => {
    const line = draftLine(input);
    let result = line;
    setLocal((cur) => {
      const twin = cur.find((l) => sameLine(l, line));
      if (twin) {
        const quantity = twin.quantity + line.quantity;
        result = { ...twin, quantity, lineMinor: twin.unitMinor * quantity };
        return cur.map((l) => (l.key === twin.key ? result : l));
      }
      return [...cur, line];
    });
    return result;
  }, []);

  const runServer = useCallback(
    async (label: string, fn: () => Promise<unknown>) => {
      setBusy(label);
      setLastError(null);
      try {
        await fn();
        await refresh();
        return true;
      } catch (e) {
        setLastError(errorText(e));
        return false;
      } finally {
        setBusy(null);
      }
    },
    [refresh],
  );

  const updateLine = useCallback(
    (key: string, change: (l: OrderLineModel) => OrderLineModel) => {
      const isLocal = local.some((l) => l.key === key);
      if (isLocal) {
        setLocal((cur) => cur.map((l) => (l.key === key ? change(l) : l)));
        return;
      }
      const server = order?.lines.find((l) => l.key === key && l.state === "unsent" && l.serverId);
      if (server && ctx && order) void runServer("change", () => patchLine(ctx, order.id, change(server)));
    },
    [ctx, local, order, runServer],
  );

  const setQuantity = useCallback(
    (key: string, quantity: number) =>
      updateLine(key, (l) => ({ ...l, quantity: Math.max(1, quantity), lineMinor: l.unitMinor * Math.max(1, quantity) })),
    [updateLine],
  );
  const setNote = useCallback((key: string, note: string) => updateLine(key, (l) => ({ ...l, note })), [updateLine]);
  const setChoices = useCallback(
    (key: string, choices: LineChoice[], unitMinor: Minor) =>
      updateLine(key, (l) => ({ ...l, choices, unitMinor, lineMinor: unitMinor * l.quantity })),
    [updateLine],
  );

  const setFlags = useCallback(
    (key: string, flags: { allergy?: string | null; takeaway?: boolean; held?: boolean; guest?: number | null }) =>
      setLocal((cur) => cur.map((l) => (l.key === key ? { ...l, ...flags } : l))),
    [],
  );

  const remove = useCallback(
    (key: string) => {
      if (local.some((l) => l.key === key)) {
        setLocal((cur) => cur.filter((l) => l.key !== key));
        return;
      }
      const server = order?.lines.find((l) => l.key === key && l.state === "unsent" && l.serverId);
      if (server?.serverId && ctx && order) void runServer("remove", () => deleteLine(ctx, order.id, server.serverId as string));
    },
    [ctx, local, order, runServer],
  );

  const discardUnsent = useCallback(() => setLocal([]), []);

  const send = useCallback(async () => {
    if (!ctx || lockRef.current) return false;
    lockRef.current = true;
    setBusy("send");
    setLastError(null);
    try {
      let targetOrderId = order?.id ?? createdIdRef.current;
      if (!targetOrderId) {
        if (!tableId) throw new Error("This order has no table; open it from its table to add items.");
        const created = await createOrder(ctx, tableId);
        targetOrderId = created.id;
        createdIdRef.current = targetOrderId;
        setChosenId(targetOrderId);
      }
      // Save each line not yet saved, one at a time; a saved line keeps its server id.
      // Lines added while this Send runs are not in `pending` and stay for the next Send.
      // A line whose item sold out since it was tapped is refused here (ITEM_SOLD_OUT): it stays on
      // this device, red, and the rest still go (T2: never all or nothing).
      const pending = local.filter((l) => !l.serverId);
      const savedKeys = new Set<string>();
      const refused: SendReport["skipped"] = [];
      for (const line of pending) {
        try {
          const saved = await addLine(ctx, targetOrderId, line);
          savedKeys.add(line.key);
          setLocal((cur) => cur.map((l) => (l.key === line.key ? { ...l, serverId: saved.serverId } : l)));
        } catch (e) {
          if (serverCode(e) !== "ITEM_SOLD_OUT") throw e;
          refused.push({ name: line.name, quantity: line.quantity, reason: "SOLD_OUT" });
          setLocal((cur) => cur.map((l) => (l.key === line.key ? { ...l, unsendable: true } : l)));
        }
      }
      const serverUnsent = (order?.lines ?? []).some((l) => l.state === "unsent" && !l.held);
      const report: SendReport =
        savedKeys.size > 0 || serverUnsent ? await sendOrder(ctx, targetOrderId) : { skipped: [], held: 0, sent: 0 };
      report.skipped = [...refused, ...report.skipped];
      setLocal((cur) => cur.filter((l) => !savedKeys.has(l.key)));
      createdIdRef.current = null;
      setSendReport(report.skipped.length ? report : null);
      // Something ran out under us: read the menu's changes now rather than at the next poll.
      if (report.skipped.length) void qc.refetchQueries({ queryKey: ["order-screen", "menu-changes", ctx.branchId] });
      await refresh();
      onChanged?.();
      return report.skipped.length === 0;
    } catch (e) {
      // Lines already saved stay saved (their server id is kept); a retry sends the rest.
      setLocal((cur) => cur.filter((l) => !l.serverId));
      await refresh();
      setLastError(errorText(e));
      return false;
    } finally {
      lockRef.current = false;
      setBusy(null);
    }
  }, [ctx, local, onChanged, order?.id, order?.lines, qc, refresh, tableId]);

  const fire = useCallback(async () => {
    if (!ctx || !order) return null;
    const held = order.lines.filter((l) => l.state === "unsent" && l.held && l.serverId).map((l) => l.serverId as string);
    if (!held.length) return null;
    setBusy("fire");
    setLastError(null);
    try {
      const r = await fireLines(ctx, order.id, held);
      await refresh();
      return r;
    } catch (e) {
      setLastError(errorText(e));
      return null;
    } finally {
      setBusy(null);
    }
  }, [ctx, order, refresh]);

  const undo = useCallback(
    async (fireId: string) => {
      if (!ctx || !order) return false;
      return runServer("undo", () => undoFire(ctx, order.id, fireId));
    },
    [ctx, order, runServer],
  );

  const voidOne = useCallback(
    async (line: OrderLineModel, body: { reason: VoidReason; wasMade: boolean; quantity?: number; note?: string }) => {
      if (!ctx || !order || !line.serverId) return false;
      const ok = await runServer("void", () => voidLine(ctx, order.id, line.serverId as string, body));
      if (ok) onChanged?.();
      return ok;
    },
    [ctx, onChanged, order, runServer],
  );

  const askForBill = useCallback(async () => {
    if (!ctx || !order) return false;
    return runServer("bill", () => requestBill(ctx, order.id));
  }, [ctx, order, runServer]);

  const pay = useCallback(
    async (payments: Array<{ method: PayMethod; amountMinor: Minor }>) => {
      if (!ctx || !order || lockRef.current) return null;
      lockRef.current = true;
      setBusy("pay");
      setLastError(null);
      try {
        const result = await payAndClose(ctx, order.id, payments);
        onChanged?.();
        return result;
      } catch (e) {
        setLastError(errorText(e));
        return null;
      } finally {
        lockRef.current = false;
        setBusy(null);
      }
    },
    [ctx, onChanged, order],
  );

  const status: SessionStatus =
    openQ.isLoading || (targetId && mayRead && orderQ.isLoading) ? "loading" : openQ.isError || orderQ.isError ? "error" : "ready";
  const localMinor = local.reduce((sum, l) => sum + l.lineMinor, 0);

  return {
    status,
    error: openQ.error ?? orderQ.error,
    openOrders,
    selectOrder: setChosenId,
    order,
    summary: chosen && !mayRead ? chosen : null,
    lines,
    unsentCount: lines.reduce((s, l) => (l.state === "unsent" ? s + l.quantity : s), 0),
    // The server's total (after discounts, without voided lines) plus this device's lines not yet saved.
    totalMinor: order ? order.totalMinor + localMinor : linesTotal(lines),
    paidMinor: paidQ.data ?? 0,
    paidKnown: !canReadPayments || paidQ.isSuccess || !order,
    count: chosen && !mayRead && !kitchenQ.data?.length ? chosen.itemCount : itemCount(lines),
    busy,
    add,
    setQuantity,
    setNote,
    setChoices,
    setFlags,
    remove,
    discardUnsent,
    send,
    fire,
    undo,
    voidOne,
    askForBill,
    pay,
    lastError,
    clearError: () => setLastError(null),
    sendReport,
    clearSendReport: () => setSendReport(null),
    refresh,
  };
}
