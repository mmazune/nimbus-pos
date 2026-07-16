import { ClockCounterClockwise } from "@phosphor-icons/react";

import { Skeleton } from "@/components/ui";
import type { CashierReceiptHistoryEventViewModel } from "@/lib/cashier/receipt-types";

import { CashierReceiptStatusBadge } from "./CashierReceiptStatusBadge";

type CashierReceiptHistoryProps = {
  events: CashierReceiptHistoryEventViewModel[];
  isLoading?: boolean;
  error?: string;
};

export function CashierReceiptHistory({ events, isLoading, error }: CashierReceiptHistoryProps) {
  if (isLoading) {
    return (
      <section className="rounded-lg bg-surface p-4 shadow-subtle">
        <p className="font-bold text-text-primary">History</p>
        <div className="mt-4 grid gap-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-5/6" />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg bg-surface p-4 shadow-subtle" aria-labelledby="cashier-receipt-history-title">
      <div className="flex items-center justify-between gap-3">
        <h3 id="cashier-receipt-history-title" className="font-bold text-text-primary">
          History
        </h3>
        <ClockCounterClockwise size={18} weight="bold" className="text-text-muted" aria-hidden />
      </div>

      {error ? (
        <p className="mt-4 rounded-md bg-status-warning-surface p-3 text-sm font-medium text-status-warning">
          Could not load receipt history.
        </p>
      ) : events.length === 0 ? (
        <p className="mt-4 rounded-md bg-surface-muted p-3 text-sm font-medium text-text-secondary">
          No receipt history yet.
        </p>
      ) : (
        <ol className="mt-4 grid gap-4">
          {events.map((event) => (
            <li key={event.id} className="grid grid-cols-[10px_1fr] gap-3">
              <span className="mt-2 h-2.5 w-2.5 rounded-full bg-brand-navy-900" aria-hidden />
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold text-text-primary">{event.label}</p>
                  <CashierReceiptStatusBadge label={event.status || event.action} tone={event.tone} />
                </div>
                <p className="mt-1 text-sm leading-6 text-text-secondary">{event.description}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold tabular-nums text-text-muted">
                  {event.createdAt ? <span>{event.createdAt}</span> : null}
                  {event.actor ? <span>Actor {event.actor}</span> : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
