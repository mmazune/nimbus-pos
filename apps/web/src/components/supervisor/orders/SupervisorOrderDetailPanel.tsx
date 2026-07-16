import {
  ArrowsLeftRight,
  CurrencyCircleDollar,
  ForkKnife,
  GitMerge,
  Percent,
  Receipt,
  SplitHorizontal,
  WarningCircle,
  X,
} from "@phosphor-icons/react";

import { Badge, Button, Card, StatusMessage } from "@/components/ui";
import {
  formatSupervisorDateTime,
  formatSupervisorMoney,
  getPaymentState,
  getSupervisorOrderExceptionTags,
  getSupervisorOrderLabel,
  getSupervisorOrderStatusLabel,
  getSupervisorTableLabel,
  getSupervisorUserName,
  type SupervisorOrderDetail,
  type SupervisorOrderListItem,
  type SupervisorOrderPayments,
  type SupervisorPaginatedDiscounts,
  type SupervisorRefund,
} from "@/lib/supervisor/orders";

type SupervisorOrderDetailPanelProps = {
  order: SupervisorOrderListItem | null;
  detail?: SupervisorOrderDetail | null;
  payments?: SupervisorOrderPayments | null;
  refunds?: SupervisorRefund[] | null;
  discounts?: SupervisorPaginatedDiscounts | null;
  isLoading?: boolean;
  paymentsError?: string | null;
  refundsError?: string | null;
  discountsError?: string | null;
  onClose: () => void;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md bg-surface-muted px-3 py-2 text-sm">
      <dt className="font-semibold text-text-secondary">{label}</dt>
      <dd className="min-w-0 truncate font-bold text-text-primary" title={value}>
        {value}
      </dd>
    </div>
  );
}

function ActionTile({
  description,
  icon: Icon,
  label,
}: {
  description: string;
  icon: typeof ArrowsLeftRight;
  label: string;
}) {
  return (
    <div className="rounded-lg bg-surface-muted p-3">
      <div className="flex items-center gap-2">
        <Icon size={20} weight="bold" className="text-text-secondary" aria-hidden />
        <p className="font-bold text-text-primary">{label}</p>
      </div>
      <p className="mt-1 text-sm leading-6 text-text-secondary">{description}</p>
      <Button className="mt-3 w-full" variant="secondary" size="compact" disabled>
        Deferred
      </Button>
    </div>
  );
}

