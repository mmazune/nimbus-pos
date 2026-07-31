import { Badge, Skeleton } from "@/components/ui";
import { APPROVAL_DOMAIN_LABEL, type ApprovalQueueItem } from "@/lib/supervisor/approvals-workspace";

function QueueRow({
  item,
  selected,
  onSelect,
}: {
  item: ApprovalQueueItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-current={selected ? "true" : undefined}
        onClick={onSelect}
        className={[
          "w-full rounded-lg border p-3 text-left transition",
          "focus-visible:shadow-focus focus-visible:outline-none",
          selected
            ? "border-brand-navy-900 bg-surface shadow-subtle ring-1 ring-brand-navy-900"
            : "border-border-subtle bg-surface hover:border-text-muted",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Badge variant="neutral">{APPROVAL_DOMAIN_LABEL[item.domain]}</Badge>
            {item.severity && item.severityTone ? (
              <Badge variant={item.severityTone}>{item.severityLabel}</Badge>
            ) : null}
          </div>
          <Badge variant={item.statusTone}>{item.statusLabel}</Badge>
        </div>

        <p className="mt-2 truncate text-sm font-bold tracking-normal text-text-primary">{item.title}</p>
        <p className="mt-0.5 line-clamp-2 text-sm text-text-secondary">{item.summary}</p>

        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-text-muted">
          <span>{item.actionableAtLabel}</span>
          {item.amountLabel ? (
            <span className="font-semibold tabular-nums text-text-secondary">{item.amountLabel}</span>
          ) : null}
        </div>
      </button>
    </li>
  );
}

/**
 * The shared approval queue list. One row shell, domain-specific content. Handles
 * loading skeletons and an empty state; the parent supplies scope-specific empty copy.
 */
export function ApprovalQueueList({
  items,
  selectedId,
  isLoading,
  emptyTitle,
  emptyDescription,
  onSelect,
}: {
  items: ApprovalQueueItem[];
  selectedId: string | null;
  isLoading: boolean;
  emptyTitle: string;
  emptyDescription: string;
  onSelect: (item: ApprovalQueueItem) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-live="polite">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-subtle bg-surface-muted p-8 text-center">
        <p className="text-sm font-semibold text-text-primary">{emptyTitle}</p>
        <p className="mt-1 text-sm text-text-secondary">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2" aria-label="Approval queue">
      {items.map((item) => (
        <QueueRow
          key={`${item.domain}:${item.id}`}
          item={item}
          selected={selectedId === item.id}
          onSelect={() => onSelect(item)}
        />
      ))}
    </ul>
  );
}
