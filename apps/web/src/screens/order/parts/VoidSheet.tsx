/**
 * Void one sent line (drawing Supervisor-Void, R6, E1's void route): was it made,
 * why, how many, a note. The line stays on the order, struck through; it leaves
 * the total. Only a role with `pos:order:item:void` reaches this sheet.
 */
import { useState } from "react";

import { Button, Field, OptionTile, Segmented, Sheet, Stepper, Text, type SheetPlacement } from "@/components/kit";

import { formatMoney } from "../data/money";
import type { OrderLineModel, VoidReason } from "../data/order";
import { timeOf } from "./OrderPanel";

const REASONS: Array<{ key: VoidReason; label: string }> = [
  { key: "GUEST_CHANGED_MIND", label: "Guest changed their mind" },
  { key: "WRONG_ITEM", label: "Wrong item entered" },
  { key: "KITCHEN_RAN_OUT", label: "Kitchen ran out" },
  { key: "TOOK_TOO_LONG", label: "Took too long" },
  { key: "GUEST_COMPLAINT", label: "Guest complaint" },
  { key: "OTHER", label: "Something else" },
];

type Props = {
  placement: SheetPlacement;
  line: OrderLineModel;
  tableTitle: string;
  waiterName: string | null;
  billMinor: number;
  busy: boolean;
  error: string | null;
  onVoid: (body: { reason: VoidReason; wasMade: boolean; quantity?: number; note?: string }) => void;
  onClose: () => void;
};

export function VoidSheet({ placement, line, tableTitle, waiterName, billMinor, busy, error, onVoid, onClose }: Props) {
  const [made, setMade] = useState<"made" | "notMade" | "">("");
  const [reason, setReason] = useState<VoidReason | null>(null);
  const [quantity, setQuantity] = useState(line.quantity);
  const [note, setNote] = useState("");

  const voidMinor = line.unitMinor * quantity;
  const after = billMinor - voidMinor;
  const needNote = reason === "OTHER" && !note.trim();
  const ready = made !== "" && reason !== null && !needNote && !busy;
  const word = quantity === 1 ? "item" : "items";

  return (
    <Sheet
      placement={placement}
      title={`Void ${line.name}`}
      summary={[tableTitle, `sent ${timeOf(line.sentAt)}`, formatMoney(line.lineMinor), waiterName].filter(Boolean).join(" · ")}
      onClose={onClose}
      footer={
        <>
          <span className="flex-1" />
          <Button tone="text" onClick={onClose}>
            Keep the item
          </Button>
          <Button
            tone="filled"
            disabled={!ready}
            onClick={() =>
              onVoid({
                reason: reason as VoidReason,
                wasMade: made === "made",
                ...(quantity < line.quantity ? { quantity } : {}),
                ...(note.trim() ? { note: note.trim() } : {}),
              })
            }
          >
            {busy ? "Voiding…" : `Void ${quantity} ${word} · ${formatMoney(voidMinor)}`}
          </Button>
        </>
      }
    >
      <div className="flex min-h-kit-0 flex-col gap-kit-12 overflow-y-auto" data-order-void-sheet>
        <Text variant="sup" strong>Was it made?</Text>
        <Segmented
          label="Was it made?"
          fill
          options={[
            { key: "made", label: "Made, it is waste" },
            { key: "notMade", label: "Not made, back to stock" },
          ]}
          value={made}
          onChange={(k) => setMade(k as "made" | "notMade")}
        />
        <Text variant="sup" strong>Why</Text>
        <div className="grid grid-cols-2 gap-kit-8 md:grid-cols-3">
          {REASONS.map((r) => (
            <OptionTile key={r.key} label={r.label} current={reason === r.key} onClick={() => setReason(r.key)} />
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-kit-16">
          <div className="flex flex-col gap-kit-8">
            <Text variant="sup" strong>How many</Text>
            <Stepper
              value={`${quantity} of ${line.quantity}`}
              noun="items"
              onDecrease={() => setQuantity((q) => Math.max(1, q - 1))}
              onIncrease={() => setQuantity((q) => Math.min(line.quantity, q + 1))}
            />
          </div>
          <div className="min-w-kit-0 flex-1">
            <Field
              label={reason === "OTHER" ? "Note (needed for “Something else”)" : "Note"}
              value={note}
              placeholder="Anything the manager should know"
              onChange={setNote}
              required={reason === "OTHER"}
            />
          </div>
        </div>
        <Text variant="small" tone="muted">
          {`Your name, the time and the reason are saved. The kitchen screen shows the item struck through. The bill becomes ${formatMoney(Math.max(0, after))}.`}
        </Text>
        {error ? <Text variant="sup" tone="red">{error}</Text> : null}
      </div>
    </Sheet>
  );
}
