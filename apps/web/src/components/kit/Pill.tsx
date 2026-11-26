export type PillTone = "green" | "amber" | "red" | "neutral" | "brand";

const TONE: Record<PillTone, string> = {
  green: "bg-kit-green-t text-kit-green",
  amber: "bg-kit-amber-t text-kit-amber",
  red: "bg-kit-red-t text-kit-red",
  neutral: "bg-kit-neutral-t text-kit-muted",
  brand: "bg-kit-tonal text-kit-primary",
};

/** A 24 px status pill: always a word, on a tint. Red, amber and green mean a state and nothing else. */
export function Pill({ tone, children }: { tone: PillTone; children: string }) {
  return (
    <span
      className={[
        "inline-flex h-kit-pill flex-none items-center whitespace-nowrap rounded-kit-badge px-kit-10 text-kit-pill font-kit",
        TONE[tone],
      ].join(" ")}
    >
      {children}
    </span>
  );
}
