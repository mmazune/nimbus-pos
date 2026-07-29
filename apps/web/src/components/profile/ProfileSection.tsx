import type { ReactNode } from "react";

import { Card } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

type ProfileSectionProps = {
  id?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function ProfileSection({ id, title, description, action, children, className }: ProfileSectionProps) {
  const titleId = id ? `${id}-title` : undefined;

  return (
    <Card className={cn("min-w-0", className)} aria-labelledby={titleId}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
        <div className="min-w-0">
          <h2 id={titleId} className="text-xl font-bold tracking-tight text-text-primary">
            {title}
          </h2>
          {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </Card>
  );
}
