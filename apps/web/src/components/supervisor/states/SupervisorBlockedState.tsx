import { LockKey } from "@phosphor-icons/react";
import { ReactNode } from "react";

import { Card } from "@/components/ui";

type SupervisorBlockedStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function SupervisorBlockedState({ action, description, title }: SupervisorBlockedStateProps) {
  return (
    <Card className="max-w-3xl bg-status-warning-surface">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-surface text-status-warning">
          <LockKey size={24} weight="bold" aria-hidden />
        </span>
        <div>
          <h2 className="text-xl font-bold tracking-normal text-text-primary">{title}</h2>
          <p className="mt-2 text-base text-text-secondary">{description}</p>
          {action ? <div className="mt-5">{action}</div> : null}
        </div>
      </div>
    </Card>
  );
}

