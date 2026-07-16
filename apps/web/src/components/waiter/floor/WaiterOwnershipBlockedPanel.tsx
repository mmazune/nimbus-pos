import { LockKey, Receipt, Users } from "@phosphor-icons/react";

import { Button, Card } from "@/components/ui";
import type { WaiterTableViewModel } from "@/lib/waiter/floor-model";

type WaiterOwnershipBlockedPanelProps = {
  table: WaiterTableViewModel;
  onClose: () => void;
};

export function WaiterOwnershipBlockedPanel({ table, onClose }: WaiterOwnershipBlockedPanelProps) {
  return (
    <Card className="bg-status-danger-surface text-text-primary">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-md bg-surface text-status-danger shadow-subtle">
          <LockKey size={24} weight="bold" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold tracking-normal text-text-primary">
            This table belongs to another waiter.
          </p>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            You can view the service state, but editable order actions stay blocked.
          </p>

          <div className="mt-5 grid gap-3 text-sm font-semibold text-text-secondary">
            <div className="flex items-center gap-2">
              <Users size={18} weight="bold" aria-hidden />
              <span>{table.assignedWaiterName || "Assigned waiter unavailable"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Receipt size={18} weight="bold" aria-hidden />
              <span>{table.orderNumber || "Order link unavailable"}</span>
            </div>
            <div className="rounded-md bg-surface px-3 py-2 text-text-primary shadow-subtle">
              {table.orderStatus || "Occupied"}
              {table.billState ? ` / ${table.billState}` : ""}
            </div>
          </div>

          <Button className="mt-5" variant="secondary" onClick={onClose}>
            Close panel
          </Button>
        </div>
      </div>
    </Card>
  );
}
