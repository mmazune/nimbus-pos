import { Receipt } from "@phosphor-icons/react";

import { Badge } from "@/components/ui";
import { WaiterReceiptTotals } from "@/components/waiter/receipts/WaiterReceiptTotals";
import { formatReceiptMoney } from "@/lib/waiter/receipt-model";

import type { WaiterReceiptViewModel } from "@/lib/waiter/receipt-model";

type WaiterReceiptPreviewProps = {
  receipt: WaiterReceiptViewModel;
};

function formatDate(value: string | undefined) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function WaiterReceiptPreview({ receipt }: WaiterReceiptPreviewProps) {
  return (
    <article className="rounded-lg bg-surface p-5 shadow-subtle">
      <header className="text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-md bg-brand-navy-900 text-text-inverse">
          <Receipt size={22} weight="duotone" aria-hidden />
        </div>
        <p className="mt-3 text-lg font-bold tracking-normal text-text-primary">
          {receipt.organizationName}
        </p>
        <p className="text-sm font-medium text-text-secondary">{receipt.branchName}</p>
        <p className="mt-2 text-xs font-semibold tabular-nums text-text-muted">
          {formatDate(receipt.createdAt)}
        </p>
      </header>

      <div className="mt-5 grid gap-2 rounded-md bg-surface-muted p-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium text-text-secondary">Receipt</span>
          <span className="font-bold tabular-nums text-text-primary">{receipt.receiptNumber}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium text-text-secondary">Order</span>
          <span className="font-bold tabular-nums text-text-primary">{receipt.orderNumber}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium text-text-secondary">Table</span>
          <span className="font-bold text-text-primary">{receipt.tableName}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium text-text-secondary">Server</span>
          <span className="font-bold text-text-primary">{receipt.waiterName}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium text-text-secondary">Guest</span>
          <span className="font-bold text-text-primary">{receipt.guestName}</span>
        </div>
      </div>

      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-text-primary">Items</p>
          <Badge variant="neutral">{receipt.lines.length} lines</Badge>
        </div>
        {receipt.lines.length === 0 ? (
          <div className="rounded-md bg-surface-muted p-3 text-sm font-medium text-text-secondary">
            Receipt unavailable.
          </div>
        ) : (
          <div className="grid gap-3">
            {receipt.lines.map((line) => (
              <div key={line.id} className="grid grid-cols-[1fr_auto] gap-3 border-b border-border-subtle pb-3 last:border-b-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-bold text-text-primary">{line.name}</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Qty <span className="tabular-nums">{line.quantity}</span>
                    {line.serving ? ` / ${line.serving}` : ""}
                    {line.unitPrice !== undefined
                      ? ` / ${formatReceiptMoney(line.unitPrice, receipt.currencyCode)}`
                      : ""}
                  </p>
                  {line.modifierSummary ? (
                    <p className="mt-1 text-sm text-text-secondary">{line.modifierSummary}</p>
                  ) : null}
                  {line.notes ? (
                    <p className="mt-2 rounded-md bg-surface-muted px-2 py-1 text-sm text-text-secondary">
                      {line.notes}
                    </p>
                  ) : null}
                </div>
                <p className="font-bold tabular-nums text-text-primary">
                  {formatReceiptMoney(line.lineTotal, receipt.currencyCode, "Total unavailable")}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-5">
        <WaiterReceiptTotals receipt={receipt} />
      </div>

      {receipt.footer ? (
        <footer className="mt-5 border-t border-border-subtle pt-4 text-center text-sm text-text-secondary">
          {receipt.footer}
        </footer>
      ) : null}
    </article>
  );
}
