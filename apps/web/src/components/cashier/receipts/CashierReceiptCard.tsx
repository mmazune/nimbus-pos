import { ClockClockwise, Receipt } from "@phosphor-icons/react";

import { formatCashierDateTime, formatCashierMoney } from "@/lib/cashier/formatters";
import type { CashierReceiptViewModel } from "@/lib/cashier/receipt-types";

import { CashierReceiptStatusBadge } from "./CashierReceiptStatusBadge";

type CashierReceiptCardProps = {
  receipt: CashierReceiptViewModel;
  selected?: boolean;
  onSelect: (receiptId: string) => void;
};

export function CashierReceiptCard({ receipt, selected, onSelect }: CashierReceiptCardProps) {
  return (
    <button
      type="button"
      className={`w-full rounded-lg bg-surface p-4 text-left shadow-subtle transition-[background-color,box-shadow,transform] duration-150 ease-out hover:bg-brand-white active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy-900 ${
        selected ? "ring-2 ring-brand-navy-900" : ""
      }`}
      onClick={() => onSelect(receipt.id)}
      aria-label={`Open receipt ${receipt.receiptNumber}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Receipt size={20} weight="bold" className="text-brand-navy-900" aria-hidden />
            <p className="truncate text-lg font-bold tracking-normal text-text-primary">
              {receipt.receiptNumber}
            </p>
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-text-secondary">
            {receipt.tableName} | {receipt.serverName}
          </p>
        </div>
        <CashierReceiptStatusBadge label={receipt.receiptStatusLabel} tone={receipt.receiptStatusTone} />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="font-semibold text-text-muted">Total</dt>
          <dd className="mt-1 font-bold tabular-nums text-text-primary">
            {formatCashierMoney(receipt.total, receipt.currencyCode)}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-text-muted">Paid</dt>
          <dd className="mt-1 font-bold tabular-nums text-text-primary">
            {formatCashierMoney(receipt.paid, receipt.currencyCode, "Unavailable")}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-text-muted">Outstanding</dt>
          <dd className="mt-1 font-bold tabular-nums text-text-primary">
            {formatCashierMoney(receipt.outstanding, receipt.currencyCode, "Unavailable")}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center justify-between gap-3 text-xs font-semibold text-text-muted">
        <span className="flex min-w-0 items-center gap-1">
          <ClockClockwise size={16} weight="bold" aria-hidden />
          <span className="truncate">{formatCashierDateTime(receipt.openedAt, "Close time unavailable")}</span>
        </span>
        <span className="shrink-0 tabular-nums">
          {receipt.reprintCount} reprint | {receipt.sentCount} pending send
        </span>
      </div>
    </button>
  );
}
