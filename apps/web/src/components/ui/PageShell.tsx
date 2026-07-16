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
    <section className={cn("flex h-full flex-col gap-6", className)}>
      <header className="flex min-h-16 items-start justify-between gap-6">
        <div>
          <h1 className="text-balance text-2xl font-bold tracking-normal text-text-primary">
            {title}
          </h1>
          {subtitle ? <p className="mt-1 max-w-2xl text-base text-text-secondary">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}
