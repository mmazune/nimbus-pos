import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type ProfileMetaItem = {
  label: string;
  value: ReactNode;
};

export function ProfileMetaGrid({ items, className }: { items: ProfileMetaItem[]; className?: string }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-5 sm:grid-cols-2", className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0 border-t border-border-subtle pt-3 first:border-t-0 first:pt-0 sm:[&:nth-child(2)]:border-t-0 sm:[&:nth-child(2)]:pt-0">
          <dt className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">{item.label}</dt>
          <dd className="mt-1 min-w-0 break-words text-sm font-semibold text-text-primary">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

