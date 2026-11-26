import type { ReactNode } from "react";

import { FOCUS, MOTION, TAP, focusLook, type KitDemo } from "./states";

export type RowProps = {
  title: string;
  line?: string;
  /** Initials in a 40 px circle. */
  initials?: string;
  /** One thing on the right: a pill, a value, a round action. */
  trailing?: ReactNode;
  /** 64 by default; 56 in settings. */
  size?: "regular" | "settings";
  onClick?: () => void;
  disabled?: boolean;
  demo?: KitDemo;
};

/** A list row. Put rows in a `RowGroup` inside one card; dividers come from the group. */
export function Row({ title, line, initials, trailing, size = "regular", onClick, disabled, demo }: RowProps) {
  const body = (
    <>
      {initials ? (
        <span className="flex h-kit-avatar w-kit-avatar flex-none items-center justify-center rounded-kit-full bg-kit-tonal text-kit-avatar text-kit-primary">
          {initials}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-kit-body font-kit-bold text-kit-text">{title}</span>
        {line ? <span className="text-kit-sup text-kit-muted">{line}</span> : null}
      </span>
      {trailing}
    </>
  );
  const shape = [
    "flex w-full items-center gap-kit-12 px-kit-16 py-kit-10 text-left font-kit",
    size === "regular" ? "min-h-kit-row" : "min-h-kit-row-s",
  ].join(" ");
  if (!onClick && !disabled) return <div className={shape}>{body}</div>;
  return (
    <button
      type="button"
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
