import type { ApprovalWorkspaceDomain, ApprovalQueueScope } from "@/lib/supervisor/approvals-contract";
import { APPROVAL_DOMAIN_LABEL, domainsForScope } from "@/lib/supervisor/approvals-workspace";

export type DomainFilterValue = "all" | ApprovalWorkspaceDomain;

/**
 * Domain filter (All + one chip per domain the current scope supports). Counts
 * are permission-aware and passed in from the workspace; discounts are omitted
 * from Resolved/History (no branch-wide endpoint — SUP-RG-035).
 */
export function ApprovalDomainFilter({
  scope,
  value,
  counts,
  onSelect,
}: {
  scope: ApprovalQueueScope;
  value: DomainFilterValue;
  counts: Partial<Record<ApprovalWorkspaceDomain, number>> | null;
  onSelect: (value: DomainFilterValue) => void;
}) {
  const domains = domainsForScope(scope);
  const options: Array<{ value: DomainFilterValue; label: string; count: number | null }> = [
    { value: "all", label: "All", count: null },
    ...domains.map((d) => ({
      value: d,
      label: APPROVAL_DOMAIN_LABEL[d],
      count: scope === "needs-action" && counts ? counts[d] ?? null : null,
    })),
  ];

  return (
    <div role="group" aria-label="Filter by domain" className="flex flex-wrap items-center gap-2">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(opt.value)}
            className={[
              "inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-semibold tracking-normal transition",
              "focus-visible:shadow-focus focus-visible:outline-none",
              active
                ? "border-transparent bg-brand-navy-900 text-brand-white"
                : "border-border-subtle bg-surface text-text-secondary hover:text-text-primary",
            ].join(" ")}
          >
            <span>{opt.label}</span>
            {opt.count !== null ? (
              <span
                aria-hidden
                className={[
                  "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums",
                  active ? "bg-brand-white/20 text-brand-white" : "bg-surface-muted text-text-muted",
                ].join(" ")}
              >
                {opt.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
