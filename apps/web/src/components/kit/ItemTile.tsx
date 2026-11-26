import { Pill } from "./Pill";
import { FOCUS, MOTION, TAP, focusLook, type KitDemo } from "./states";

export type ItemTileProps = {
  name: string;
  /** Grouped shillings, e.g. "28,000". */
  price: string;
  /** A counted-down number: shown as an amber "3 left". */
  left?: number;
  /** Sold out: greyed, the price replaced by "Sold out". */
  soldOut?: boolean;
  onClick?: () => void;
  demo?: KitDemo;
};

/** A 96 px menu item on the order screen. */
export function ItemTile({ name, price, left, soldOut = false, onClick, demo }: ItemTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={[name, soldOut ? "Sold out" : price, !soldOut && left !== undefined ? `${left} left` : ""].filter(Boolean).join(", ")}
      className={[
        "flex h-kit-item w-full min-w-0 flex-col justify-between rounded-kit-control px-kit-14 py-kit-12 text-left font-kit",
        soldOut
          ? "bg-kit-neutral-t text-kit-muted"
          : demo === "pressed"
            ? "bg-kit-canvas text-kit-text shadow-kit-small"
            : "bg-kit-card text-kit-text shadow-kit-small active:bg-kit-canvas",
        FOCUS,
        focusLook(demo),
        MOTION,
        TAP,
      ].join(" ")}
    >
      <span className="text-kit-item">{name}</span>
      <span className="flex items-center justify-between gap-kit-6 text-kit-sup text-kit-muted">
        {soldOut ? "Sold out" : price}
        {!soldOut && left !== undefined ? <Pill tone="amber">{`${left} left`}</Pill> : null}
      </span>
    </button>
  );
}
