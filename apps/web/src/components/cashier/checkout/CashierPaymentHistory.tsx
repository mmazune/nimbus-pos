import { CreditCard, DeviceMobile, Money, Wallet } from "@phosphor-icons/react";

import { Badge } from "@/components/ui";
import { formatCashierDateTime, formatCashierMoney, titleCaseCashier } from "@/lib/cashier/formatters";
import type { CashierOrderViewModel, CashierPaymentApi, CashierPaymentIntentApi } from "@/lib/cashier/order-types";

function iconForMethod(method?: string | null) {
  const normalized = String(method || "").toUpperCase();
  if (normalized === "CASH") return Money;
  if (normalized === "CARD") return CreditCard;
  if (normalized === "MOMO") return DeviceMobile;
  return Wallet;
}

function PaymentHistoryRow({ payment, currencyCode }: { payment: CashierPaymentApi; currencyCode?: string }) {
  const Icon = iconForMethod(payment.method);
  return (
    <div className="rounded-md bg-surface-muted p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface text-text-secondary">
            <Icon size={20} weight="bold" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-text-primary">{titleCaseCashier(payment.method, "Payment")}</p>
            <p className="mt-1 truncate text-xs font-medium text-text-secondary">
              {payment.externalTransactionId || payment.transactionId || "Reference unavailable"}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-bold tabular-nums text-text-primary">
            {formatCashierMoney(payment.amount, currencyCode)}
          </p>
          <p className="mt-1 text-xs font-medium text-text-secondary">
            {formatCashierDateTime(payment.postedAt || payment.createdAt)}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="neutral">{titleCaseCashier(payment.status, "Status unavailable")}</Badge>
        {payment.verificationStatus ? <Badge variant="info">{titleCaseCashier(payment.verificationStatus)}</Badge> : null}
      </div>
    </div>
  );
}

function IntentHistoryRow({ intent, currencyCode }: { intent: CashierPaymentIntentApi; currencyCode?: string }) {
  return (
    <div className="rounded-md bg-status-warning-surface p-3 text-status-warning">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{titleCaseCashier(intent.provider, "Provider intent")}</p>
          <p className="mt-1 truncate text-xs font-medium">
            {intent.providerRef || intent.customerPhone || "Provider reference pending"}
          </p>
        </div>
        <p className="font-bold tabular-nums">
          {formatCashierMoney(intent.amount, intent.currency || currencyCode)}
        </p>
      </div>
      <Badge className="mt-3" variant="warning">
        {titleCaseCashier(intent.status, "Pending")}
      </Badge>
    </div>
  );
}

export function CashierPaymentHistory({ order }: { order: CashierOrderViewModel }) {
  const payments = order.payment.payments;
  const intents = order.payment.intents;

  if (!payments.length && !intents.length) {
    return (
      <p className="rounded-md bg-surface-muted p-3 text-sm font-medium text-text-secondary">
        No posted payments or provider intents are attached to this order yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {payments.map((payment) => (
        <PaymentHistoryRow key={payment.id} payment={payment} currencyCode={order.currencyCode} />
      ))}
      {intents.map((intent) => (
        <IntentHistoryRow key={intent.id} intent={intent} currencyCode={order.currencyCode} />
      ))}
    </div>
  );
}
