import { Skeleton } from "@/components/ui";
import { WaiterReceiptStatusBadge } from "@/components/waiter/receipts/WaiterReceiptStatusBadge";

import type { WaiterReceiptHistoryEventViewModel } from "@/lib/waiter/receipt-model";

type WaiterReceiptHistoryTimelineProps = {
  events: WaiterReceiptHistoryEventViewModel[];
  isLoading?: boolean;
  error?: string;
};

export function WaiterReceiptHistoryTimeline({
  events,
  isLoading,
  error,
}: WaiterReceiptHistoryTimelineProps) {
  if (isLoading) {
    return (
      <section className="rounded-lg bg-surface p-4 shadow-subtle">
        <p className="text-sm font-bold text-text-primary">History</p>
        <div className="mt-4 grid gap-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-5/6" />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg bg-surface p-4 shadow-subtle">
      <p className="text-sm font-bold text-text-primary">Receipt history</p>

      {error ? (
        <div className="mt-4 rounded-md bg-status-warning-surface p-3 text-sm font-medium text-status-warning">
          History unavailable.
        </div>
      ) : events.length === 0 ? (
        <div className="mt-4 rounded-md bg-surface-muted p-3 text-sm font-medium text-text-secondary">
          No receipt events yet.
        </div>
      ) : (
        <ol className="mt-4 grid gap-4">
          {events.map((event) => (
            <li key={event.id} className="grid grid-cols-[10px_1fr] gap-3">
              <span className="mt-2 h-2.5 w-2.5 rounded-full bg-brand-navy-900" aria-hidden />
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-text-primary">{event.label}</p>
                  <WaiterReceiptStatusBadge tone={event.tone}>
                    {event.status || event.action}
                  </WaiterReceiptStatusBadge>
                </div>
                <p className="mt-1 text-sm leading-6 text-text-secondary">{event.description}</p>
                {event.createdAt ? (
                  <p className="mt-1 text-xs font-semibold tabular-nums text-text-muted">
                    {event.createdAt}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
