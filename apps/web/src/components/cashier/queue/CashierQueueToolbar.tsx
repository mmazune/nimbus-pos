import { Card } from "@/components/ui";
import type { CashierQueueFilterId } from "@/lib/cashier/queue-filters";

import { CashierQueueFilterChips } from "./CashierQueueFilterChips";
import { CashierQueueSearch } from "./CashierQueueSearch";

type CashierQueueToolbarProps = {
  activeFilter: CashierQueueFilterId;
  search: string;
  onFilterChange: (filter: CashierQueueFilterId) => void;
  onSearchChange: (value: string) => void;
};

export function CashierQueueToolbar({
  activeFilter,
  search,
  onFilterChange,
  onSearchChange,
}: CashierQueueToolbarProps) {
  return (
    <Card className="flex items-end justify-between gap-5">
      <div className="min-w-0 flex-1">
        <p className="mb-2 text-sm font-semibold text-text-secondary">Queue filter</p>
        <CashierQueueFilterChips activeFilter={activeFilter} onChange={onFilterChange} />
      </div>
      <CashierQueueSearch value={search} onChange={onSearchChange} />
    </Card>
  );
}
