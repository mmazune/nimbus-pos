import { Button } from "@/components/ui";

/**
 * History filter toolbar — bounded server-supported date range (createdAt window)
 * plus Clear. All controls map to API params; no client-side full-list filtering.
 */
export function ApprovalFilterToolbar({
  dateFrom,
  dateTo,
  onDateFrom,
  onDateTo,
  onClear,
}: {
  dateFrom: string;
  dateTo: string;
  onDateFrom: (value: string) => void;
  onDateTo: (value: string) => void;
  onClear: () => void;
}) {
  const hasFilters = Boolean(dateFrom || dateTo);
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border-subtle bg-surface-muted p-3">
      <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
        From
        <input
          type="date"
          value={dateFrom}
          max={dateTo || undefined}
          onChange={(e) => onDateFrom(e.target.value)}
          className="min-h-10 rounded-md border border-border-subtle bg-surface px-3 text-sm text-text-primary focus-visible:shadow-focus focus-visible:outline-none"
          aria-label="History date from"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
        To
        <input
          type="date"
          value={dateTo}
          min={dateFrom || undefined}
          onChange={(e) => onDateTo(e.target.value)}
          className="min-h-10 rounded-md border border-border-subtle bg-surface px-3 text-sm text-text-primary focus-visible:shadow-focus focus-visible:outline-none"
          aria-label="History date to"
        />
      </label>
      {hasFilters ? (
        <Button variant="tertiary" size="compact" onClick={onClear}>
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}
