/**
 * The order column (372 px on a terminal): "Order" and the count, the lines not
 * sent, then each Send by time, the total, and the bottom row with the one
 * filled button (R5). Drawings Order-Empty, Order-Terminal, Order-Other.
 */
import type { ReactNode } from "react";

import { Button, KitIcon, OrderLine, SquareAction, Text } from "@/components/kit";

import { formatMoney, groupShillings } from "../data/money";
import { choicesText, sentRounds, type OrderLineModel } from "../data/order";
import type { FilledAction } from "../data/rights";

export function timeOf(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Kampala" });
}

function countWord(n: number) {
  return n === 0 ? "No items" : n === 1 ? "1 item" : `${n} items`;
}

type Props = {
  title?: string;
  lines: OrderLineModel[];
  count: number;
  totalMinor: number;
  /** Shown as its own row above the total when a discount is taken. */
  discountMinor?: number;
  unsentCount: number;
  filled: FilledAction;
  busy: string | null;
  /** Lines cannot be read (another waiter's table): only the count and total show. */
  linesHidden?: boolean;
  onLine?: (line: OrderLineModel) => void;
  onSend: () => void;
  onPrintBill: () => void;
  onTakePayment: () => void;
  onMore?: () => void;
  onSameAgain?: () => void;
  canSameAgain: boolean;
  /** Lines that may be tapped: unsent ones always; sent ones when the role may void. */
  sentTappable: boolean;
  notice?: ReactNode;
  /** On the cashier's payment view the order column becomes "Bill" and keeps a tonal Print bill. */
  billMode?: boolean;
};

export function sendLabel(n: number) {
  return n === 0 ? "Send" : n === 1 ? "Send 1 item" : `Send ${n} items`;
}

export function OrderPanel(props: Props) {
  const { lines, count, totalMinor, discountMinor = 0, unsentCount, filled, busy, linesHidden, onLine, onSend, onPrintBill, onTakePayment, onMore, onSameAgain, canSameAgain, sentTappable, notice, billMode } = props;
  const unsent = lines.filter((l) => l.state === "unsent");
  const rounds = sentRounds(lines);
  const empty = lines.length === 0 && !linesHidden;

  const filledButton =
    filled === "send" ? (
      <Button tone="filled" fill disabled={unsentCount === 0 || busy !== null} onClick={onSend}>
        {busy === "send" ? "Sending…" : sendLabel(unsentCount)}
      </Button>
    ) : filled === "takePayment" ? (
      <Button tone="filled" fill disabled={busy !== null} onClick={onTakePayment}>
        Take payment
      </Button>
    ) : filled === "printBill" ? (
      <Button tone="filled" fill disabled={busy !== null} onClick={onPrintBill}>
        Print bill
      </Button>
    ) : null;

  // The second button: Print bill beside Send or Take payment, when the role may ask for the bill.
  const showPrintTonal = (filled === "send" && rounds.length > 0) || filled === "takePayment" || billMode;

  return (
    <aside className="flex min-h-kit-0 w-kit-sheet-wide-gap flex-none flex-col bg-kit-card shadow-kit-line-left" aria-label="Order" data-order-panel>
      <div className="flex items-baseline justify-between px-kit-16 pb-kit-8 pt-kit-20">
        <Text variant="h" as="h2">{props.title ?? "Order"}</Text>
        {/* Another waiter's order: the API gives only its line ids, so the count is lines, not items. */}
        <Text variant="sup" tone="muted">{linesHidden ? (count === 1 ? "1 line" : `${count} lines`) : countWord(count)}</Text>
      </div>

      <div className="flex min-h-kit-0 flex-1 flex-col overflow-y-auto pb-kit-12" data-order-lines>
        {empty ? (
          <div className="flex flex-col items-center gap-kit-12 px-kit-24 pt-kit-44 text-center" data-order-empty>
            <span className="flex h-kit-bubble w-kit-bubble items-center justify-center rounded-kit-full bg-kit-tonal text-kit-primary" aria-hidden="true">
              <KitIcon name="plus" size="bar" />
            </span>
            <Text variant="row">Nothing on this table yet</Text>
            <Text variant="sup" tone="muted">Tap an item to start. The table stays free until you send the order.</Text>
          </div>
        ) : null}

        {unsent.length ? (
          <section aria-label="Not sent" data-order-unsent>
            <div className="px-kit-16 pb-kit-4 pt-kit-8">
              <Text variant="cap" tone="muted">Not sent</Text>
            </div>
            {unsent.map((l) => (
              <OrderLine key={l.key} quantity={l.quantity} name={l.name} choices={choicesText(l) || undefined} price={groupShillings(l.lineMinor)} state="notSent" onClick={onLine ? () => onLine(l) : undefined} />
            ))}
          </section>
        ) : null}

        {rounds.map((r, i) => (
          <section key={r.sentAt} aria-label={`Sent ${timeOf(r.sentAt)}`} className={unsent.length || i > 0 ? "mx-kit-16 mt-kit-8 shadow-kit-line-top" : ""} data-order-round>
            <div className={["flex items-center justify-between pb-kit-4 pt-kit-12", unsent.length || i > 0 ? "" : "px-kit-16"].join(" ")}>
              <Text variant="cap" tone="muted">{`Sent ${timeOf(r.sentAt)}`}</Text>
              {i === 0 && canSameAgain && onSameAgain ? (
                <Button tone="text" size="laptop" onClick={onSameAgain}>
                  Same again
                </Button>
              ) : null}
            </div>
            <div className={unsent.length || i > 0 ? "-mx-kit-16" : ""}>
              {r.lines.map((l) => (
                <OrderLine
                  key={l.key}
                  quantity={l.quantity}
                  name={l.name}
                  choices={[choicesText(l), l.state === "voided" ? "Voided" : ""].filter(Boolean).join(" · ") || undefined}
                  price={groupShillings(l.lineMinor)}
                  state={l.state === "voided" ? "voided" : "sent"}
                  onClick={sentTappable && l.state === "sent" && onLine ? () => onLine(l) : undefined}
                />
              ))}
            </div>
          </section>
        ))}

        {linesHidden ? (
          <div className="px-kit-16 pt-kit-8">
            <Text variant="sup" tone="muted">Only the waiter on this table sees its lines.</Text>
          </div>
        ) : null}
        {notice}
      </div>

      <div className="flex flex-col gap-kit-12 px-kit-16 pb-kit-16 pt-kit-16 shadow-kit-foot" data-order-foot>
        {discountMinor > 0 ? (
          <div className="flex items-baseline justify-between" data-order-discount>
            <Text variant="sup" tone="muted">Discount</Text>
            <Text variant="sup" tone="muted">{`−${formatMoney(discountMinor)}`}</Text>
          </div>
        ) : null}
        <div className="flex items-baseline justify-between">
          <Text variant="row">Total</Text>
          <span className="text-kit-h text-kit-text" data-order-total>{formatMoney(totalMinor)}</span>
        </div>
        <div className="flex items-center gap-kit-8">
          {onMore ? <SquareAction icon="more" label="More for this table" tone="tonal" onClick={onMore} /> : null}
          {showPrintTonal ? (
            <Button tone="tonal" fill disabled={busy !== null} onClick={onPrintBill}>
              Print bill
            </Button>
          ) : null}
          {billMode ? null : filledButton}
        </div>
      </div>
    </aside>
  );
}
