import type { ApprovalQueueScope } from "@/lib/supervisor/approvals-contract";

const SCOPES: Array<{ value: ApprovalQueueScope; label: string }> = [
  { value: "needs-action", label: "Needs action" },
  { value: "resolved", label: "Resolved" },
  { value: "history", label: "History" },
];

/**
 * Scope selector (Needs action / Resolved / History) as an accessible tablist.
 * The Needs-action tab carries a compact live count badge.
 */
export function ApprovalScopeTabs({
  scope,
  needsActionCount,
  onSelect,
}: {
  scope: ApprovalQueueScope;
  needsActionCount: number | null;
  onSelect: (scope: ApprovalQueueScope) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Approval queue scope"
      className="inline-flex flex-wrap gap-1 rounded-lg border border-border-subtle bg-surface-muted p-1"
    >
      {SCOPES.map((s) => {
        const active = s.value === scope;
        return (
          <button
            key={s.value}
            role="tab"
            type="button"
            aria-selected={active}
            aria-controls="approval-queue-panel"
            onClick={() => onSelect(s.value)}
            className={[
              "inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-sm font-semibold tracking-normal transition",
              "focus-visible:shadow-focus focus-visible:outline-none",
              active
                ? "bg-surface text-text-primary shadow-subtle"
                : "text-text-secondary hover:text-text-primary",
            ].join(" ")}
          >
            <span>{s.label}</span>
            {s.value === "needs-action" && needsActionCount !== null ? (
              <span
                aria-hidden
                className={[
                  "inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
                  needsActionCount > 0
                    ? "bg-status-warning-surface text-status-warning"
                    : "bg-status-neutral-surface text-text-muted",
                ].join(" ")}
              >
                {needsActionCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
