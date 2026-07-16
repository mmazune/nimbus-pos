import { ReactNode } from "react";

import { Card } from "./Card";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <Card className="flex max-w-xl items-start gap-4">
      {icon ? <div className="mt-1 text-text-muted">{icon}</div> : null}
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </Card>
  );
}
