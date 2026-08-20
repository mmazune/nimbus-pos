import { SquaresFour } from "@phosphor-icons/react";

import { EmptyState, Skeleton } from "@/components/ui";
import { operationalIconSizes } from "@/components/pos-shell/role-icons";

import { OperationalTableCard } from "./OperationalTableCard";
import type { OperationalTableViewModel } from "./types";

type OperationalTableGridProps<T extends OperationalTableViewModel> = {
  tables: T[];
  isLoading?: boolean;
  selectedTableId?: string;
  /** Collision-safe short labels keyed by the ORIGINAL table label. */
  displayLabels?: ReadonlyMap<string, string>;
  onSelectTable: (table: T) => void;
};

export function OperationalTableGrid<T extends OperationalTableViewModel>({
  displayLabels,
  isLoading,
  onSelectTable,
  selectedTableId,
  tables,
}: OperationalTableGridProps<T>) {
  if (isLoading) {
    return (
      <div
        className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3"
        aria-busy="true"
        aria-label="Loading operational tables"
      >
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="min-h-[9.5rem] rounded-lg bg-surface p-4 shadow-subtle">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="mt-4 h-5 w-32" />
            <Skeleton className="mt-2 h-4 w-24" />
            <Skeleton className="mt-4 h-4 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <EmptyState
        icon={<SquaresFour size={operationalIconSizes.pageState} weight="duotone" />}
        title="No tables match this view"
        description="Adjust the search, status filter, or floor plan to see operational tables."
      />
    );
  }

  return (
    <div
      className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3"
      aria-label="Operational tables"
    >
      {tables.map((table) => (
        <OperationalTableCard
          key={table.id}
          table={table}
          displayLabel={displayLabels?.get(table.label)}
          selected={table.id === selectedTableId}
          onSelect={onSelectTable}
        />
      ))}
    </div>
  );
}
