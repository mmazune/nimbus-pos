/**
 * The table actions sheet (drawing Supervisor-Table). Only actions an endpoint
 * supports today are shown; the drawing's others are left out and listed in the
 * T3 report (Join tables, Change waiter, Split bill, Send to kitchen again).
 * Each action opens its own step inside this sheet: never a sheet from a sheet.
 */
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ActionTile, Button, Chip, Field, OptionTile, OrderLine, Row, RowGroup, Sheet, Text, type SheetPlacement } from "@/components/kit";

import { groupShillings } from "../data/money";
import { formatMoney } from "../data/money";
import { loadAreas } from "@/screens/floor/floor-data";

import {
  askForDiscount,
  cancelOrder,
  changeWaiter,
  choicesText,
  listFreeTables,
  listOtherOpenOrders,
  listStaff,
  setTableStatus,
  TABLE_STATUSES,
  type TableStatus,
  type OrderLineModel,
} from "../data/order";
import type { OrderRights } from "../data/rights";
import { changeWaiterAt, colleaguesOnFloor, joinTables, moveLine, moveTable, offerHandover, splitTables } from "../data/seating";
import { SplitSheet } from "./SplitSheet";

type Ctx = { token: string; branchId: string };
export type Step =
  | "menu" | "move" | "discount" | "cancel" | "voidPick" | "join" | "unjoin" | "waiter" | "split" | "status"
  | "linePick" | "lineTo" | "handover";

type Props = {
  placement: SheetPlacement;
  title: string;
  summary: string;
  rights: OrderRights;
  ctx: Ctx | null;
  orderId: string | null;
  tableId: string | null;
  totalMinor: number;
  canSameAgain: boolean;
  onSameAgain: () => void;
  /** Sent lines that may be voided; the person picks one (never preselected). */
  sentLines: OrderLineModel[];
  onVoidItem: (line: OrderLineModel) => void;
  /** Every line on the order (splits, move a line). */
  lines: OrderLineModel[];
  /** The signed-in person (a hand-over is to someone else). */
  userId: string | null;
  /** The order's waiter now ("Has it now" on Change waiter). */
  waiterId?: string | null;
  /** A payment is posted: Discount and Cancel the order are hidden (the API does not check; the old screen did). */
  hasPayment: boolean;
  /** Open straight on one action (the laptop bar's Move table, Split bill, Discount). */
  initialStep?: Step;
  /** After a change on the server: the screen re-reads; `leave` when the table no longer holds this order. */
  onDone: (outcome: { leave: boolean; message: string }) => void;
  onClose: () => void;
};

const PERCENTS = [5, 10, 15, 20, 50];
const DISCOUNT_REASONS = ["Regular guest", "Slow service", "Kitchen error", "Manager’s offer"];

