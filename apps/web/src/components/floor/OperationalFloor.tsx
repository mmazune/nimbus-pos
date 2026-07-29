import { WarningCircle } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";

import { Badge, PageShell } from "@/components/ui";

import { OperationalFloorErrorState } from "./OperationalFloorErrorState";
import { OperationalFloorToolbar } from "./OperationalFloorToolbar";
import { OperationalTableGrid } from "./OperationalTableGrid";
import {
  countOperationalTables,
  filterOperationalTables,
  getOperationalFloorPlans,
} from "./formatters";
import type {
  OperationalFloorErrorCopy,
  OperationalTableFilter,
  OperationalTableViewModel,
} from "./types";

type OperationalFloorProps<T extends OperationalTableViewModel> = {
  branchName?: string | null;
  readinessLabel: string;
  readinessTone: "neutral" | "success" | "warning" | "danger" | "info";
  tables: T[];
  isLoading?: boolean;
  error?: OperationalFloorErrorCopy | null;
  selectedTableId?: string;
  onSelectTable: (table: T) => void;
  onRetry?: () => void;
};

export function OperationalFloor<T extends OperationalTableViewModel>({
  branchName,
  error,
  isLoading,
  onRetry,
  onSelectTable,
  readinessLabel,
  readinessTone,
  selectedTableId,
  tables,
}: OperationalFloorProps<T>) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<OperationalTableFilter>("all");
  const [selectedFloorPlanId, setSelectedFloorPlanId] = useState<string | null>(null);
  const counts = useMemo(() => countOperationalTables(tables), [tables]);
  const floorPlans = useMemo(() => getOperationalFloorPlans(tables), [tables]);
  const filteredTables = useMemo(
    () => filterOperationalTables({ filter, floorPlanId: selectedFloorPlanId, query, tables }),
    [filter, query, selectedFloorPlanId, tables],
  );

  useEffect(() => {
    if (selectedFloorPlanId && !floorPlans.some((plan) => plan.id === selectedFloorPlanId)) {
      setSelectedFloorPlanId(null);
    }
  }, [floorPlans, selectedFloorPlanId]);

  return (
    <PageShell
      title="Floor"
      subtitle={branchName ? `${branchName} table service` : "Table service"}
      actions={
        <div className="flex items-center gap-2">
          <Badge variant={readinessTone}>{readinessLabel}</Badge>
          <Badge variant="neutral">
            <span className="tabular-nums">{counts.all}</span>
            <span className="ml-1">tables</span>
          </Badge>
        </div>
      }
    >
      <OperationalFloorToolbar
        query={query}
        filter={filter}
        counts={counts}
        floorPlans={floorPlans}
        selectedFloorPlanId={selectedFloorPlanId}
        onQueryChange={setQuery}
        onFilterChange={setFilter}
        onFloorPlanChange={setSelectedFloorPlanId}
      />

      {error ? (
        <OperationalFloorErrorState error={error} onRetry={onRetry} />
      ) : (
        <OperationalTableGrid
          tables={filteredTables}
          isLoading={isLoading}
          selectedTableId={selectedTableId}
          onSelectTable={onSelectTable}
        />
      )}

      {!isLoading && !error && tables.length === 0 ? (
        <div className="flex items-center gap-2 text-sm font-medium text-text-muted" role="status">
          <WarningCircle size={18} weight="bold" aria-hidden />
          <span>No active operational tables were returned for this branch.</span>
        </div>
      ) : null}
    </PageShell>
  );
}
