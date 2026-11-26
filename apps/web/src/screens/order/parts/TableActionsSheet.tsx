/**
 * The table actions sheet (drawing Supervisor-Table). Only actions an endpoint
 * supports today are shown; the drawing's others are left out and listed in the
 * T3 report (Join tables, Change waiter, Split bill, Send to kitchen again).
 * Each action opens its own step inside this sheet: never a sheet from a sheet.
 */
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ActionTile, Button, Field, OptionTile, OrderLine, Sheet, Text, type SheetPlacement } from "@/components/kit";

import { groupShillings } from "../data/money";
import { formatMoney } from "../data/money";
import {
  askForDiscount,
  cancelOrder,
  changeWaiter,
  choicesText,
  joinInto,
  listFreeTables,
  listOtherOpenOrders,
  listStaff,
  moveToTable,
  setTableStatus,
  splitEqually,
  TABLE_STATUSES,
  type TableStatus,
  type OrderLineModel,
} from "../data/order";
import type { OrderRights } from "../data/rights";

type Ctx = { token: string; branchId: string };
export type Step = "menu" | "move" | "discount" | "cancel" | "voidPick" | "join" | "waiter" | "split" | "status";

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

export function TableActionsSheet({ placement, title, summary, rights, ctx, orderId, tableId, totalMinor, canSameAgain, onSameAgain, sentLines, onVoidItem, hasPayment, initialStep = "menu", onDone, onClose }: Props) {
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
      <Sheet placement={placement} title={`Move ${title}`} summary="To a free table. The order goes with it." onClose={onClose}
        footer={<>{back}<span className="flex-1" /><Button tone="filled" disabled={!chosen || busy} onClick={() => run(() => moveToTable(ctx as Ctx, orderId as string, target as string), { leave: true, message: `Moved to ${chosen?.label}` })}>{chosen ? `Move to ${chosen.label}` : "Choose a table"}</Button></>}>
        <div className="grid grid-cols-3 gap-kit-8 md:grid-cols-5" data-order-move>
          {(tablesQ.data ?? []).map((t) => (
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
    const chosen = othersQ.data?.find((o) => o.id === target);
    return (
      <Sheet placement={placement} title={`Join ${title} to another table`} summary="This table's items move onto the other table's bill." onClose={onClose}
        footer={<>{back}<span className="flex-1" /><Button tone="filled" disabled={!chosen || busy} onClick={() => run(() => joinInto(ctx as Ctx, orderId as string, target as string), { leave: true, message: `Joined to ${chosen?.tableLabel}` })}>{chosen ? `Join to ${chosen.tableLabel}` : "Choose a table"}</Button></>}>
        <div className="grid grid-cols-2 gap-kit-8 md:grid-cols-3" data-order-join>
          {(othersQ.data ?? []).map((o) => (
            <OptionTile key={o.id} label={o.tableLabel} second={[o.waiterName, formatMoney(o.totalMinor)].filter(Boolean).join(" · ")} current={target === o.id} onClick={() => setTarget(o.id)} />
          ))}
        </div>
        {othersQ.data && othersQ.data.length === 0 ? <Text variant="sup" tone="muted">No other table has an open order.</Text> : null}
        {error ? <Text variant="sup" tone="red">{error}</Text> : null}
      </Sheet>
    );
  }

  if (step === "waiter") {
    const chosen = staffQ.data?.find((m) => m.userId === target);
    return (
      <Sheet placement={placement} title={`Change the waiter on ${title}`} summary="The table and its order go to the person you choose." onClose={onClose}
        footer={<>{back}<span className="flex-1" /><Button tone="filled" disabled={!chosen || busy} onClick={() => run(() => changeWaiter(ctx as Ctx, orderId as string, target as string), { leave: false, message: `${chosen?.name} has this table now` })}>{chosen ? `Give it to ${chosen.name}` : "Choose who"}</Button></>}>
        <div className="grid grid-cols-2 gap-kit-8 md:grid-cols-4" data-order-waiters>
          {(staffQ.data ?? []).map((m) => (
            <OptionTile key={m.userId} label={m.name} current={target === m.userId} onClick={() => setTarget(m.userId)} />
          ))}
        </div>
        {error ? <Text variant="sup" tone="red">{error}</Text> : null}
      </Sheet>
    );
  }

  if (step === "split") {
    return (
      <Sheet placement={placement} title={`Split the bill on ${title}`} summary="Equal parts are recorded for the cashier. Payment still settles the whole bill." onClose={onClose}
        footer={<>{back}<span className="flex-1" /><Button tone="filled" disabled={!count || busy} onClick={() => run(() => splitEqually(ctx as Ctx, orderId as string, count as number), { leave: false, message: `Split in ${count} recorded` })}>{count ? `Split in ${count}` : "Choose how many"}</Button></>}>
        <Text variant="sup" strong>Between how many guests</Text>
        <div className="grid grid-cols-5 gap-kit-8" data-order-split>
          {[2, 3, 4, 5, 6].map((n) => (
            <OptionTile key={n} label={String(n)} second={formatMoney(Math.floor(totalMinor / n / 100) * 100)} current={count === n} onClick={() => setCount(n)} />
          ))}
        </div>
        {error ? <Text variant="sup" tone="red">{error}</Text> : null}
      </Sheet>
    );
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
        {lead && tableId ? <ActionTile icon="table" title="Move table" line="To a free table, the order goes with it" onClick={() => { setReason(""); setStep("move"); }} /> : null}
        {lead && tableId ? <ActionTile icon="serviceArea" title="Join tables" line="Put two tables on one bill" onClick={() => { setTarget(null); setStep("join"); }} /> : null}
        {lead ? <ActionTile icon="staff" title="Change waiter" line="Give this table to someone else" onClick={() => { setTarget(null); setStep("waiter"); }} /> : null}
        {lead ? <ActionTile icon="count" title="Split bill" line="Equal parts, recorded for the cashier" onClick={() => { setCount(null); setStep("split"); }} /> : null}
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
      {!lead && !canSameAgain && !(rights.canSetTableStatus && tableId) ? <Text variant="sup" tone="muted">Nothing more to do on this table yet.</Text> : null}
    </Sheet>
  );
}
