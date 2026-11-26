/**
 * The table actions sheet (drawing Supervisor-Table). Only actions an endpoint
 * supports today are shown; the drawing's others are left out and listed in the
 * T3 report (Join tables, Change waiter, Split bill, Send to kitchen again).
 * Each action opens its own step inside this sheet: never a sheet from a sheet.
 */
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ActionTile, Button, Field, OptionTile, Sheet, Text, type SheetPlacement } from "@/components/kit";

import { askForDiscount, cancelOrder, listFreeTables, moveToTable } from "../data/order";
import type { OrderRights } from "../data/rights";

type Ctx = { token: string; branchId: string };
type Step = "menu" | "move" | "discount" | "cancel";

type Props = {
  placement: SheetPlacement;
  title: string;
  summary: string;
  rights: OrderRights;
  ctx: Ctx | null;
  orderId: string | null;
  tableId: string;
  canSameAgain: boolean;
  onSameAgain: () => void;
  onVoidItem: () => void;
  /** After a change on the server: the screen re-reads; `leave` when the table no longer holds this order. */
  onDone: (outcome: { leave: boolean; message: string }) => void;
  onClose: () => void;
};

const PERCENTS = [5, 10, 15, 20, 50];
const DISCOUNT_REASONS = ["Regular guest", "Slow service", "Kitchen error", "Manager’s offer"];

export function TableActionsSheet({ placement, title, summary, rights, ctx, orderId, tableId, canSameAgain, onSameAgain, onVoidItem, onDone, onClose }: Props) {
  const [step, setStep] = useState<Step>("menu");
  const [target, setTarget] = useState<string | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tablesQ = useQuery({
    queryKey: ["order-screen", "free-tables", ctx?.branchId, tableId],
    enabled: Boolean(ctx && step === "move"),
    queryFn: () => listFreeTables(ctx as Ctx, tableId),
    staleTime: 5_000,
  });

  const run = async (fn: () => Promise<void>, outcome: { leave: boolean; message: string }) => {
    if (!ctx) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      onDone(outcome);
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
        footer={<>{back}<span className="flex-1" /><Button tone="filled" disabled={!percent || !reason.trim() || busy} onClick={() => run(() => askForDiscount(ctx as Ctx, orderId as string, percent as number, reason.trim()), { leave: false, message: `${percent}% off asked for` })}>{percent ? `Take ${percent}% off` : "Choose how much"}</Button></>}>
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
        {lead ? <ActionTile icon="table" title="Move table" line="To a free table, the order goes with it" onClick={() => { setReason(""); setStep("move"); }} /> : null}
        {lead && rights.canDiscount ? <ActionTile icon="revenue" title="Discount" line="A reason is saved with your name" onClick={() => { setReason(""); setStep("discount"); }} /> : null}
        {lead && rights.canVoidLine ? <ActionTile icon="soldOut" title="Void an item" line="Pick the line, say why" onClick={onVoidItem} /> : null}
        {canSameAgain ? <ActionTile icon="refresh" title="Same again" line="The drinks of the last round, not sent yet" onClick={onSameAgain} /> : null}
        {lead && rights.canVoidOrder ? <ActionTile icon="close" title="Cancel the order" line="Everything on this table" danger onClick={() => { setReason(""); setStep("cancel"); }} /> : null}
      </div>
      {!lead && !canSameAgain ? <Text variant="sup" tone="muted">Nothing more to do on this table yet.</Text> : null}
    </Sheet>
  );
}
