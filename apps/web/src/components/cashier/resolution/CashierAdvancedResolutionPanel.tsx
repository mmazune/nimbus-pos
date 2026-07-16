import { CaretDown, Wrench } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui";
import type { CashierOrderViewModel } from "@/lib/cashier/order-types";
import { isSafeTargetOrder } from "@/lib/cashier/resolution-validation";

import { CashierMergeOrdersPanel } from "./CashierMergeOrdersPanel";
import { CashierMoveItemsPanel } from "./CashierMoveItemsPanel";
import { CashierTransferServerPanel } from "./CashierTransferServerPanel";
import { CashierTransferTablePanel } from "./CashierTransferTablePanel";

type CashierAdvancedResolutionPanelProps = {
  order: CashierOrderViewModel;
  targetOrders: CashierOrderViewModel[];
  disabledReasons: string[];
  onRefresh: () => Promise<void>;
};

export function CashierAdvancedResolutionPanel({
  order,
  targetOrders,
  disabledReasons,
  onRefresh,
}: CashierAdvancedResolutionPanelProps) {
  const [open, setOpen] = useState(false);
  const compatibleTargets = useMemo(
    () => targetOrders.filter((target) => isSafeTargetOrder(target, order.id)),
    [order.id, targetOrders],
  );

  return (
    <section className="rounded-lg bg-surface-muted p-4" aria-labelledby="cashier-advanced-resolution-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Wrench size={22} weight="bold" className="text-brand-navy-900" aria-hidden />
            <h4 id="cashier-advanced-resolution-title" className="font-bold text-text-primary">
              Advanced resolution
            </h4>
          </div>
          <p className="mt-1 text-sm font-medium text-text-secondary">
            Merge, move, and transfer actions are available only where backend-safe targets are loaded.
          </p>
        </div>
        <Button
          variant="secondary"
          size="compact"
          trailingIcon={
            <CaretDown
              size={16}
              weight="bold"
              className={open ? "rotate-180 transition-transform" : "transition-transform"}
              aria-hidden
            />
          }
          aria-expanded={open}
          aria-controls="cashier-advanced-resolution-content"
          onClick={() => setOpen((current) => !current)}
        >
          {open ? "Hide" : "Show"}
        </Button>
      </div>

      {open ? (
        <div id="cashier-advanced-resolution-content" className="mt-4 space-y-3">
          <CashierMergeOrdersPanel
            order={order}
            targetOrders={compatibleTargets}
            disabledReasons={disabledReasons}
            onRefresh={onRefresh}
          />
          <CashierMoveItemsPanel
            order={order}
            targetOrders={compatibleTargets}
            disabledReasons={disabledReasons}
            onRefresh={onRefresh}
          />
          <CashierTransferTablePanel order={order} disabledReasons={disabledReasons} onRefresh={onRefresh} />
          <CashierTransferServerPanel />
        </div>
      ) : null}
    </section>
  );
}
