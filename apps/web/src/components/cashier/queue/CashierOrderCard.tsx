import { ArrowRight, Clock, Receipt, UserFocus, Users } from "@phosphor-icons/react";

import { Badge } from "@/components/ui";
import type { CashierOrderViewModel } from "@/lib/cashier/order-types";
import { cn } from "@/lib/utils/cn";

import { CashierQueueStatusBadge } from "./CashierQueueStatusBadge";

type CashierOrderCardProps = {
  order: CashierOrderViewModel;
  selected?: boolean;
  onSelect: (orderId: string) => void;
};

export function CashierOrderCard({ order, selected, onSelect }: CashierOrderCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "w-full rounded-lg bg-surface p-5 text-left text-text-primary shadow-subtle",
        "transition-[background-color,box-shadow,transform] duration-150 ease-out hover:bg-surface-raised hover:shadow-panel active:scale-[0.99]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy-900",
        selected && "bg-surface-raised ring-2 ring-brand-navy-900",
      )}
      onClick={() => onSelect(order.id)}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_180px_170px] items-center gap-5">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-status-info-surface text-status-info">
            <Receipt size={24} weight="duotone" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="truncate text-lg font-bold tracking-normal text-text-primary">
                {order.tableName}
              </p>
              <CashierQueueStatusBadge label={order.statusLabel} tone={order.statusTone} />
              <Badge variant={order.payment.tone}>{order.payment.label}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium text-text-secondary">
              <span className="tabular-nums">{order.orderNumber}</span>
              <span className="inline-flex items-center gap-1.5">
                <UserFocus size={16} weight="bold" aria-hidden />
                {order.serverName}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users size={16} weight="bold" aria-hidden />
                {order.guestName || "Guest unavailable"}
              </span>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-text-muted">Readiness</p>
          <p className="mt-1 text-sm font-bold text-text-primary">{order.readinessLabel}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold tabular-nums text-text-secondary">
            <Clock size={14} weight="bold" aria-hidden />
            {order.elapsedLabel || order.openedLabel}
          </p>
        </div>

        <div className="flex items-center justify-end gap-3">
          <div className="text-right">
            <p className="text-xs font-semibold text-text-muted">Total</p>
            <p className="mt-1 text-base font-bold tabular-nums text-text-primary">
              {order.formattedTotal}
            </p>
            <p className="mt-1 text-xs font-semibold text-text-secondary">{order.serviceTypeLabel}</p>
          </div>
          <ArrowRight size={20} weight="bold" className="text-text-muted" aria-hidden />
        </div>
      </div>
    </button>
  );
}
