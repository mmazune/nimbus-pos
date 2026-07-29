import { WarningCircle } from "@phosphor-icons/react";

import { Button, Card } from "@/components/ui";

import type { OperationalFloorErrorCopy } from "./types";

export function OperationalFloorErrorState({
  error,
  onRetry,
}: {
  error: OperationalFloorErrorCopy;
  onRetry?: () => void;
}) {
  return (
    <Card className="max-w-xl bg-status-danger-surface text-status-danger" role="alert">
      <div className="flex items-start gap-3">
        <WarningCircle size={24} aria-hidden />
        <div>
          <h2 className="text-lg font-semibold">{error.title}</h2>
          <p className="mt-1 text-sm">{error.description}</p>
          {onRetry ? (
            <Button className="mt-5" variant="secondary" onClick={onRetry}>Retry</Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
