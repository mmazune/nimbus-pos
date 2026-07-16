import { Receipt } from "@phosphor-icons/react";
import { useMemo } from "react";

import { Badge } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { CashierOrderViewModel } from "@/lib/cashier/order-types";
import type { CashierReadinessSnapshot } from "@/lib/cashier/readiness";
import { cashierResolutionOrderReasons } from "@/lib/cashier/resolution-validation";

import { CashierAdvancedResolutionPanel } from "./CashierAdvancedResolutionPanel";
import { CashierResolutionBlockedBanner } from "./CashierResolutionBlockedBanner";
import { CashierSplitBillPanel } from "./CashierSplitBillPanel";
import { CashierSplitItemsPanel } from "./CashierSplitItemsPanel";

type CashierResolutionPanelProps = {
  order: CashierOrderViewModel;
  targetOrders: CashierOrderViewModel[];
  readiness: CashierReadinessSnapshot;
  detailBlocked?: boolean;
  paymentSummaryBlocked?: boolean;
  onRefresh: () => Promise<void>;
};

export function CashierResolutionPanel({
  order,
  targetOrders,
  readiness,
  detailBlocked,
  paymentSummaryBlocked,
  onRefresh,
}: CashierResolutionPanelProps) {
  const { accessToken, branchId, isCashier, isLoading, isAuthenticated } = useAuth();

  const disabledReasons = useMemo(() => {
    const reasons: string[] = [];

    if (isLoading) reasons.push("Session is still loading.");
    if (!isAuthenticated || !accessToken) reasons.push("Cashier session is missing.");
    if (!isCashier) reasons.push("Cashier access is required.");
    if (!branchId) reasons.push("Branch context is required.");
    if (detailBlocked) reasons.push("Order detail must load before split or resolution actions.");
    if (readiness.shift.status !== "active") reasons.push("No active shift. Resolution actions are blocked.");

    return reasons.concat(
      cashierResolutionOrderReasons({
        order,
        paymentSummaryBlocked,
      }),
    );
  }, [
    accessToken,
    branchId,
    detailBlocked,
    isAuthenticated,
    isCashier,
    isLoading,
    order,
    paymentSummaryBlocked,
    readiness.shift.status,
  ]);

  return (
    <section className="space-y-4" aria-labelledby="cashier-resolution-title">
      <div className="rounded-lg bg-surface p-4 shadow-subtle">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Receipt size={22} weight="bold" className="text-brand-navy-900" aria-hidden />
              <h3 id="cashier-resolution-title" className="font-bold text-text-primary">
                Split and resolve
              </h3>
            </div>
            <p className="mt-1 text-sm font-medium text-text-secondary">
              Operational split and handoff tools for the selected payable order.
            </p>
          </div>
          <Badge variant={disabledReasons.length ? "warning" : "success"}>
            {disabledReasons.length ? "Blocked" : "Ready"}
          </Badge>
        </div>

        <div className="mt-4">
          <CashierResolutionBlockedBanner reasons={disabledReasons} />
        </div>
      </div>

      <CashierSplitBillPanel order={order} disabledReasons={disabledReasons} onRefresh={onRefresh} />
      <CashierSplitItemsPanel order={order} disabledReasons={disabledReasons} onRefresh={onRefresh} />
      <CashierAdvancedResolutionPanel
        order={order}
        targetOrders={targetOrders}
        disabledReasons={disabledReasons}
        onRefresh={onRefresh}
      />
    </section>
  );
}
