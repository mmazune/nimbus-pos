import { FOCUS, MOTION, TAP, focusLook, type KitDemo } from "./states";

export type ChipProps = {
  label: string;
  count?: number;
  current?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  demo?: KitDemo;
};

/** 44 px round chip; the chosen one filled. Three in a row at most, each fits its word. */
export function Chip({ label, count, current = false, disabled, onClick, demo }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={current}
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex h-kit-chip flex-none items-center gap-kit-8 whitespace-nowrap rounded-kit-chip px-kit-16 text-kit-chip font-kit",
        disabled
          ? "bg-kit-neutral-t text-kit-muted cursor-not-allowed"
          : current
            ? "bg-kit-primary text-kit-on-primary"
            : demo === "pressed"
              ? "bg-kit-canvas text-kit-text shadow-kit-small"
              : "bg-kit-card text-kit-text shadow-kit-small active:bg-kit-canvas",
        FOCUS,
        focusLook(demo),
        MOTION,
        TAP,
      ].join(" ")}
    >
      {label}
      {count !== undefined ? (
        <span className={["font-kit-regular", current ? "text-kit-on-primary-muted" : "text-kit-muted"].join(" ")}>{count}</span>
      ) : null}
    </button>
  );
}
