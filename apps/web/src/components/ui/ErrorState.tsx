import { WarningCircle } from "@phosphor-icons/react";

import { Card } from "./Card";

type ErrorStateProps = {
  title?: string;
  description?: string;
};

export function ErrorState({
  title = "Could not load this view.",
  description = "Try again when the connection is stable.",
}: ErrorStateProps) {
  return (
    <Card className="max-w-xl bg-status-danger-surface text-status-danger">
      <div className="flex items-start gap-3">
        <WarningCircle size={24} aria-hidden />
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm">{description}</p>
        </div>
      </div>
    </Card>
  );
}
