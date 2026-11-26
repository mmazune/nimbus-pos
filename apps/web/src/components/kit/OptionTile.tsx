import type { OperationalIconName } from "@/components/pos-shell/role-icons";

import { KitIcon } from "./KitIcon";
import { FOCUS, MOTION, TAP, focusLook, type KitDemo } from "./states";

export type OptionTileProps = {
  label: string;
  /** 64 px tile: a second line under the word. */
  second?: string;
  /** 96 px tile: an icon over the word (and an optional second line). */
  icon?: OperationalIconName;
  current?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  demo?: KitDemo;
};

/** A short choice in a grid: 48 plain, 64 with a second line, 96 with an icon. The chosen one filled navy. */
export function OptionTile({ label, second, icon, current = false, disabled, onClick, demo }: OptionTileProps) {
  const height = icon ? "h-kit-option-xl gap-kit-4" : second ? "h-kit-option-tall" : "h-kit-option gap-kit-6";
  const type = icon ? "text-kit-action" : "text-kit-option";
  return (
    <button
      type="button"
      aria-pressed={current}
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex min-w-0 items-center justify-center rounded-kit-seg px-kit-8 text-center font-kit",
        icon || second ? "flex-col" : "whitespace-nowrap",
        height,
        type,
        disabled
          ? "bg-kit-neutral-t text-kit-muted cursor-not-allowed"
          : current
            ? "bg-kit-primary text-kit-on-primary font-kit-bold"
            : demo === "pressed"
              ? "bg-kit-tonal-2 text-kit-primary"
              : "bg-kit-tonal text-kit-primary active:bg-kit-tonal-2",
        FOCUS,
        focusLook(demo),
        MOTION,
        TAP,
      ].join(" ")}
    >
      {icon ? <KitIcon name={icon} size="bar" current={current} /> : null}
      <span>{label}</span>
      {second ? <span className="text-kit-small font-kit-regular opacity-kit-second-line">{second}</span> : null}
    </button>
  );
}
