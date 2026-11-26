import { FOCUS, MOTION, TAP, focusLook, type KitDemo } from "./states";

export type OrderLineState = "notSent" | "sent" | "voided";

export type OrderLineProps = {
  quantity: number;
  name: string;
  /** Choices under the name: "Double · Cola". */
  choices?: string;
  /** Grouped shillings. */
  price: string;
  state: OrderLineState;
  onClick?: () => void;
  demo?: KitDemo;
};

const WORD: Record<OrderLineState, string> = { notSent: "not sent", sent: "sent", voided: "voided" };

/** One line of an order: not sent, sent (quieter), voided (struck through, never deleted — R6). */
export function OrderLine({ quantity, name, choices, price, state, onClick, demo }: OrderLineProps) {
  const sentish = state !== "notSent";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={[`${quantity} ${name}`, choices, price, WORD[state]].filter(Boolean).join(", ")}
      className={[
        "flex min-h-kit-line w-full items-start gap-kit-10 px-kit-16 py-kit-10 text-left font-kit",
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
            state === "sent" ? "font-kit-regular text-kit-text" : state === "voided" ? "font-kit-regular text-kit-muted line-through" : "text-kit-text",
          ].join(" ")}
        >
          {name}
        </span>
        {choices ? <span className="text-kit-small text-kit-muted">{choices}</span> : null}
      </span>
      <span className={["whitespace-nowrap text-kit-price", state === "voided" ? "text-kit-muted line-through" : "text-kit-text"].join(" ")}>
        {price}
      </span>
    </button>
  );
}
