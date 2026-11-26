/**
 * Shared state classes for kit pieces. Every class here is a literal so
 * Tailwind can see it. `KitDemo` lets the /kit gallery force a look
 * (pressed, keyboard focus) that a static page cannot otherwise show; screens
 * never pass it.
 */
export type KitDemo = "pressed" | "focus";

/** Keyboard focus: a white ring then a link-blue ring (reads on white and navy). */
export const FOCUS = "outline-none focus-visible:shadow-kit-focus";
export const FOCUS_FORCED = "shadow-kit-focus";
export const MOTION = "transition-colors duration-kit-press ease-kit";
export const TAP = "select-none touch-manipulation";

export function focusLook(demo: KitDemo | undefined): string {
  return demo === "focus" ? FOCUS_FORCED : "";
}
