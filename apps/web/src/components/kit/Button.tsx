import type { ReactNode } from "react";

import type { OperationalIconName } from "@/components/pos-shell/role-icons";

import { KitIcon } from "./KitIcon";
import { FOCUS, MOTION, TAP, focusLook, type KitDemo } from "./states";

export type ButtonTone = "filled" | "tonal" | "text" | "danger";

type Base = {
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  demo?: KitDemo;
};

const BUTTON_TONE: Record<ButtonTone, { idle: string; pressed: string }> = {
  filled: { idle: "bg-kit-primary text-kit-on-primary active:bg-kit-primary-2", pressed: "bg-kit-primary-2 text-kit-on-primary" },
  tonal: { idle: "bg-kit-tonal text-kit-primary active:bg-kit-tonal-2", pressed: "bg-kit-tonal-2 text-kit-primary" },
  text: { idle: "bg-kit-card text-kit-link active:bg-kit-tonal", pressed: "bg-kit-tonal text-kit-link" },
  danger: { idle: "bg-kit-card text-kit-red active:bg-kit-red-t", pressed: "bg-kit-red-t text-kit-red" },
};

export type ButtonProps = Base & {
  tone: ButtonTone;
  /** 52 on touch (default), 44 on a laptop. */
  size?: "touch" | "laptop";
  icon?: OperationalIconName;
  /** Stretch to share the row (kit.css `flex: 1 1 0`). */
  fill?: boolean;
  children: ReactNode;
};

/** Filled, tonal, text and danger text. No outlined button exists. */
export function Button({ tone, size = "touch", icon, fill = false, disabled, onClick, type = "button", demo, children }: ButtonProps) {
  const t = BUTTON_TONE[tone];
  const plain = tone === "text" || tone === "danger";
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex items-center justify-center gap-kit-8 rounded-kit-control whitespace-nowrap text-center text-kit-button font-kit",
        size === "touch" ? "h-kit-button" : "h-kit-button-sm",
        plain ? "px-kit-12" : "px-kit-20",
        fill ? "flex-1 min-w-kit-0" : "flex-none",
        disabled
          ? plain
            ? "bg-kit-card text-kit-muted cursor-not-allowed"
            : "bg-kit-neutral-t text-kit-muted cursor-not-allowed"
          : demo === "pressed"
            ? t.pressed
            : t.idle,
        FOCUS,
        focusLook(demo),
        MOTION,
        TAP,
      ].join(" ")}
    >
      {icon ? <KitIcon name={icon} size="inButton" /> : null}
      {children}
    </button>
  );
}

export type IconActionTone = "tonal" | "filled" | "card" | "onPrimary" | "field";

const ICON_TONE: Record<IconActionTone, { idle: string; pressed: string }> = {
  tonal: { idle: "bg-kit-tonal text-kit-primary active:bg-kit-tonal-2", pressed: "bg-kit-tonal-2 text-kit-primary" },
  filled: { idle: "bg-kit-primary text-kit-on-primary active:bg-kit-primary-2", pressed: "bg-kit-primary-2 text-kit-on-primary" },
  card: { idle: "bg-kit-card text-kit-primary shadow-kit-small active:bg-kit-canvas", pressed: "bg-kit-canvas text-kit-primary shadow-kit-small" },
  onPrimary: { idle: "bg-kit-primary-2 text-kit-on-primary active:bg-kit-primary", pressed: "bg-kit-primary text-kit-on-primary" },
  field: { idle: "bg-kit-field text-kit-text active:bg-kit-tonal-2", pressed: "bg-kit-tonal-2 text-kit-text" },
};

export type SquareActionProps = Base & {
  icon: OperationalIconName;
  /** Accessible name; the square shows only the icon. */
  label: string;
  tone?: "tonal" | "filled";
};

/** 52 px square icon action (kit.css `.sq`), e.g. "Table actions" beside the main button. */
export function SquareAction({ icon, label, tone = "tonal", disabled, onClick, type = "button", demo }: SquareActionProps) {
  const t = ICON_TONE[tone];
  return (
    <button
      type={type}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex h-kit-square w-kit-square flex-none items-center justify-center rounded-kit-control",
        disabled ? "bg-kit-neutral-t text-kit-muted cursor-not-allowed" : demo === "pressed" ? t.pressed : t.idle,
        FOCUS,
        focusLook(demo),
        MOTION,
        TAP,
      ].join(" ")}
    >
      <KitIcon name={icon} />
    </button>
  );
}

export type RoundActionProps = Base & {
  icon: OperationalIconName;
  /** Accessible name. Shown under the circle when `showLabel` is set (kit.css `.ra`). */
  label: string;
  showLabel?: boolean;
  /** 48 by default, 44 for header bands, steppers and switchers. */
  size?: "regular" | "small";
  tone?: IconActionTone;
};

/** Round icon action, 48 or 44 px; with a word under it when `showLabel`. */
export function RoundAction({ icon, label, showLabel = false, size = "regular", tone = "tonal", disabled, onClick, type = "button", demo }: RoundActionProps) {
  const t = ICON_TONE[tone];
  const circle = [
    "flex flex-none items-center justify-center rounded-kit-full",
    size === "regular" ? "h-kit-round w-kit-round" : "h-kit-round-sm w-kit-round-sm",
    disabled ? "bg-kit-neutral-t text-kit-muted" : demo === "pressed" ? t.pressed : t.idle,
    MOTION,
  ].join(" ");
  if (showLabel) {
    return (
      <button
        type={type}
        disabled={disabled}
        onClick={onClick}
        className={[
          "flex w-kit-round-label-w flex-col items-center gap-kit-6 rounded-kit-control text-center text-kit-round-label text-kit-text",
          disabled ? "cursor-not-allowed text-kit-muted" : "",
          FOCUS,
          focusLook(demo),
          TAP,
        ].join(" ")}
      >
        <span className={circle}>
          <KitIcon name={icon} />
        </span>
        {label}
      </button>
    );
  }
  return (
    <button
      type={type}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={[circle, disabled ? "cursor-not-allowed" : "", FOCUS, focusLook(demo), TAP].join(" ")}
    >
      <KitIcon name={icon} />
    </button>
  );
}
