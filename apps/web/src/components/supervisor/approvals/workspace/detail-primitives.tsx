import type { ReactNode } from "react";

/** A titled section inside the detail panel. */
export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-normal text-text-muted">{title}</h3>
      <dl className="space-y-1.5">{children}</dl>
    </section>
  );
}

/** A single label/value row in a detail section. */
export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-sm text-text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium text-text-primary">{children}</dd>
    </div>
  );
}
