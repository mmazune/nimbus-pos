import { FOCUS, MOTION, TAP, focusLook, type KitDemo } from "./states";

export type OrderLineState = "notSent" | "sent" | "voided" | "soldOut";

export type OrderLineProps = {
  quantity: number;
  name: string;
  /** Choices under the name: "Double · Cola". */
  choices?: string;
  /** Grouped shillings. */
  price: string;
  state: OrderLineState;
  /** Inside a sheet: no side padding, so the line lines up with the sheet's own edge. */
  flush?: boolean;
  onClick?: () => void;
  demo?: KitDemo;
};

const WORD: Record<OrderLineState, string> = { notSent: "not sent", sent: "sent", voided: "voided", soldOut: "sold out, cannot be sent" };

/**
 * One line of an order: not sent, sent (quieter), voided (struck through, never deleted — R6),
 * or not sent with its item sold out (red, T5): it cannot go, and the screen offers Remove beside it.
 */
export function OrderLine({ quantity, name, choices, price, state, flush = false, onClick, demo }: OrderLineProps) {
  const sentish = state === "sent" || state === "voided";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={[`${quantity} ${name}`, choices, price, WORD[state]].filter(Boolean).join(", ")}
      className={[
        "flex min-h-kit-line w-full items-start gap-kit-10 py-kit-10 text-left font-kit",
        flush ? "px-kit-0" : "px-kit-16",
        demo === "pressed" ? "bg-kit-canvas" : "active:bg-kit-canvas",
        FOCUS,
        focusLook(demo),
        MOTION,
        TAP,
      ].join(" ")}
    >
      <span
        className={[
          "flex h-kit-qty w-kit-qty flex-none items-center justify-center rounded-kit-qty text-kit-avatar",
          sentish ? "bg-kit-neutral-t text-kit-muted" : "bg-kit-tonal text-kit-primary",
        ].join(" ")}
      >
        {quantity}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={[
            "text-kit-line-name",
            state === "sent"
              ? "font-kit-regular text-kit-text"
              : state === "voided"
                ? "font-kit-regular text-kit-muted line-through"
                : state === "soldOut"
                  ? "text-kit-red"
                  : "text-kit-text",
          ].join(" ")}
        >
          {name}
        </span>
        {choices ? <span className="text-kit-small text-kit-muted">{choices}</span> : null}
        {state === "soldOut" ? <span className="text-kit-small text-kit-red">Sold out, it cannot be sent</span> : null}
      </span>
      <span className={["whitespace-nowrap text-kit-price", state === "voided" ? "text-kit-muted line-through" : state === "soldOut" ? "text-kit-red" : "text-kit-text"].join(" ")}>
        {price}
      </span>
    </button>
  );
}
