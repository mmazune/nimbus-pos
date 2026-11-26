import type { ReactNode } from "react";

export type CardProps = {
  /** Phone and terminal radius 20; laptop 16. */
  size?: "touch" | "laptop";
  padding?: "none" | "regular" | "roomy";
  /** Accessible name when the card is a region. */
  label?: string;
  children: ReactNode;
};

/** White carved card on the canvas: one soft two-layer shadow, no outline. Never inside another card. */
export function Card({ size = "touch", padding = "none", label, children }: CardProps) {
  return (
    <section
      aria-label={label}
      className={[
        "bg-kit-card shadow-kit-raised",
        size === "touch" ? "rounded-kit-card" : "rounded-kit-card-lg",
        padding === "regular" ? "p-kit-16" : padding === "roomy" ? "p-kit-20" : "",
      ].join(" ")}
    >
      {children}
    </section>
  );
}
