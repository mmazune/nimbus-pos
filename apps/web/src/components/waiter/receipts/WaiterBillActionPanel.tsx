import { Receipt, ReceiptX } from "@phosphor-icons/react";

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
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-text-primary">Bill</p>
            <WaiterReceiptStatusBadge tone={bill.tone}>{bill.label}</WaiterReceiptStatusBadge>
          </div>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{bill.description}</p>
        </div>
        <span className="text-text-muted">
          <Receipt size={22} weight="duotone" aria-hidden />
        </span>
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
          leadingIcon={<Receipt size={18} weight="bold" aria-hidden />}
          onClick={onRequestBill}
        >
          {isRequesting ? "Requesting" : "Request bill"}
        </Button>
        <Button
          size="compact"
          variant="secondary"
          disabled={!bill.canViewReceipt}
          leadingIcon={<ReceiptX size={18} weight="bold" aria-hidden />}
          onClick={onViewReceipt}
        >
          View receipt
        </Button>
      </div>
    </section>
  );
}
