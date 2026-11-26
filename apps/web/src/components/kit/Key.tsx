import { FOCUS, MOTION, TAP, focusLook, type KitDemo } from "./states";

export type KeyProps = {
  /** "1" … "9", "0", "000". */
  label: string;
  /** Accessible name when the face is not a digit, e.g. "Delete". */
  name?: string;
  disabled?: boolean;
  onPress?: () => void;
  demo?: KitDemo;
};

/** A 100 px keypad key (Cashier-Pay). */
export function Key({ label, name, disabled, onPress, demo }: KeyProps) {
  return (
    <button
      type="button"
      aria-label={name}
      disabled={disabled}
      onClick={onPress}
      className={[
        "flex h-kit-key w-full min-w-0 items-center justify-center rounded-kit-control text-center text-kit-key font-kit",
        disabled
          ? "bg-kit-neutral-t text-kit-muted cursor-not-allowed"
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
    </button>
  );
}
