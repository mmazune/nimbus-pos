import { useRouter } from "next/router";
import { KeyboardEvent, MutableRefObject, ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Generic click-to-open dropdown for the Manager top-nav module bar
 * (Track B1, D-MGRTOPNAV). Odoo's reference (`ai/ODOO_REFERENCE_RESEARCH.md`
 * §1.3) is the LAYOUT reference only — the interaction contract below (full
 * keyboard operation, focus return, route-change close) is our own, since the
 * roadmap explicitly requires it regardless of what Odoo itself does.
 *
 * Behaviour:
 * - click-to-open (not hover)
 * - `Escape` closes and returns focus to the trigger
 * - outside click closes
 * - a route change closes every open dropdown (never leaves one open on the
 *   next page)
 * - opening focuses the first `[role="menuitem"]` inside the panel; ArrowDown/
 *   ArrowUp/Home/End move focus among menu items; `Tab` closes the panel
 *   (native focus order continues, it does not trap focus)
 *
 * Reused for both the grouped menu dropdowns and the identity/logout menu —
 * `renderTrigger` gives full control of trigger markup (icon-only avatar vs.
 * a text label) while the open/close/keyboard mechanics live here once.
 */
export type OperationalTopNavDropdownRenderProps = {
  open: boolean;
  buttonProps: {
    ref: MutableRefObject<HTMLButtonElement | null>;
    id: string;
    onClick: () => void;
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
    "aria-haspopup": "menu";
    "aria-expanded": boolean;
    "aria-controls": string;
  };
};

type OperationalTopNavDropdownProps = {
  id: string;
  align?: "left" | "right";
  renderTrigger: (props: OperationalTopNavDropdownRenderProps) => ReactNode;
  children: (close: () => void) => ReactNode;
  panelClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function OperationalTopNavDropdown({
  align = "left",
  children,
  id,
  onOpenChange,
  open: openProp,
  panelClassName,
  renderTrigger,
}: OperationalTopNavDropdownProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const buttonId = `${id || reactId}-trigger`;
  const panelId = `${id || reactId}-panel`;

  const close = useCallback(() => setOpen(false), [setOpen]);

  useEffect(() => {
    if (!open) return;

    function onDocumentMouseDown(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) setOpen(false);
    }

    function onDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", onDocumentMouseDown);
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocumentMouseDown);
      document.removeEventListener("keydown", onDocumentKeyDown);
    };
  }, [open, setOpen]);

  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    first?.focus();
  }, [open]);

  useEffect(() => {
    function onRouteChangeStart() {
      setOpen(false);
    }
    router.events.on("routeChangeStart", onRouteChangeStart);
    return () => router.events.off("routeChangeStart", onRouteChangeStart);
  }, [router.events, setOpen]);

  function onPanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    if (!items.length) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(currentIndex + 1 + items.length) % items.length].focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(currentIndex - 1 + items.length) % items.length].focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0].focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1].focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {renderTrigger({
        open,
        buttonProps: {
          ref: buttonRef,
          id: buttonId,
          onClick: () => setOpen(!open),
          onKeyDown: (event) => {
            if (event.key === "ArrowDown" && !open) {
              event.preventDefault();
              setOpen(true);
            }
          },
          "aria-haspopup": "menu",
          "aria-expanded": open,
          "aria-controls": panelId,
        },
      })}
      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="menu"
          aria-labelledby={buttonId}
          onKeyDown={onPanelKeyDown}
          className={cn(
            "absolute z-50 mt-2 max-h-[70vh] w-72 overflow-y-auto rounded-md border border-border-subtle bg-surface p-2 text-text-primary shadow-panel focus-visible:outline-none",
            align === "right" ? "right-0" : "left-0",
            panelClassName,
          )}
        >
          {children(close)}
        </div>
      ) : null}
    </div>
  );
}
