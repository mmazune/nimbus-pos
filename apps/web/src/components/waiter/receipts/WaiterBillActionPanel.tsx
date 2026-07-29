import { Button, StatusMessage } from "@/components/ui";
import { WaiterReceiptStatusBadge } from "@/components/waiter/receipts/WaiterReceiptStatusBadge";

import type { WaiterBillStateViewModel } from "@/lib/waiter/receipt-model";

type WaiterBillActionPanelProps = {
  bill: WaiterBillStateViewModel;
  isRequesting: boolean;
  onRequestBill: () => void;
  onViewReceipt: () => void;
};

export function WaiterBillActionPanel({
  bill,
  isRequesting,
  onRequestBill,
  onViewReceipt,
}: WaiterBillActionPanelProps) {
  return (
    <section className="mt-5 rounded-lg bg-surface-muted p-4">
      <div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-text-primary">Bill</p>
            <WaiterReceiptStatusBadge tone={bill.tone}>{bill.label}</WaiterReceiptStatusBadge>
          </div>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{bill.description}</p>
        </div>
      </div>

      {bill.requestDisabledReason ? (
        <div className="mt-4">
          <StatusMessage tone="warning" title="Bill action blocked">
            {bill.requestDisabledReason}
          </StatusMessage>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          size="compact"
          disabled={!bill.canRequestBill || isRequesting}
          onClick={onRequestBill}
        >
          {isRequesting ? "Requesting" : "Request bill"}
        </Button>
        <Button
          size="compact"
          variant="secondary"
          disabled={!bill.canViewReceipt}
          onClick={onViewReceipt}
        >
          View bill or receipt
        </Button>
      </div>
    </section>
  );
}
