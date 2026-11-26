import { FOCUS, MOTION, TAP, focusLook, type KitDemo } from "./states";

export type Measure = { key: string; label: string; price: string };

export type MeasureRowProps = {
  name: string;
  /** Tot, Double, Bottle… each a 48 px button at least 76 wide. */
  measures: readonly Measure[];
  onPick?: (key: string) => void;
  /** Gallery only: force a look on one measure. */
  demo?: { key: string; look: KitDemo };
};

/** An item sold in measures: the measures are buttons on the row (R3). */
export function MeasureRow({ name, measures, onPick, demo }: MeasureRowProps) {
  return (
    <div className="flex min-h-kit-row min-w-0 items-center gap-kit-8 rounded-kit-control bg-kit-card py-kit-8 pl-kit-14 pr-kit-8 shadow-kit-small font-kit">
      <span className="min-w-0 flex-1 text-kit-item text-kit-text">{name}</span>
      {measures.map((m) => {
        const look = demo?.key === m.key ? demo.look : undefined;
        return (
          <button
            key={m.key}
            type="button"
            aria-label={`${name}, ${m.label}, ${m.price}`}
            onClick={() => onPick?.(m.key)}
            className={[
              "flex h-kit-measure-h min-w-kit-measure-w flex-none flex-col items-center justify-center rounded-kit-seg px-kit-10 text-kit-measure text-kit-primary",
              look === "pressed" ? "bg-kit-tonal-2" : "bg-kit-tonal active:bg-kit-tonal-2",
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