export function SupervisorOrderDetailPanel({
  detail,
  discounts,
  discountsError,
  isLoading,
  onClose,
  order,
  payments,
  paymentsError,
  refunds,
  refundsError,
}: SupervisorOrderDetailPanelProps) {
  const activeOrder = detail || order;

  if (!activeOrder) {
    return (
      <Card className="min-h-[620px] bg-surface-muted">
        <p className="text-lg font-bold tracking-normal text-text-primary">Select an order</p>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          Order identity, payment state, refund history, discounts, and unavailable exception actions appear here.
        </p>
      </Card>
    );
  }

  const paymentState = getPaymentState(payments);
  const exceptionTags = getSupervisorOrderExceptionTags({
    discounts,
    order: activeOrder,
    payments,
    refunds,
  });
  const items = detail?.items || [];
  const label = getSupervisorOrderLabel(activeOrder);

  return (
    <Card className="min-h-[620px]" aria-labelledby="supervisor-order-detail-title">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            <h2
              id="supervisor-order-detail-title"
              className="truncate text-xl font-bold tracking-normal text-text-primary"
              title={label}
            >
              {label}
            </h2>
            <Badge variant={activeOrder.status === "VOIDED" ? "danger" : "info"}>
              {getSupervisorOrderStatusLabel(activeOrder.status)}
            </Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            {isLoading ? "Refreshing order detail..." : "Read-only order supervision detail."}
          </p>
        </div>
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surface-muted text-text-secondary transition-[background-color,color,transform] duration-150 ease-out hover:bg-brand-white hover:text-text-primary focus-visible:shadow-focus active:scale-[0.96]"
          aria-label="Close order detail"
          onClick={onClose}
        >
          <X size={18} weight="bold" aria-hidden />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {exceptionTags.length > 0 ? (
          exceptionTags.map((tag) => (
            <Badge
              key={tag.key}
              variant={tag.tone === "danger" ? "danger" : tag.tone === "warning" ? "warning" : "info"}
            >
              {tag.label}
            </Badge>
          ))
        ) : (
          <Badge variant="success">No exception tags</Badge>
        )}
      </div>

      <dl className="mt-5 grid gap-3">
        <DetailRow label="Table" value={getSupervisorTableLabel(activeOrder)} />
        <DetailRow label="Server" value={getSupervisorUserName(activeOrder.user)} />
        <DetailRow label="Service type" value={activeOrder.serviceType === "TAKEAWAY" ? "Takeaway" : "Dine in"} />
        <DetailRow label="Created" value={formatSupervisorDateTime(activeOrder.createdAt)} />
        <DetailRow label="Updated" value={formatSupervisorDateTime(activeOrder.updatedAt)} />
      </dl>

      <div className="mt-5 rounded-lg bg-surface-muted p-4">
        <div className="flex items-center gap-2">
          <CurrencyCircleDollar size={22} weight="bold" className="text-brand-navy-900" aria-hidden />
          <h3 className="text-base font-bold tracking-normal text-text-primary">Payment summary</h3>
        </div>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <DetailRow label="Total" value={formatSupervisorMoney(payments?.orderTotal ?? activeOrder.total)} />
          <DetailRow label="Paid" value={formatSupervisorMoney(payments?.totalPaid)} />
          <DetailRow label="Due" value={formatSupervisorMoney(payments?.remainingBalance ?? activeOrder.total)} />
        </dl>
        <p className="mt-3 text-sm font-semibold text-text-secondary">
          State: {paymentState.replace("-", " ")}
        </p>
        {paymentsError ? (
          <StatusMessage tone="warning" title="Payment reads unavailable">
            {paymentsError}
          </StatusMessage>
        ) : null}
        {payments?.payments.length ? (
          <div className="mt-3 grid gap-2">
            {payments.payments.map((payment) => (
              <div key={payment.id} className="rounded-md bg-surface px-3 py-2 text-sm">
                <p className="font-bold text-text-primary">
                  {payment.method || "Payment"} - {formatSupervisorMoney(payment.amount)}
                </p>
                <p className="mt-1 text-text-secondary">
                  {payment.status || "Unknown"} - {formatSupervisorDateTime(payment.createdAt || payment.postedAt)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-text-secondary">No completed payment rows returned.</p>
        )}
        {payments?.intents.length ? (
          <div className="mt-3 grid gap-2">
            {payments.intents.map((intent) => (
              <div key={intent.id} className="rounded-md bg-status-warning-surface px-3 py-2 text-sm text-status-warning">
                <p className="font-bold">
                  {intent.provider || "Intent"} - {formatSupervisorMoney(intent.amount)}
                </p>
                <p className="mt-1">
                  {intent.status || "Unknown"} {intent.failureReason ? `- ${intent.failureReason}` : ""}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-5 rounded-lg bg-surface-muted p-4">
        <div className="flex items-center gap-2">
          <ForkKnife size={22} weight="bold" className="text-brand-navy-900" aria-hidden />
          <h3 className="text-base font-bold tracking-normal text-text-primary">Items</h3>
        </div>
        {items.length ? (
          <div className="mt-3 grid gap-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 rounded-md bg-surface px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-bold text-text-primary">
                    {item.menuItem?.name || "Menu item"}
                  </p>
                  <p className="mt-1 text-text-secondary">
                    Qty {item.quantity || 0} {item.menuItemServing?.label ? `- ${item.menuItemServing.label}` : ""}
                  </p>
                </div>
                <p className="font-bold tabular-nums text-text-primary">
                  {formatSupervisorMoney(item.subtotal)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-text-secondary">
            This order has no item rows in the response.
          </p>
        )}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg bg-surface-muted p-4">
          <div className="flex items-center gap-2">
            <Percent size={22} weight="bold" className="text-brand-navy-900" aria-hidden />
            <h3 className="text-base font-bold tracking-normal text-text-primary">Discounts</h3>
          </div>
          {discountsError ? (
            <p className="mt-2 text-sm leading-6 text-status-warning">{discountsError}</p>
          ) : discounts?.data.length ? (
            <div className="mt-3 grid gap-2">
              {discounts.data.map((discount) => (
                <div key={discount.id} className="rounded-md bg-surface px-3 py-2 text-sm">
                  <p className="font-bold text-text-primary">
                    {discount.status || "Unknown"} - {discount.type || "Discount"} {String(discount.value || "")}
                  </p>
                  <p className="mt-1 text-text-secondary">{discount.reason || "No reason recorded"}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm leading-6 text-text-secondary">No discount rows returned.</p>
          )}
        </div>

        <div className="rounded-lg bg-surface-muted p-4">
          <div className="flex items-center gap-2">
            <WarningCircle size={22} weight="bold" className="text-brand-navy-900" aria-hidden />
            <h3 className="text-base font-bold tracking-normal text-text-primary">Refunds</h3>
          </div>
          {refundsError ? (
            <p className="mt-2 text-sm leading-6 text-status-warning">{refundsError}</p>
          ) : refunds?.length ? (
            <div className="mt-3 grid gap-2">
              {refunds.map((refund) => (
                <div key={refund.id} className="rounded-md bg-surface px-3 py-2 text-sm">
                  <p className="font-bold text-text-primary">
                    {refund.status || "Unknown"} - {formatSupervisorMoney(refund.amount)}
                  </p>
                  <p className="mt-1 text-text-secondary">{refund.reason || "No reason recorded"}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm leading-6 text-text-secondary">No refund rows returned.</p>
          )}
        </div>
      </div>

      <div className="mt-5 rounded-lg bg-surface-muted p-4">
        <div className="flex items-center gap-2">
          <Receipt size={22} weight="bold" className="text-brand-navy-900" aria-hidden />
          <h3 className="text-base font-bold tracking-normal text-text-primary">Deferred actions</h3>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ActionTile icon={SplitHorizontal} label="Split bill" description="Verified write is not enabled on this read-only surface." />
          <ActionTile icon={GitMerge} label="Merge orders" description="Handoff writes are not exposed on this Supervisor surface." />
          <ActionTile icon={ArrowsLeftRight} label="Transfer" description="Table/server transfers stay disabled here." />
          <ActionTile icon={WarningCircle} label="Void / refund" description="Sensitive write actions require a separate verified action workflow." />
        </div>
      </div>
    </Card>
  );
}
