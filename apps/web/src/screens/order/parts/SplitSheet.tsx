/**
 * Split the bill four ways (drawings Split-Guest, Split-Item, Split-Amount, Split-Even), inside the
 * table actions sheet: one Sheet, a segmented control for the way, one filled button.
 *   By guest   the guest each line was ordered for → one bill per guest (T2 split-by-guest).
 *   By item    tap lines onto a second bill → a second bill on the table (split-items).
 *   By amount  a sum for bill 1, the rest on bill 2 → shares recorded for the cashier (split-bill).
 *   Evenly     2–8 people → equal shares recorded for the cashier (split-bill).
 * A line's guest is set when it is ordered (the Guest button on the order); a sent line cannot be
 * given a guest afterwards (no route), so "tap a line, then the guest" is left out and listed.
 */
import { useState, type ReactNode } from "react";

import { Button, Field, OptionTile, OrderLine, Segmented, Sheet, Text, type SheetPlacement } from "@/components/kit";

import { formatMoney, groupShillings, toMinor, type Minor } from "../data/money";
import { choicesText, type OrderLineModel } from "../data/order";
import { evenShares, splitByAmount, splitByGuest, splitByItem, splitEvenly } from "../data/seating";

type Ctx = { token: string; branchId: string };
type Way = "guest" | "item" | "amount" | "even";

type Props = {
  placement: SheetPlacement;
  title: string;
  ctx: Ctx;
  orderId: string;
  totalMinor: Minor;
  lines: OrderLineModel[];
  back: ReactNode;
  onClose: () => void;
  run: (fn: () => Promise<unknown>, outcome: { leave: boolean; message: string }) => Promise<void>;
  busy: boolean;
  error: string | null;
};

const COUNTS = [2, 3, 4, 5, 6, 8];
const QUICK = [10_000_00, 20_000_00, 50_000_00];

