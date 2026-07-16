import { ReactNode } from "react";

import { Card } from "@/components/ui";

type SupervisorEmptyStateProps = {
  title: string;
  description: string;
  note?: string;
  icon?: ReactNode;
};

export function SupervisorEmptyState({ description, icon, note, title }: SupervisorEmptyStateProps) {
  return (
    <Card className="max-w-3xl">
      <div className="flex items-start gap-4">
        {icon ? (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-surface-muted text-brand-navy-900">
            {icon}
          </div>
        ) : null}
        <div>
          <h2 className="text-xl font-bold tracking-normal text-text-primary">{title}</h2>
          <p className="mt-2 text-base text-text-secondary">{description}</p>
          {note ? (
            <p className="mt-4 rounded-md bg-status-info-surface p-3 text-sm font-semibold text-status-info">
              {note}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

