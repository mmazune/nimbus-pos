import { WarningDiamond } from "@phosphor-icons/react";

import { formatCashierMoney } from "@/lib/cashier/formatters";
import { CASHIER_REFUND_AUTO_APPROVAL_THRESHOLD } from "@/lib/cashier/refund-types";

type CashierRefundThresholdNoticeProps = {
  amount?: number;
  currencyCode?: string | null;
};

export function CashierRefundThresholdNotice({
  amount,
  currencyCode = "UGX",
}: CashierRefundThresholdNoticeProps) {
  const overThreshold =
    typeof amount === "number" && amount > CASHIER_REFUND_AUTO_APPROVAL_THRESHOLD;

  return (
    <div
      className={
        overThreshold
          ? "rounded-md bg-status-warning-surface p-3 text-status-warning"
          : "rounded-md bg-status-info-surface p-3 text-status-info"
      }
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <WarningDiamond size={20} weight="bold" className="shrink-0" aria-hidden />
        <div className="text-sm font-semibold leading-6">
          <p>
            Auto-approval threshold:{" "}
            {formatCashierMoney(CASHIER_REFUND_AUTO_APPROVAL_THRESHOLD, currencyCode)}
            .
          </p>
          <p>
            {overThreshold
              ? "Refund exceeds cashier auto-approval threshold. It will require manager approval."
              : "Refund is within cashier auto-approval threshold."}
          </p>
        </div>
      </div>
    </div>
  );
}
