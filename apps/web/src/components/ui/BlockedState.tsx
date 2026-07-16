import { LockKey } from "@phosphor-icons/react";
import { ReactNode } from "react";

import { Card } from "./Card";

type BlockedStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function BlockedState({ title, description, action }: BlockedStateProps) {
  return (
    <Card className="max-w-xl bg-status-warning-surface text-text-primary">
      <div className="flex items-start gap-3">
        <span className="text-status-warning">
          <LockKey size={24} aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
          {action ? <div className="mt-5">{action}</div> : null}
        </div>
      </div>
    </Card>
  );
}
