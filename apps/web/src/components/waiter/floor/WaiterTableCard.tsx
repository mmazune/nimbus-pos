import { CalendarCheck, Users } from "@phosphor-icons/react";

import { WaiterTableStatusBadge } from "@/components/waiter/floor/WaiterTableStatusBadge";
import { cn } from "@/lib/utils/cn";
import type { WaiterTableViewModel } from "@/lib/waiter/floor-model";

type WaiterTableCardProps = {
  table: WaiterTableViewModel;
  onSelect: (table: WaiterTableViewModel) => void;
};

const cardAccent = {
  available: "bg-status-success-surface text-status-success",
  occupied: "bg-status-info-surface text-status-info",
  reserved: "bg-status-warning-surface text-status-warning",
} as const;

function TableMiddle({ table }: { table: WaiterTableViewModel }) {
  if (table.status === "available") {
    return <div className="min-h-[54px]" aria-hidden />;
  }

  if (table.status === "reserved") {
    return (
      <div className={cn("min-h-[76px] rounded-md px-4 py-3", cardAccent.reserved)}>
        <div className="flex min-w-0 items-center gap-2 font-semibold">
          <CalendarCheck size={18} weight="bold" className="shrink-0" aria-hidden />
          <span className="truncate" title={table.guestName || "Reserved guest"}>
            {table.guestName || "Reserved guest"}
          </span>
        </div>
        <p className="mt-2 truncate text-sm" title={table.reservationTime || undefined}>
          {table.reservationTime ? `Arrives ${table.reservationTime}` : "Reservation time pending"}
        </p>
      </div>
    );
  }

  const ownerLabel = table.isMine
    ? "Mine"
    : table.assignedWaiterName || "Other waiter";

  return (
    <div className={cn("min-h-[76px] rounded-md px-4 py-3", cardAccent.occupied)}>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal opacity-80">Order</p>
          <p className="mt-1 truncate font-bold tabular-nums" title={table.orderNumber || undefined}>
            {table.orderNumber || "Order pending"}
          </p>
        </div>
        <span
          className="max-w-[112px] shrink-0 truncate rounded-full bg-surface px-3 py-1 text-xs font-bold text-status-info shadow-subtle"
          title={ownerLabel}
        >
          {ownerLabel}
        </span>
      </div>
      {table.guestName ? (
        <p className="mt-2 truncate text-sm font-semibold opacity-90" title={table.guestName}>
          {table.guestName}
        </p>
      ) : null}
    </div>
  );
}

export function WaiterTableCard({ table, onSelect }: WaiterTableCardProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-h-[172px] w-full flex-col justify-between gap-4 rounded-lg bg-surface p-5 text-left shadow-subtle",
        "transition-[background-color,box-shadow,transform] duration-150 ease-out active:scale-[0.96]",
        "hover:bg-brand-white hover:shadow-panel focus-visible:shadow-focus",
        table.status === "occupied" && !table.isMine && "bg-status-neutral-surface",
      )}
      onClick={() => onSelect(table)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xl font-bold tracking-normal text-text-primary">{table.name}</p>
        </div>
        <WaiterTableStatusBadge status={table.status} />
      </div>

      <TableMiddle table={table} />

      <div className="flex items-center justify-between gap-3 text-sm font-semibold text-text-secondary">
        <span className="inline-flex min-w-0 items-center gap-2 whitespace-nowrap">
          <Users size={18} weight="bold" className="shrink-0" aria-hidden />
          <span className="tabular-nums">{table.capacity || "?"} seats</span>
        </span>
      </div>
    </button>
  );
}
