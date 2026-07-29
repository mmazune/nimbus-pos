import { SquaresFour } from "@phosphor-icons/react";

import { EmptyState, Skeleton } from "@/components/ui";

import { OperationalTableCard } from "./OperationalTableCard";
import type { OperationalTableViewModel } from "./types";

type OperationalTableGridProps<T extends OperationalTableViewModel> = {
  tables: T[];
  isLoading?: boolean;
  selectedTableId?: string;
  onSelectTable: (table: T) => void;
};

export function OperationalTableGrid<T extends OperationalTableViewModel>({
  isLoading,
  onSelectTable,
  selectedTableId,
  tables,
}: OperationalTableGridProps<T>) {
  if (isLoading) {
    return (
      <div
        className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4"
        aria-busy="true"
        aria-label="Loading operational tables"
      >
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="min-h-[176px] rounded-lg bg-surface p-5 shadow-subtle">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-12 w-28" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="mt-5 h-5 w-32" />
            <Skeleton className="mt-3 h-4 w-24" />
            <Skeleton className="mt-5 h-4 w-20" />
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
        description="Adjust the search, status filter, or floor plan to see operational tables."
      />
    );
  }

  return (
    <div
      className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4"
      aria-label="Operational tables"
    >
      {tables.map((table) => (
        <OperationalTableCard
          key={table.id}
          table={table}
          selected={table.id === selectedTableId}
          onSelect={onSelectTable}
        />
      ))}
    </div>
  );
}