export function SplitSheet({ placement, title, ctx, orderId, totalMinor, lines, back, onClose, run, busy, error }: Props) {
  const [way, setWay] = useState<Way>("guest");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [amount, setAmount] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const live = lines.filter((l) => l.state === "sent" || (l.state === "unsent" && l.serverId));
  const itemCount = live.reduce((n, l) => n + l.quantity, 0);

  let body: ReactNode = null;
  let action: ReactNode = null;

  if (way === "guest") {
    const guests = [...new Set(live.map((l) => l.guest).filter((g): g is number => typeof g === "number"))].sort((a, b) => a - b);
    const none = live.filter((l) => typeof l.guest !== "number");
    body = (
      <div className="flex flex-col gap-kit-12" data-split-guest>
        {guests.map((g) => {
          const mine = live.filter((l) => l.guest === g);
          return (
            <section key={g} aria-label={`Guest ${g}`}>
              <div className="flex items-baseline justify-between">
                <Text variant="row">{`Guest ${g}`}</Text>
                <Text variant="sup" tone="muted">{formatMoney(mine.reduce((s, l) => s + l.lineMinor, 0))}</Text>
              </div>
              {mine.map((l) => (
                <OrderLine key={l.key} flush quantity={l.quantity} name={l.name} choices={choicesText(l) || undefined} price={groupShillings(l.lineMinor)} state="sent" />
              ))}
            </section>
          );
        })}
        {none.length ? (
          <Text variant="sup" tone="muted">{`${none.length === 1 ? "1 line has" : `${none.length} lines have`} no guest. A line's guest is set when it is ordered, with the Guest button.`}</Text>
        ) : (
          <Text variant="sup" tone="muted">{`All ${itemCount} items have a guest.`}</Text>
        )}
      </div>
    );
    action = (
      <Button tone="filled" disabled={busy || guests.length < 2 || none.length > 0} onClick={() => run(() => splitByGuest(ctx, orderId), { leave: false, message: `${guests.length} bills made, one per guest` })}>
        {guests.length >= 2 ? `Make ${guests.length} bills` : "Needs two guests"}
      </Button>
    );
  } else if (way === "item") {
    const second = live.filter((l) => picked.has(l.key));
    const first = live.filter((l) => !picked.has(l.key));
    const sum = (ls: OrderLineModel[]) => ls.reduce((s, l) => s + l.lineMinor, 0);
    const list = (ls: OrderLineModel[]) =>
      ls.map((l) => (
        <OrderLine
          key={l.key}
          flush
          quantity={l.quantity}
          name={l.name}
          choices={choicesText(l) || undefined}
          price={groupShillings(l.lineMinor)}
          state="sent"
          onClick={() => setPicked((cur) => {
            const next = new Set(cur);
            if (next.has(l.key)) next.delete(l.key);
            else next.add(l.key);
            return next;
          })}
        />
      ));
    body = (
      <div className="flex flex-col gap-kit-12" data-split-item>
        <div className="flex items-baseline justify-between"><Text variant="row">{`Bill 1, stays on ${title}`}</Text><Text variant="sup" tone="muted">{formatMoney(sum(first))}</Text></div>
        {list(first)}
        <div className="flex items-baseline justify-between"><Text variant="row">Bill 2, new</Text><Text variant="sup" tone="muted">{formatMoney(sum(second))}</Text></div>
        {second.length ? list(second) : <Text variant="sup" tone="muted">Tap a line to move it to the other bill.</Text>}
        <Text variant="sup" tone="muted">Each bill is paid on its own; the table frees when both are paid.</Text>
      </div>
    );
    action = (
      <Button
        tone="filled"
        disabled={busy || second.length === 0 || first.length === 0}
        onClick={() => run(() => splitByItem(ctx, orderId, second.filter((l) => l.serverId).map((l) => ({ orderItemId: l.serverId as string, quantity: l.quantity }))), { leave: false, message: "2 bills made" })}
      >
        {second.length && first.length ? `Make 2 bills · ${groupShillings(sum(first))} and ${groupShillings(sum(second))}` : "Pick the lines for bill 2"}
      </Button>
    );
  } else if (way === "amount") {
    const typed = toMinor(amount.replace(/[^\d]/g, "")) ?? 0;
    const ok = typed > 0 && typed < totalMinor;
    body = (
      <div className="flex flex-col gap-kit-12" data-split-amount>
        <Field label="Bill 1, paid now" value={amount ? groupShillings(typed) : ""} inputMode="numeric" placeholder="For example 50,000" onChange={(v) => setAmount(v.replace(/[^\d]/g, ""))} />
        <div className="grid grid-cols-4 gap-kit-8">
          {QUICK.filter((q) => q < totalMinor).map((q) => (
            <OptionTile key={q} label={groupShillings(q)} current={typed === q} onClick={() => setAmount(String(q / 100))} />
          ))}
          <OptionTile label="Half" current={typed === Math.round(totalMinor / 200) * 100} onClick={() => setAmount(String(Math.round(totalMinor / 200)))} />
        </div>
        <div className="flex items-baseline justify-between"><Text variant="row">{`Bill 2, left on ${title}`}</Text><Text variant="sup" tone="muted">{ok ? formatMoney(totalMinor - typed) : "—"}</Text></div>
        <Text variant="sup" tone="muted">Bill 1 is a sum, not items. The lines stay on the table until the last shilling is paid; the cashier sees the two shares.</Text>
      </div>
    );
    action = (
      <Button tone="filled" disabled={busy || !ok} onClick={() => run(() => splitByAmount(ctx, orderId, [typed, totalMinor - typed]), { leave: false, message: "2 shares recorded for the cashier" })}>
        {ok ? `Make 2 bills · ${groupShillings(typed)} and ${groupShillings(totalMinor - typed)}` : "Type bill 1"}
      </Button>
    );
  } else {
    const shares = count ? evenShares(totalMinor, count) : [];
    body = (
      <div className="flex flex-col gap-kit-12" data-split-even>
        <Text variant="sup" strong>How many people?</Text>
        <div className="grid grid-cols-6 gap-kit-8">
          {COUNTS.map((n) => <OptionTile key={n} label={String(n)} current={count === n} onClick={() => setCount(n)} />)}
        </div>
        {count ? (
          <>
            <Text variant="row">{`Each pays ${formatMoney(shares[shares.length - 1])}`}</Text>
            {shares[0] !== shares[shares.length - 1] ? (
              <Text variant="sup" tone="muted">{`${groupShillings(totalMinor)} does not divide by ${count}, so the first bill takes the extra ${groupShillings(shares[0] - shares[1])} shillings: ${shares.map(groupShillings).join(", ")}.`}</Text>
            ) : null}
            <Text variant="sup" tone="muted">The shares are recorded for the cashier.</Text>
          </>
        ) : null}
      </div>
    );
    action = (
      <Button tone="filled" disabled={busy || !count} onClick={() => run(() => splitEvenly(ctx, orderId, count as number), { leave: false, message: `${count} equal shares recorded for the cashier` })}>
        {count ? `Make ${count} bills` : "Choose how many"}
      </Button>
    );
  }

  return (
    <Sheet
      placement={placement}
      title="Split the bill"
      summary={`${title} · ${formatMoney(totalMinor)} · ${itemCount === 1 ? "1 item" : `${itemCount} items`}`}
      onClose={onClose}
      footer={<>{back}<span className="flex-1" />{action}</>}
    >
      <Segmented
        label="How to split"
        fill
        value={way}
        onChange={(k) => setWay(k as Way)}
        options={[
          { key: "guest", label: "By guest" },
          { key: "item", label: "By item" },
          { key: "amount", label: "By amount" },
          { key: "even", label: "Evenly" },
        ]}
      />
      {body}
      {error ? <Text variant="sup" tone="red">{error}</Text> : null}
    </Sheet>
  );
}
