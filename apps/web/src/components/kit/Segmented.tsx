import { FOCUS, MOTION, TAP, focusLook, type KitDemo } from "./states";

export type SegmentedOption = { key: string; label: string; disabled?: boolean };

export type SegmentedProps = {
  /** Accessible name of the control, e.g. "Whose tables". */
  label: string;
  options: readonly SegmentedOption[];
  value: string;
  onChange?: (key: string) => void;
  /** Full width, choices share the width (kit.css `.seg.fill`). */
  fill?: boolean;
  /** Gallery only: force a look on the first unchosen choice. */
  demo?: KitDemo;
};

/** Grey track, two or three 44 px choices, the chosen one raised. */
export function Segmented({ label, options, value, onChange, fill = false, demo }: SegmentedProps) {
  const firstOther = options.find((o) => o.key !== value)?.key;
  return (
    <div
      role="tablist"
      aria-label={label}
      className={[fill ? "flex" : "inline-flex", "gap-kit-4 rounded-kit-seg bg-kit-tonal p-kit-4"].join(" ")}
    >
      {options.map((o) => {
        const on = o.key === value;
        const look = o.key === firstOther ? demo : undefined;
        return (
          <button
            key={o.key}
            type="button"
            role="tab"
            aria-selected={on}
            disabled={o.disabled}
            onClick={() => onChange?.(o.key)}
            className={[
              "flex h-kit-seg items-center justify-center gap-kit-8 whitespace-nowrap rounded-kit-seg-button px-kit-18 text-kit-seg font-kit",
              fill ? "flex-1 min-w-0" : "",
              o.disabled
                ? "text-kit-muted cursor-not-allowed opacity-kit-second-line"
                : on
                  ? "bg-kit-card text-kit-primary shadow-kit-small font-kit-bold"
                  : look === "pressed"
                    ? "bg-kit-tonal-2 text-kit-muted"
                    : "text-kit-muted active:bg-kit-tonal-2",
              FOCUS,
              focusLook(look),
              MOTION,
              TAP,
            ].join(" ")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
