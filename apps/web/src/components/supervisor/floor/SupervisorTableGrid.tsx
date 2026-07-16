import { SquaresFour } from "@phosphor-icons/react";

import { EmptyState, Skeleton } from "@/components/ui";
import { SupervisorTableCard } from "@/components/supervisor/floor/SupervisorTableCard";
import type { SupervisorTableViewModel } from "@/lib/supervisor/floor-model";

type SupervisorTableGridProps = {
  tables: SupervisorTableViewModel[];
  selectedTableId: string | null;
  isLoading?: boolean;
  onSelectTable: (table: SupervisorTableViewModel) => void;
};

export function SupervisorTableGrid({
  isLoading,
  onSelectTable,
  selectedTableId,
  tables,
}: SupervisorTableGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="min-h-[224px] rounded-lg bg-surface p-5 shadow-subtle">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-7 w-20 rounded-full" />
            </div>
            <Skeleton className="mt-5 h-[78px] w-full" />
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
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
        description="Adjust the floor plan, status filter, or search to see branch tables."
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {tables.map((table) => (
        <SupervisorTableCard
          key={table.id}
          table={table}
          selected={table.id === selectedTableId}
          onSelect={onSelectTable}
        />
      ))}
    </div>
  );
}
