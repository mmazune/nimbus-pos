import { formatCashierDateTime } from "@/lib/cashier/formatters";
import type { CashierReceiptViewModel } from "@/lib/cashier/receipt-types";

import { CashierReceiptCaveatBanner } from "./CashierReceiptCaveatBanner";
import { CashierReceiptLineItems } from "./CashierReceiptLineItems";
import { CashierReceiptPaymentSummary } from "./CashierReceiptPaymentSummary";
import { CashierReceiptTotals } from "./CashierReceiptTotals";

type CashierReceiptDetailProps = {
  receipt: CashierReceiptViewModel;
};

export function CashierReceiptDetail({ receipt }: CashierReceiptDetailProps) {
  return (
    <div className="grid gap-4">
      <section className="rounded-lg bg-surface p-4 shadow-subtle" aria-labelledby="cashier-receipt-identity-title">
        <h3 id="cashier-receipt-identity-title" className="font-bold text-text-primary">
          Receipt Identity
        </h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="font-semibold text-text-muted">Order</dt>
            <dd className="mt-1 font-bold tabular-nums text-text-primary">{receipt.orderNumber}</dd>
          </div>
          <div>
            <dt className="font-semibold text-text-muted">Receipt ID</dt>
            <dd className="mt-1 truncate font-bold tabular-nums text-text-primary">{receipt.id}</dd>
          </div>
          <div>
            <dt className="font-semibold text-text-muted">Branch</dt>
            <dd className="mt-1 font-bold text-text-primary">{receipt.branchName}</dd>
          </div>
          <div>
            <dt className="font-semibold text-text-muted">Organization</dt>
            <dd className="mt-1 font-bold text-text-primary">{receipt.organizationName}</dd>
          </div>
          <div>
            <dt className="font-semibold text-text-muted">Table</dt>
            <dd className="mt-1 font-bold text-text-primary">{receipt.tableName}</dd>
          </div>
          <div>
            <dt className="font-semibold text-text-muted">Server</dt>
            <dd className="mt-1 font-bold text-text-primary">{receipt.serverName}</dd>
          </div>
          <div>
            <dt className="font-semibold text-text-muted">Cashier</dt>
            <dd className="mt-1 font-bold text-text-primary">{receipt.cashierName}</dd>
          </div>
          <div>
            <dt className="font-semibold text-text-muted">Opened</dt>
            <dd className="mt-1 font-bold tabular-nums text-text-primary">
              {formatCashierDateTime(receipt.openedAt)}
            </dd>
          </div>
        </dl>
      </section>

      <CashierReceiptLineItems receipt={receipt} />
      <CashierReceiptTotals receipt={receipt} />
      <CashierReceiptPaymentSummary receipt={receipt} />

      {receipt.footer ? (
        <section className="rounded-lg bg-surface p-4 shadow-subtle" aria-labelledby="cashier-receipt-footer-title">
          <h3 id="cashier-receipt-footer-title" className="font-bold text-text-primary">
            Footer
          </h3>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{receipt.footer}</p>
        </section>
      ) : null}

      <div className="grid gap-3">
        <CashierReceiptCaveatBanner type="print" />
        <CashierReceiptCaveatBanner type="send" />
      </div>
    </div>
  );
}
