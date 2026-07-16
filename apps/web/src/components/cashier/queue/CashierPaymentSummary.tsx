import { CreditCard, DeviceMobile, Money, Wallet, WarningCircle } from "@phosphor-icons/react";

import { Badge, Button, Skeleton } from "@/components/ui";
import { formatCashierDateTime, formatCashierMoney, titleCaseCashier } from "@/lib/cashier/formatters";
import type { CashierOrderViewModel, CashierPaymentApi, CashierPaymentIntentApi } from "@/lib/cashier/order-types";

type CashierPaymentSummaryProps = {
  order: CashierOrderViewModel;
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
};

function paymentIcon(method?: string | null) {
  const normalized = String(method || "").toUpperCase();
  if (normalized.includes("CASH")) return Money;
  if (normalized.includes("MOBILE") || normalized.includes("PHONE")) return DeviceMobile;
  if (normalized.includes("CARD")) return CreditCard;
  return Wallet;
}

function PaymentRow({ payment, currencyCode }: { payment: CashierPaymentApi; currencyCode?: string }) {
  const Icon = paymentIcon(payment.method);

  return (
    <div className="rounded-md bg-surface-muted p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface text-text-secondary">
            <Icon size={20} weight="bold" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-text-primary">{titleCaseCashier(payment.method, "Payment")}</p>
            <p className="mt-1 text-xs font-medium text-text-secondary">
              {payment.transactionId || payment.externalTransactionId || "Reference unavailable"}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold tabular-nums text-text-primary">
            {formatCashierMoney(payment.amount, currencyCode)}
          </p>
          <p className="mt-1 text-xs font-medium text-text-secondary">
            {formatCashierDateTime(payment.postedAt || payment.createdAt, "Time unavailable")}
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

function IntentRow({ intent, currencyCode }: { intent: CashierPaymentIntentApi; currencyCode?: string }) {
  return (
    <div className="rounded-md bg-status-info-surface p-3 text-status-info">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{titleCaseCashier(intent.provider, "Provider intent")}</p>
          <p className="mt-1 text-xs font-medium">{intent.providerRef || intent.customerPhone || "Reference pending"}</p>
        </div>
        <p className="font-bold tabular-nums">{formatCashierMoney(intent.amount, intent.currency || currencyCode)}</p>
      </div>
      <Badge className="mt-3" variant="info">
        {titleCaseCashier(intent.status, "Intent pending")}
      </Badge>
    </div>
  );
}

export function CashierPaymentSummary({ order, isLoading, error, onRetry }: CashierPaymentSummaryProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-status-warning-surface p-4 text-status-warning" role="status">
        <div className="flex items-start gap-3">
          <WarningCircle size={22} weight="bold" aria-hidden />
          <div>
            <p className="font-semibold">Could not load payment summary. Retry before checkout.</p>
            <p className="mt-1 text-sm">{error}</p>
            {onRetry ? (
              <Button className="mt-3" variant="secondary" size="compact" onClick={onRetry}>
                Retry payment summary
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const payments = order.payment.payments;
  const intents = order.payment.intents;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-text-secondary">Payment state</p>
        <Badge variant={order.payment.tone}>{order.payment.label}</Badge>
      </div>
      {payments.length === 0 && intents.length === 0 ? (
        <p className="rounded-md bg-surface-muted p-3 text-sm font-medium text-text-secondary">
          No posted payments or provider intents are attached to this order yet.
        </p>
      ) : null}
      {payments.map((payment) => (
        <PaymentRow key={payment.id} payment={payment} currencyCode={order.currencyCode} />
      ))}
      {intents.map((intent) => (
        <IntentRow key={intent.id} intent={intent} currencyCode={order.currencyCode} />
      ))}
    </div>
  );
}
