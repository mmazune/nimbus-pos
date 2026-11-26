import { Pill } from "./Pill";
import { FOCUS, MOTION, TAP, focusLook, type KitDemo } from "./states";

export type Measure = { key: string; label: string; price: string };

export type MeasureRowProps = {
  name: string;
  /** Tot, Double, Bottle… each a 48 px button at least 76 wide. */
  measures: readonly Measure[];
  onPick?: (key: string) => void;
  /** Sold out: the measures are greyed and say so ("Sold out since 19:40"). */
  soldOut?: string;
  /** A counted-down number: an amber "3 left" beside the name. */
  left?: number;
  /** Gallery only: force a look on one measure. */
  demo?: { key: string; look: KitDemo };
};

/** An item sold in measures: the measures are buttons on the row (R3). */
export function MeasureRow({ name, measures, onPick, soldOut, left, demo }: MeasureRowProps) {
  return (
    <div className="flex min-h-kit-row min-w-0 items-center gap-kit-8 rounded-kit-control bg-kit-card py-kit-8 pl-kit-14 pr-kit-8 shadow-kit-small font-kit">
      <span className={["flex min-w-0 flex-1 flex-col text-kit-item", soldOut ? "text-kit-muted" : "text-kit-text"].join(" ")}>
        {name}
        {soldOut ? <span className="text-kit-sup text-kit-muted">{soldOut}</span> : null}
      </span>
      {!soldOut && left !== undefined ? <Pill tone="amber">{`${left} left`}</Pill> : null}
      {measures.map((m) => {
        const look = demo?.key === m.key ? demo.look : undefined;
        return (
          <button
            key={m.key}
            type="button"
            aria-label={`${name}, ${m.label}, ${soldOut ?? m.price}`}
            aria-disabled={soldOut ? true : undefined}
            onClick={() => (soldOut ? undefined : onPick?.(m.key))}
            className={[
              "flex h-kit-measure-h min-w-kit-measure-w flex-none flex-col items-center justify-center rounded-kit-seg px-kit-10 text-kit-measure text-kit-primary",
              soldOut ? "bg-kit-neutral-t text-kit-muted" : look === "pressed" ? "bg-kit-tonal-2" : "bg-kit-tonal active:bg-kit-tonal-2",
              FOCUS,
              focusLook(look),
              MOTION,
              TAP,
            ].join(" ")}
          >
            {m.label}
            <span className="text-kit-measure-price text-kit-muted">{m.price}</span>
          </button>
        );
      })}
    </div>
  );
}
