import type { OperationalIconName } from "@/components/pos-shell/role-icons";

import { KitIcon } from "./KitIcon";
import { FOCUS, MOTION, TAP, focusLook, type KitDemo } from "./states";

export type ActionTileProps = {
  icon: OperationalIconName;
  title: string;
  /** What it does, in one line: "To a free table, the order goes with it". */
  line?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  demo?: KitDemo;
};

/** A 72 px action in a sheet's grid (Supervisor-Table): icon, a title, one line. */
export function ActionTile({ icon, title, line, danger = false, disabled, onClick, demo }: ActionTileProps) {
  const ground = disabled
    ? "bg-kit-neutral-t text-kit-muted cursor-not-allowed"
    : danger
      ? demo === "pressed"
        ? "bg-kit-tonal-2 text-kit-red"
        : "bg-kit-red-t text-kit-red active:bg-kit-tonal-2"
      : demo === "pressed"
        ? "bg-kit-tonal-2 text-kit-primary"
        : "bg-kit-tonal text-kit-primary active:bg-kit-tonal-2";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "flex h-kit-action min-w-0 items-center gap-kit-12 rounded-kit-control px-kit-16 text-left font-kit",
        ground,
        FOCUS,
        focusLook(demo),
        MOTION,
        TAP,
      ].join(" ")}
    >
      <KitIcon name={icon} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-kit-action">{title}</span>
        {line ? <span className={["text-kit-small", danger ? "text-kit-red" : "text-kit-muted"].join(" ")}>{line}</span> : null}
      </span>
    </button>
  );
}