export function TableActionsSheet({ placement, title, summary, rights, ctx, orderId, tableId, totalMinor, canSameAgain, onSameAgain, sentLines, onVoidItem, lines, userId, waiterId = null, hasPayment, initialStep = "menu", onDone, onClose }: Props) {
  const [step, setStep] = useState<Step>(initialStep);
  const [target, setTarget] = useState<string | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [count, setCount] = useState<number | null>(null);
  const [status, setStatus] = useState<TableStatus | null>(null);
  const othersQ = useQuery({
    queryKey: ["order-screen", "other-orders", ctx?.branchId, orderId],
    enabled: Boolean(ctx && orderId && step === "join"),
    queryFn: () => listOtherOpenOrders(ctx as Ctx, orderId as string),
    staleTime: 5_000,
  });
  const staffQ = useQuery({
    queryKey: ["order-screen", "staff", ctx?.branchId],
    enabled: Boolean(ctx && step === "waiter"),
    queryFn: () => listStaff(ctx as Ctx),
    staleTime: 60_000,
  });
  // The branch's tables by area (T2): what is joined to this table, and where a line can go.
  const areasQ = useQuery({
    queryKey: ["order-screen", "areas", ctx?.branchId],
    enabled: Boolean(ctx && (step === "unjoin" || step === "lineTo" || step === "menu" || step === "move" || step === "join")),
    queryFn: () => loadAreas((ctx as Ctx).token, (ctx as Ctx).branchId),
    // Read fresh each time the sheet opens: a join made a moment ago must show "Split tables again".
    staleTime: 0,
    refetchOnMount: "always",
  });
  const allTables = (areasQ.data ?? []).flatMap((a) => (a.tables ?? []).map((t) => ({ ...t, areaName: a.name, areaId: a.id })));
  const areaOfTable = (id: string) => allTables.find((t) => t.id === id)?.areaId ?? null;
  const joinedHere = allTables.filter((t) => t.joinedToTableId && t.joinedToTableId === tableId);
  const colleaguesQ = useQuery({
    queryKey: ["order-screen", "colleagues", ctx?.branchId],
    enabled: Boolean(ctx && step === "handover"),
    queryFn: () => colleaguesOnFloor(ctx as Ctx, userId),
    staleTime: 5_000,
  });
  const [line, setLine] = useState<OrderLineModel | null>(null);
  // One area at a time in Move table and Move a line (T5 look review: no wall of every table).
  const hereArea = (areasQ.data ?? []).find((a) => (a.tables ?? []).some((t) => t.id === tableId))?.id ?? null;
  const [areaPick, setAreaPick] = useState<string | null>(null);
  const areaId = areaPick ?? hereArea ?? areasQ.data?.find((a) => a.kind !== "TABS")?.id ?? null;
  const areaChips = (counts: (id: string) => number) => (
    <div className="flex flex-wrap gap-kit-8" role="group" aria-label="Areas">
      {(areasQ.data ?? []).filter((a) => a.kind !== "TABS" && counts(a.id) > 0).map((a) => (
        <Chip key={a.id} label={a.name} count={counts(a.id)} current={areaId === a.id} onClick={() => { setAreaPick(a.id); setTarget(null); }} />
      ))}
    </div>
  );
  const tablesQ = useQuery({
    queryKey: ["order-screen", "free-tables", ctx?.branchId, tableId],
    enabled: Boolean(ctx && step === "move"),
    queryFn: () => listFreeTables(ctx as Ctx, tableId ?? ""),
    staleTime: 5_000,
  });

  const run = async (fn: () => Promise<unknown>, outcome: { leave: boolean; message: string | ((r: unknown) => string) }) => {
    if (!ctx) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fn();
      onDone({ leave: outcome.leave, message: typeof outcome.message === "function" ? outcome.message(r) : outcome.message });
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not go through. Nothing changed.");
    } finally {
      setBusy(false);
    }
  };

  const lead = rights.canTableActions && Boolean(orderId);
  const back = (
    <Button tone="text" onClick={() => { setStep("menu"); setError(null); }}>
      Back
    </Button>
  );

  if (step === "move") {
    const chosen = tablesQ.data?.find((t) => t.id === target);
    return (
      <Sheet placement={placement} title={`Move ${title}`} summary={`${formatMoney(totalMinor)} · pick a free table. The order, the bill and the waiter go with it.`} onClose={onClose}
        footer={<>{back}<span className="flex-1" /><Button tone="filled" disabled={!chosen || busy} onClick={() => run(() => moveTable(ctx as Ctx, tableId as string, target as string), { leave: true, message: `Moved to ${chosen?.label}. The order, the bill and the waiter went with it.` })}>{chosen ? `Move to ${chosen.label}` : "Choose a table"}</Button></>}>
        {areaChips((id) => (tablesQ.data ?? []).filter((t) => areaOfTable(t.id) === id).length)}
        <div className="grid grid-cols-3 gap-kit-8 md:grid-cols-5" data-order-move>
          {(tablesQ.data ?? []).filter((t) => !areaId || areaOfTable(t.id) === areaId).map((t) => (
            <OptionTile key={t.id} label={t.label} second={t.seats ? `${t.seats} seats` : undefined} current={target === t.id} onClick={() => setTarget(t.id)} />
          ))}
        </div>
        {tablesQ.data && tablesQ.data.length === 0 ? <Text variant="sup" tone="muted">No table is free right now.</Text> : null}
        {error ? <Text variant="sup" tone="red">{error}</Text> : null}
      </Sheet>
    );
  }

  if (step === "discount") {
    return (
      <Sheet placement={placement} title={`Discount on ${title}`} summary="A reason is saved with your name. Above the venue’s limit it waits for approval." onClose={onClose}
        footer={<>{back}<span className="flex-1" /><Button tone="filled" disabled={!percent || !reason.trim() || busy} onClick={() => run(() => askForDiscount(ctx as Ctx, orderId as string, percent as number, reason.trim()), { leave: false, message: (status) => (status === "APPROVED" ? `${percent}% off taken` : `${percent}% off is waiting for approval`) })}>{percent ? `Take ${percent}% off` : "Choose how much"}</Button></>}>
        <Text variant="sup" strong>How much</Text>
        <div className="grid grid-cols-5 gap-kit-8">
          {PERCENTS.map((p) => <OptionTile key={p} label={`${p}%`} current={percent === p} onClick={() => setPercent(p)} />)}
        </div>
        <Text variant="sup" strong>Why</Text>
        <div className="grid grid-cols-2 gap-kit-8">
          {DISCOUNT_REASONS.map((r) => <OptionTile key={r} label={r} current={reason === r} onClick={() => setReason(r)} />)}
        </div>
        <Field label="Or write the reason" value={DISCOUNT_REASONS.includes(reason) ? "" : reason} placeholder="Why this table gets a discount" onChange={setReason} />
        {error ? <Text variant="sup" tone="red">{error}</Text> : null}
      </Sheet>
    );
  }

  if (step === "join") {
    const chosen = othersQ.data?.find((o) => o.tableId === target);
    const sum = totalMinor + (chosen?.totalMinor ?? 0);
    return (
      <Sheet placement={placement} title={`Join ${title} with another`} summary={`Pick the table to join to ${title}`} onClose={onClose}
        footer={<>{back}<span className="flex-1" /><Button tone="filled" disabled={!chosen || busy} onClick={() => run(() => joinTables(ctx as Ctx, tableId as string, target as string), { leave: false, message: `${chosen?.tableLabel} joined to ${title}: one bill` })}>{chosen ? `Join 2 tables · ${formatMoney(sum)}` : "Choose a table"}</Button></>}>
        {areaChips((id) => (othersQ.data ?? []).filter((o) => o.tableId && o.tableId !== tableId && areaOfTable(o.tableId) === id).length)}
        <div className="grid grid-cols-2 gap-kit-8 md:grid-cols-3" data-order-join>
          {(othersQ.data ?? [])
            .filter((o) => o.tableId && o.tableId !== tableId && (!areaId || areaOfTable(o.tableId) === areaId))
            .map((o) => (
              <OptionTile key={o.id} label={o.tableLabel} second={[o.waiterId && o.waiterId === userId ? "You" : o.waiterName, o.totalMinor > 0 ? groupShillings(o.totalMinor) : "Nothing yet"].filter(Boolean).join(" · ")} current={target === o.tableId} onClick={() => setTarget(o.tableId)} />
            ))}
        </div>
        {chosen ? (
          <div className="flex flex-col gap-kit-8 rounded-kit-control bg-kit-canvas px-kit-16 py-kit-12" data-join-summary>
            <div className="flex items-baseline justify-between"><Text variant="body">{title}</Text><Text variant="row">{formatMoney(totalMinor)}</Text></div>
            <div className="flex items-baseline justify-between"><Text variant="body">{chosen.tableLabel}</Text><Text variant="row">{formatMoney(chosen.totalMinor)}</Text></div>
            <div className="flex items-baseline justify-between shadow-kit-line-top pt-kit-8"><Text variant="row">{`One bill on ${title}`}</Text><Text variant="h">{formatMoney(sum)}</Text></div>
            <Text variant="sup" tone="muted">{`${chosen.tableLabel} shows “Joined to ${title}” until the bill is paid.`}</Text>
          </div>
        ) : null}
        {othersQ.data && othersQ.data.length === 0 ? <Text variant="sup" tone="muted">No other table has an open order.</Text> : null}
        {error ? <Text variant="sup" tone="red">{error}</Text> : null}
      </Sheet>
    );
  }

  if (step === "unjoin") {
    const chosen = joinedHere.find((t) => t.id === target);
    return (
      <Sheet placement={placement} title={`Split ${title} from the table joined to it`} summary="Each table gets its own bill back, with the lines it had." onClose={onClose}
        footer={<>{back}<span className="flex-1" /><Button tone="filled" disabled={!chosen || busy} onClick={() => run(() => splitTables(ctx as Ctx, tableId as string, target as string), { leave: false, message: `${chosen?.label} has its own bill again` })}>{chosen ? `Split ${chosen.label} off` : "Choose a table"}</Button></>}>
        <div className="grid grid-cols-3 gap-kit-8" data-order-unjoin>
          {joinedHere.map((t) => <OptionTile key={t.id} label={t.label ?? "Table"} second={`Joined to ${title}`} current={target === t.id} onClick={() => setTarget(t.id)} />)}
        </div>
        {error ? <Text variant="sup" tone="red">{error}</Text> : null}
      </Sheet>
    );
  }

  if (step === "linePick") {
    const movable = lines.filter((l) => l.serverId && l.state !== "voided");
    return (
      <Sheet placement={placement} title="Move a line" summary="Tap the line that belongs on another table." onClose={onClose} footer={<>{back}</>}>
        <div className="flex flex-col" data-order-line-pick>
          {movable.map((l) => (
            <OrderLine key={l.key} flush quantity={l.quantity} name={l.name} choices={choicesText(l) || undefined} price={groupShillings(l.lineMinor)} state={l.state === "unsent" ? "notSent" : "sent"} onClick={() => { setLine(l); setTarget(null); setStep("lineTo"); }} />
          ))}
        </div>
        {movable.length === 0 ? <Text variant="sup" tone="muted">Nothing on this table can be moved yet.</Text> : null}
      </Sheet>
    );
  }

  if (step === "lineTo" && line) {
    const others = allTables.filter((t) => t.id !== tableId && !t.joinedToTableId);
    const chosen = others.find((t) => t.id === target);
    return (
      <Sheet placement={placement} title={`Move ${line.name}`} summary={`${line.sentAt ? "Sent" : "Not sent"} · ${formatMoney(line.lineMinor)} · to which table`} onClose={onClose}
        footer={<><Button tone="text" onClick={() => { setStep("linePick"); setError(null); }}>Back</Button><span className="flex-1" /><Button tone="filled" disabled={!chosen || busy} onClick={() => run(() => moveLine(ctx as Ctx, orderId as string, line.serverId as string, target as string), { leave: false, message: `${line.name} moved to ${chosen?.label}` })}>{chosen ? `Move to ${chosen.label}` : "Choose a table"}</Button></>}>
        {areaChips((id) => others.filter((t) => t.areaId === id).length)}
        <div className="grid grid-cols-3 gap-kit-8 md:grid-cols-6" data-order-line-to>
          {others.filter((t) => !areaId || t.areaId === areaId).map((t) => <OptionTile key={t.id} label={t.label ?? "Table"} current={target === t.id} onClick={() => setTarget(t.id)} />)}
        </div>
        <Text variant="sup" tone="muted">Nothing is voided and no stock moves. A free table gets a bill of its own.</Text>
        {error ? <Text variant="sup" tone="red">{error}</Text> : null}
      </Sheet>
    );
  }

  if (step === "handover") {
    const chosen = colleaguesQ.data?.find((c) => c.userId === target);
    return (
      <Sheet placement={placement} title={`Hand over ${title}`} summary="To a colleague on the floor. They accept on their own screen." onClose={onClose}
        footer={<>{back}<span className="flex-1" /><Button tone="filled" disabled={!chosen || busy} onClick={() => run(() => offerHandover(ctx as Ctx, target as string, { tableIds: [tableId as string] }), { leave: false, message: `Offered to ${chosen?.name}. It stays yours until they accept.` })}>{chosen ? `Offer it to ${chosen.name}` : "Choose who"}</Button></>}>
        <div className="grid grid-cols-2 gap-kit-8 md:grid-cols-3" data-order-handover>
          {(colleaguesQ.data ?? []).map((c) => (
            <OptionTile key={c.userId} label={c.name} second={`${c.tables === 1 ? "1 table" : `${c.tables} tables`} · ${groupShillings(c.openMinor)} open`} current={target === c.userId} onClick={() => setTarget(c.userId)} />
          ))}
        </div>
        {colleaguesQ.data && colleaguesQ.data.length === 0 ? <Text variant="sup" tone="muted">No colleague has a table on the floor right now.</Text> : null}
        {error ? <Text variant="sup" tone="red">{error}</Text> : null}
      </Sheet>
    );
  }

  if (step === "waiter") {
    const chosen = staffQ.data?.find((m) => m.userId === target);
    return (
      <Sheet placement={placement} title={`New waiter for ${title}`} summary="The table and its bill move to the person you choose. Sales already sent stay counted for the first waiter." onClose={onClose}
        footer={<>{back}<span className="flex-1" /><Button tone="filled" disabled={!chosen || busy} onClick={() => run(() => (tableId ? changeWaiterAt(ctx as Ctx, tableId, target as string) : changeWaiter(ctx as Ctx, orderId as string, target as string)), { leave: false, message: `${chosen?.name} has this table now; both are told` })}>{chosen ? `Give it to ${chosen.name}` : "Choose who"}</Button></>}>
        <div className="grid grid-cols-2 gap-kit-8 md:grid-cols-4" data-order-waiters>
          {(staffQ.data ?? []).map((m) => (
            <OptionTile key={m.userId} label={m.name} second={m.userId === waiterId ? "Has it now" : undefined} disabled={m.userId === waiterId} current={target === m.userId} onClick={() => setTarget(m.userId)} />
          ))}
        </div>
        {error ? <Text variant="sup" tone="red">{error}</Text> : null}
      </Sheet>
    );
  }

  if (step === "split" && ctx && orderId) {
    return <SplitSheet placement={placement} title={title} ctx={ctx} orderId={orderId} totalMinor={totalMinor} lines={lines} back={back} onClose={onClose} run={(fn, o) => run(fn, o)} busy={busy} error={error} />;
  }

  if (step === "status") {
    const words: Record<TableStatus, string> = { AVAILABLE: "Free", OCCUPIED: "In use", RESERVED: "Reserved", CLEANING: "Cleaning" };
    return (
      <Sheet placement={placement} title={`Table status · ${title}`} summary={orderId ? "The table has an open order; it stays on the table." : "Use this when a table shows in use but nothing is on it."} onClose={onClose}
        footer={<>{back}<span className="flex-1" /><Button tone="filled" disabled={!status || busy} onClick={() => run(() => setTableStatus(ctx as Ctx, tableId as string, status as TableStatus), { leave: false, message: `${title} is now ${words[status as TableStatus].toLowerCase()}` })}>{status ? `Mark it ${words[status].toLowerCase()}` : "Choose a status"}</Button></>}>
        <div className="grid grid-cols-2 gap-kit-8 md:grid-cols-4" data-order-status>
          {TABLE_STATUSES.map((st) => <OptionTile key={st} label={words[st]} current={status === st} onClick={() => setStatus(st)} />)}
        </div>
        {error ? <Text variant="sup" tone="red">{error}</Text> : null}
      </Sheet>
    );
  }

  if (step === "voidPick") {
    return (
      <Sheet placement={placement} title="Void an item" summary="Tap the line to void." onClose={onClose} footer={<>{back}</>}>
        <div className="flex flex-col" data-order-void-pick>
          {sentLines.map((l) => (
            <OrderLine key={l.key} flush quantity={l.quantity} name={l.name} choices={choicesText(l) || undefined} price={groupShillings(l.lineMinor)} state="sent" onClick={() => onVoidItem(l)} />
          ))}
        </div>
        {sentLines.length === 0 ? <Text variant="sup" tone="muted">Nothing has been sent on this table.</Text> : null}
      </Sheet>
    );
  }

  if (step === "cancel") {
    return (
      <Sheet placement={placement} title={`Cancel the order on ${title}`} summary="Everything on this table is voided. It is not deleted: who, when and why are saved." onClose={onClose}
        footer={<>{back}<span className="flex-1" /><Button tone="danger" disabled={!reason.trim() || busy} onClick={() => run(() => cancelOrder(ctx as Ctx, orderId as string, reason.trim()), { leave: true, message: "Order cancelled" })}>Cancel the order</Button></>}>
        <Field label="Why" required value={reason} placeholder="The reason the whole order is cancelled" onChange={setReason} />
        {error ? <Text variant="sup" tone="red">{error}</Text> : null}
      </Sheet>
    );
  }

  return (
    <Sheet placement={placement} title={title} summary={summary} onClose={onClose}>
      <div className="grid grid-cols-1 gap-kit-8 md:grid-cols-2" data-order-actions>
        {lead && tableId && rights.canMoveTable ? <ActionTile icon="table" title="Move table" line="To a free table, the order goes with it" onClick={() => { setTarget(null); setStep("move"); }} /> : null}
        {lead && tableId && rights.canJoin ? <ActionTile icon="serviceArea" title="Join tables" line="Put two tables on one bill" onClick={() => { setTarget(null); setStep("join"); }} /> : null}
        {lead && tableId && rights.canJoin && joinedHere.length ? <ActionTile icon="serviceArea" title="Split tables again" line={`${joinedHere.map((t) => t.label).join(", ")} joined here`} onClick={() => { setTarget(null); setStep("unjoin"); }} /> : null}
        {lead && tableId && rights.canMoveLine ? <ActionTile icon="table" title="Move a line" line="It was entered on the wrong table" onClick={() => setStep("linePick")} /> : null}
        {lead && rights.canSplit ? <ActionTile icon="count" title="Split bill" line="By guest, by item, by amount or evenly" onClick={() => setStep("split")} /> : null}
        {lead && rights.canChangeWaiter ? <ActionTile icon="staff" title="Change waiter" line="Give this table to someone else" onClick={() => { setTarget(null); setStep("waiter"); }} /> : null}
        {tableId && orderId && rights.canHandover ? <ActionTile icon="staff" title="Hand over this table" line="A colleague accepts it on their screen" onClick={() => { setTarget(null); setStep("handover"); }} /> : null}
        {lead && rights.canDiscount && !hasPayment ? <ActionTile icon="revenue" title="Discount" line="A reason is saved with your name" onClick={() => { setReason(""); setStep("discount"); }} /> : null}
        {lead && rights.canVoidLine ? <ActionTile icon="soldOut" title="Void an item" line="Pick the line, say why" onClick={() => setStep("voidPick")} /> : null}
        {canSameAgain ? <ActionTile icon="refresh" title="Same again" line="The drinks of the last round, not sent yet" onClick={onSameAgain} /> : null}
        {lead && rights.canVoidOrder && !hasPayment ? <ActionTile icon="close" title="Cancel the order" line="Everything on this table" danger onClick={() => { setReason(""); setStep("cancel"); }} /> : null}
      </div>
      {rights.canSetTableStatus && tableId ? (
        <div className="grid grid-cols-1 gap-kit-8 md:grid-cols-2">
          <ActionTile icon="table" title="Table status" line="Free, in use, reserved or cleaning" onClick={() => { setStatus(null); setStep("status"); }} />
        </div>
      ) : null}
      {hasPayment && lead ? <Text variant="sup" tone="muted">A payment is already posted, so Discount and Cancel the order are not offered.</Text> : null}
      {!lead && !canSameAgain && !rights.canHandover && !(rights.canSetTableStatus && tableId) ? <Text variant="sup" tone="muted">Same again shows here once a round of drinks is sent. A supervisor moves, discounts and voids.</Text> : null}
    </Sheet>
  );
}
