import { FunnelSimple, SortAscending } from "@phosphor-icons/react";

import { SearchInput } from "@/components/ui";
import {
  supervisorApprovalFilters,
  supervisorApprovalSorts,
  type SupervisorApprovalFilter,
  type SupervisorApprovalSort,
} from "@/lib/supervisor/approvals";

type SupervisorApprovalsToolbarProps = {
  query: string;
  filter: SupervisorApprovalFilter;
  sort: SupervisorApprovalSort;
  onQueryChange: (value: string) => void;
  onFilterChange: (value: SupervisorApprovalFilter) => void;
  onSortChange: (value: SupervisorApprovalSort) => void;
};

export function SupervisorApprovalsToolbar({
  filter,
  onFilterChange,
  onQueryChange,
  onSortChange,
  query,
  sort,
}: SupervisorApprovalsToolbarProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
      <div className="space-y-2">
        <label className="text-sm font-semibold text-text-secondary" htmlFor="supervisor-approvals-search">
          Search approvals
        </label>
        <SearchInput
          id="supervisor-approvals-search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="ID, order, employee, amount, status, reason"
        />
      </div>

      <label className="grid gap-2 text-sm font-semibold text-text-secondary">
        <span className="inline-flex items-center gap-2">
          <FunnelSimple size={18} weight="bold" aria-hidden />
          Filter
        </span>
        <select
          className="min-h-12 w-full min-w-0 rounded-md bg-surface px-3 text-base font-semibold text-text-primary shadow-subtle focus-visible:shadow-focus lg:min-w-[180px]"
          value={filter}
          onChange={(event) => onFilterChange(event.target.value as SupervisorApprovalFilter)}
        >
          {supervisorApprovalFilters.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2 text-sm font-semibold text-text-secondary">
        <span className="inline-flex items-center gap-2">
          <SortAscending size={18} weight="bold" aria-hidden />
          Sort
        </span>
        <select
          className="min-h-12 w-full min-w-0 rounded-md bg-surface px-3 text-base font-semibold text-text-primary shadow-subtle focus-visible:shadow-focus lg:min-w-[180px]"
          value={sort}
          onChange={(event) => onSortChange(event.target.value as SupervisorApprovalSort)}
        >
          {supervisorApprovalSorts.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
