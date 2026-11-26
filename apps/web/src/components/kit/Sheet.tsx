import { useEffect, type ReactNode } from "react";

import { RoundAction } from "./Button";
import { Text } from "./Text";

export type SheetPlacement = "bottom" | "middle" | "wide" | "side";

const PLACE: Record<SheetPlacement, string> = {
  // phone: rises from the bottom with 28 px top corners and a grab handle
  bottom: "inset-x-kit-0 bottom-kit-0 rounded-t-kit-sheet px-kit-20 pb-kit-24 pt-kit-10",
  // terminal: a centred 760 px sheet from the bottom
  middle: "bottom-kit-0 left-1/2 w-kit-sheet-mid -translate-x-1/2 rounded-t-kit-sheet px-kit-24 pb-kit-24 pt-kit-10",
  // terminal: over the menu, stopping short of the order column
  wide: "bottom-kit-0 left-kit-0 right-kit-sheet-wide-gap rounded-t-kit-sheet px-kit-24 pb-kit-24 pt-kit-10",
  // laptop: a 440 px side panel under the 60 px top bar
  side: "bottom-kit-0 right-kit-0 top-kit-app-bar w-kit-sheet-side rounded-tl-kit-sheet px-kit-24 pb-kit-24 pt-kit-20",
};

export type SheetProps = {
  placement: SheetPlacement;
  title: string;
  /** One short line under the title. */
  summary?: string;
  onClose: () => void;
  /** The one filled button and a text Cancel, at the foot. */
  footer?: ReactNode;
  children?: ReactNode;
};

/**
 * A sheet over a flat dim (no blur). Positioned against the nearest positioned
 * ancestor — the screen frame. Escape closes it. Never a sheet from a sheet.
 */
export function Sheet({ placement, title, summary, onClose, footer, children }: SheetProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="absolute inset-kit-0 bg-kit-scrim" aria-hidden="true" onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={["absolute flex max-h-kit-sheet-max flex-col gap-kit-16 bg-kit-card shadow-kit-up font-kit", PLACE[placement]].join(" ")}
      >
        {placement === "side" ? null : (
          <span className="h-kit-grab-h w-kit-grab-w self-center rounded-kit-grab bg-kit-line" aria-hidden="true" />
        )}
        <div className="flex items-center gap-kit-12">
          <div className="min-w-0 flex-1">
            <Text variant="h" as="h2">
              {title}
            </Text>
            {summary ? (
              <Text variant="sup" tone="muted">
                {summary}
              </Text>
            ) : null}
          </div>
          <RoundAction icon="close" label="Close" size="small" tone="field" onClick={onClose} />
        </div>
        {/* A long sheet scrolls its body; the title and the footer stay in view. */}
        {children ? <div className="flex min-h-kit-0 flex-1 flex-col gap-kit-16 overflow-y-auto">{children}</div> : null}
        {footer ? <div className="flex flex-none items-center gap-kit-12">{footer}</div> : null}
      </section>
    </>
  );
}
