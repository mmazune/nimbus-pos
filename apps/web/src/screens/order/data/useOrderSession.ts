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
  voidLine,
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
  };
}

function sameLine(a: OrderLineModel, b: OrderLineModel) {
  return (
    a.menuItemId === b.menuItemId &&
    a.servingId === b.servingId &&
    a.note.trim() === b.note.trim() &&
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
  count: number;
  busy: string | null;
  add: (input: NewLine) => OrderLineModel;
  setQuantity: (key: string, quantity: number) => void;
  setNote: (key: string, note: string) => void;
  setChoices: (key: string, choices: LineChoice[], unitMinor: Minor) => void;
  remove: (key: string) => void;
  discardUnsent: () => void;
  send: () => Promise<boolean>;
  voidOne: (line: OrderLineModel, body: { reason: VoidReason; wasMade: boolean; quantity?: number; note?: string }) => Promise<boolean>;
  askForBill: () => Promise<boolean>;
  pay: (payments: Array<{ method: PayMethod; amountMinor: Minor }>) => Promise<PayResult | null>;
  lastError: string | null;
  clearError: () => void;
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
  tableId: string;
  canReadOthers: boolean;
  userId: string | null;
  /** Called after a change that the floor should see (send, void, pay). */
  onChanged?: () => void;
}): OrderSession {
  const { ctx, tableId, canReadOthers, userId, onChanged } = args;
  const qc = useQueryClient();
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [local, setLocal] = useState<OrderLineModel[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  /** The id of an order this device created whose first Send has not finished. */
  const createdIdRef = useRef<string | null>(null);
  const lockRef = useRef(false);

  const openQ = useQuery({
    queryKey: ["order-screen", "open", ctx?.branchId, tableId],
    enabled: Boolean(ctx && tableId),
    queryFn: () => findOpenOrders(ctx as Ctx, tableId),
    staleTime: 5_000,
  });
  const openOrders = openQ.data ?? [];
  const chosen =
    openOrders.find((o) => o.id === chosenId) ??
    openOrders.find((o) => o.id === createdIdRef.current) ??
    openOrders[0] ??
    null;
  const mayRead = Boolean(chosen && (canReadOthers || !chosen.waiterId || chosen.waiterId === userId));

  const orderQ = useQuery({
    queryKey: ["order-screen", "order", ctx?.branchId, chosen?.id],
    enabled: Boolean(ctx && chosen && mayRead),
    queryFn: () => getOrder(ctx as Ctx, (chosen as OrderSummary).id),
    staleTime: 2_000,
  });

  const order = mayRead ? orderQ.data ?? null : null;
  const lines = useMemo(() => [...(order?.lines ?? []), ...local], [order, local]);

  const refresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["order-screen", "open", ctx?.branchId, tableId] });
    await qc.invalidateQueries({ queryKey: ["order-screen", "order", ctx?.branchId] });
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
      let orderId = order?.id ?? createdIdRef.current;
      if (!orderId) {
        const created = await createOrder(ctx, tableId);
        orderId = created.id;
        createdIdRef.current = orderId;
        setChosenId(orderId);
      }
      // Save each line not yet saved, one at a time; a saved line keeps its server id.
      // Lines added while this Send runs are not in `pending` and stay for the next Send.
      const pending = local.filter((l) => !l.serverId);
      const pendingKeys = new Set(pending.map((l) => l.key));
      for (const line of pending) {
        const saved = await addLine(ctx, orderId, line);
        setLocal((cur) => cur.map((l) => (l.key === line.key ? { ...l, serverId: saved.serverId } : l)));
      }
      await sendOrder(ctx, orderId);
      setLocal((cur) => cur.filter((l) => !pendingKeys.has(l.key)));
      createdIdRef.current = null;
      await refresh();
      onChanged?.();
      return true;
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
  }, [ctx, local, onChanged, order?.id, refresh, tableId]);

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
    openQ.isLoading || (chosen && mayRead && orderQ.isLoading) ? "loading" : openQ.isError || orderQ.isError ? "error" : "ready";

  return {
    status,
    error: openQ.error ?? orderQ.error,
    openOrders,
    selectOrder: setChosenId,
    order,
    summary: chosen && !mayRead ? chosen : null,
    lines,
    unsentCount: lines.reduce((s, l) => (l.state === "unsent" ? s + l.quantity : s), 0),
    totalMinor: linesTotal(lines),
    count: chosen && !mayRead ? chosen.itemCount : itemCount(lines),
    busy,
    add,
    setQuantity,
    setNote,
    setChoices,
    remove,
    discardUnsent,
    send,
    voidOne,
    askForBill,
    pay,
    lastError,
    clearError: () => setLastError(null),
    refresh,
  };
}
