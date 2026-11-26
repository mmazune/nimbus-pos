import { RoundAction } from "./Button";
import { FOCUS, TAP, focusLook, type KitDemo } from "./states";

export type SwitcherProps = {
  /** The current one, e.g. the area name. */
  label: string;
  /** One short fact after it, e.g. "· 12 free". */
  detail?: string;
  onPrevious?: () => void;
  onNext?: () => void;
  /** Tapping the name lists them all. */
  onOpen?: () => void;
  previousLabel: string;
  nextLabel: string;
  demo?: KitDemo;
};

/** ‹ name › — one area, stage or column at a time; nothing scrolls sideways. */
export function Switcher({ label, detail, onPrevious, onNext, onOpen, previousLabel, nextLabel, demo }: SwitcherProps) {
  return (
    <div className="flex items-center gap-kit-8">
      <RoundAction icon="caretLeft" label={previousLabel} size="small" tone="card" onClick={onPrevious} disabled={!onPrevious} />
      <button
        type="button"
        onClick={onOpen}
        className={[
          "h-kit-target min-w-0 flex-1 rounded-kit-control text-center font-kit",
          demo === "pressed" ? "bg-kit-tonal" : "active:bg-kit-tonal",
          FOCUS,
          focusLook(demo),
          TAP,
        ].join(" ")}
      >
        <span className="text-kit-row text-kit-text">{label}</span>
        {detail ? <span className="text-kit-sup text-kit-muted"> {detail}</span> : null}
      </button>
      <RoundAction icon="caretRight" label={nextLabel} size="small" tone="card" onClick={onNext} disabled={!onNext} />
    </div>
  );
}
