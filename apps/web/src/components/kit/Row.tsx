import type { ReactNode } from "react";

import type { OperationalIconName } from "@/components/pos-shell/role-icons";

import { KitIcon } from "./KitIcon";
import { FOCUS, MOTION, TAP, focusLook, type KitDemo } from "./states";

export type RowProps = {
  title: string;
  line?: string;
  /** Initials in a 40 px circle. */
  initials?: string;
  /** One thing on the right: a pill, a value, a round action. */
  trailing?: ReactNode;
  /** An icon in a 40 px tonal circle in front (Supervisor-Approvals). */
  icon?: OperationalIconName;
  /** A time or short word in front, set large (Reservations: "19:30"). */
  leading?: string;
  /** A › at the end: the row opens something. */
  chevron?: boolean;
  /** The row that is open in the side panel. */
  current?: boolean;
  /** 64 by default; 56 in settings; 76 for a list with a leading time. */
  size?: "regular" | "settings" | "tall";
  onClick?: () => void;
  disabled?: boolean;
  demo?: KitDemo;
};

/**
 * A list row. The tall row (76) and the leading column (76) reuse the two 76 px
 * tokens that exist (bottom-bar, round-label-w) rather than add new ones.
 * Put rows in a `RowGroup` inside one card; dividers come from the group. */
export function Row({ title, line, initials, icon, leading, chevron = false, current = false, trailing, size = "regular", onClick, disabled, demo }: RowProps) {
  const body = (
    <>
      {icon ? (
        <span className="flex h-kit-avatar w-kit-avatar flex-none items-center justify-center rounded-kit-full bg-kit-tonal text-kit-primary">
          <KitIcon name={icon} />
        </span>
      ) : null}
      {leading ? <span className="w-kit-round-label-w flex-none text-kit-h text-kit-text">{leading}</span> : null}
      {initials ? (
        <span className="flex h-kit-avatar w-kit-avatar flex-none items-center justify-center rounded-kit-full bg-kit-tonal text-kit-avatar text-kit-primary">
          {initials}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col">
        {/* tall rows (Reservations, Approvals) title at the 17 px row style, as drawn */}
        <span className={["break-words font-kit-bold text-kit-text", size === "tall" ? "text-kit-row" : "text-kit-body"].join(" ")}>{title}</span>
        {line ? <span className="break-words text-kit-sup text-kit-muted">{line}</span> : null}
      </span>
      {trailing}
      {chevron ? (
        <span className="flex-none text-kit-text">
          <KitIcon name="caretRight" />
        </span>
      ) : null}
    </>
  );
  const shape = [
    "flex w-full items-center gap-kit-12 px-kit-16 py-kit-10 text-left font-kit",
    size === "regular" ? "min-h-kit-row" : size === "tall" ? "min-h-kit-bottom-bar" : "min-h-kit-row-s",
    current ? "bg-kit-canvas" : "",
  ].join(" ");
  if (!onClick && !disabled) return <div className={shape}>{body}</div>;
  return (
    <button
      type="button"
      aria-current={current ? "true" : undefined}
      onClick={onClick}
      disabled={disabled}
      className={[
        shape,
        disabled ? "cursor-not-allowed opacity-kit-second-line" : demo === "pressed" ? "bg-kit-canvas" : "active:bg-kit-canvas",
        FOCUS,
        focusLook(demo),
        MOTION,
        TAP,
      ].join(" ")}
    >
      {body}
    </button>
  );
}

/** Rows stacked with a hair line between them. */
export function RowGroup({ children }: { children: ReactNode }) {
  return <div className="flex flex-col divide-y divide-kit-line">{children}</div>;
}
