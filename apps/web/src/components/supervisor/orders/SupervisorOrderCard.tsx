import { Clock, Receipt, Table } from "@phosphor-icons/react";

import { Card } from "@/components/ui";
import { SupervisorOrderStatusBadge, SupervisorPaymentBadge } from "@/components/supervisor/orders/SupervisorOrderStatusBadge";
import {
  formatAge,
  formatSupervisorMoney,
  formatSupervisorShortTime,
  getPaymentState,
  getSupervisorOrderExceptionTags,
  getSupervisorOrderLabel,
  getSupervisorTableLabel,
  getSupervisorUserName,
  type SupervisorOrderListItem,
  type SupervisorOrderPayments,
} from "@/lib/supervisor/orders";
import { cn } from "@/lib/utils/cn";

type SupervisorOrderCardProps = {
  order: SupervisorOrderListItem;
  payments?: SupervisorOrderPayments | null;
  selected?: boolean;
  onSelect: (order: SupervisorOrderListItem) => void;
};

const tagToneClasses = {
  info: "bg-status-info-surface text-status-info",
  warning: "bg-status-warning-surface text-status-warning",
  danger: "bg-status-danger-surface text-status-danger",
};

export function SupervisorOrderCard({ onSelect, order, payments, selected }: SupervisorOrderCardProps) {
  const label = getSupervisorOrderLabel(order);
  const paymentState = getPaymentState(payments);
  const exceptionTags = getSupervisorOrderExceptionTags({ order, payments });
  const itemCount = order.items?.length || 0;

  return (
    <button
      type="button"
      className="block w-full rounded-lg text-left focus-visible:shadow-focus"
      onClick={() => onSelect(order)}
      aria-pressed={selected}
    >
      <Card
        className={cn(
          "min-h-[164px] border border-transparent transition-[border-color,box-shadow,transform] duration-150 ease-out hover:border-brand-navy-200 hover:shadow-focus active:scale-[0.995]",
          selected && "border-brand-navy-900 shadow-focus",
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-3">
              <p className="truncate text-lg font-bold tracking-normal text-text-primary" title={label}>
                {label}
              </p>
              <SupervisorOrderStatusBadge status={order.status} />
            </div>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              {getSupervisorUserName(order.user)} - {order.serviceType === "TAKEAWAY" ? "Takeaway" : "Dine in"}
            </p>
          </div>
          <SupervisorPaymentBadge state={paymentState} />
        </div>

        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md bg-surface-muted px-3 py-2">
            <span className="flex items-center gap-2 font-semibold text-text-secondary">
              <Table size={16} weight="bold" aria-hidden />
              Table
            </span>
            <p className="mt-1 truncate font-bold text-text-primary" title={getSupervisorTableLabel(order)}>
              {getSupervisorTableLabel(order)}
            </p>
          </div>
          <div className="rounded-md bg-surface-muted px-3 py-2">
            <span className="flex items-center gap-2 font-semibold text-text-secondary">
              <Receipt size={16} weight="bold" aria-hidden />
              Items
            </span>
            <p className="mt-1 font-bold tabular-nums text-text-primary">{itemCount}</p>
          </div>
          <div className="rounded-md bg-surface-muted px-3 py-2">
            <span className="font-semibold text-text-secondary">Total</span>
            <p className="mt-1 font-bold tabular-nums text-text-primary">
              {formatSupervisorMoney(order.total)}
            </p>
          </div>
          <div className="rounded-md bg-surface-muted px-3 py-2">
            <span className="font-semibold text-text-secondary">Due</span>
            <p className="mt-1 font-bold tabular-nums text-text-primary">
              {payments ? formatSupervisorMoney(payments.remainingBalance) : "Loading"}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-text-secondary">
            <Clock size={16} weight="bold" aria-hidden />
            {formatSupervisorShortTime(order.createdAt)} - updated {formatAge(order.updatedAt)}
          </span>
          {exceptionTags.map((tag) => (
            <span
              key={tag.key}
              className={cn(
                "inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-semibold",
                tagToneClasses[tag.tone],
              )}
            >
              {tag.label}
            </span>
          ))}
        </div>
      </Card>
    </button>
  );
}
