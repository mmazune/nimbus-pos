import { SquaresFour } from "@phosphor-icons/react";

import { EmptyState, Skeleton } from "@/components/ui";
import { WaiterTableCard } from "@/components/waiter/floor/WaiterTableCard";
import type { WaiterTableViewModel } from "@/lib/waiter/floor-model";

type WaiterTableGridProps = {
  tables: WaiterTableViewModel[];
  isLoading?: boolean;
  onSelectTable: (table: WaiterTableViewModel) => void;
};

export function WaiterTableGrid({ tables, isLoading, onSelectTable }: WaiterTableGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-5 gap-4 2xl:grid-cols-6">
        {Array.from({ length: 15 }).map((_, index) => (
          <div key={index} className="min-h-[172px] rounded-lg bg-surface p-5 shadow-subtle">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="mt-5 h-[76px] w-full" />
            <div className="mt-5 flex items-center justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <EmptyState
        icon={<SquaresFour size={32} weight="duotone" />}
        title="No tables match this view"
        description="Adjust the search or filter to see available, occupied, reserved, or waiter-owned tables."
      />
    );
  }

  return (
    <div className="grid grid-cols-5 gap-4 2xl:grid-cols-6">
      {tables.map((table) => (
        <WaiterTableCard key={table.id} table={table} onSelect={onSelectTable} />
      ))}
    </div>
  );
}
