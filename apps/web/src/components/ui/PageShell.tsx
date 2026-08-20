import { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type PageShellProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function PageShell({ title, subtitle, actions, children, className }: PageShellProps) {
  return (
    /* Density pass 2026-08-20: gap-6 -> gap-4, header min-h-16 -> min-h-11, title
       text-2xl -> text-xl, subtitle text-base -> text-sm. */
    <section className={cn("flex h-full flex-col gap-4", className)}>
      <header className="flex min-h-11 items-start justify-between gap-4">
        <div>
          <h1 className="text-balance text-xl font-bold tracking-normal text-text-primary">
            {title}
          </h1>
          {subtitle ? <p className="mt-0.5 max-w-2xl text-sm text-text-secondary">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}
