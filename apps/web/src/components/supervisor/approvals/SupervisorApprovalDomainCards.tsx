import { CheckCircle, Prohibit, WarningCircle } from "@phosphor-icons/react";

import { Badge, Card, Skeleton } from "@/components/ui";
import type { SupervisorApprovalDomainState } from "@/lib/supervisor/approvals";

type SupervisorApprovalDomainCardsProps = {
  states: SupervisorApprovalDomainState[];
};

function statusBadge(state: SupervisorApprovalDomainState) {
  if (state.status === "loading") return <Badge variant="neutral">Loading</Badge>;
  if (state.status === "failed") return <Badge variant="danger">Failed</Badge>;
  if (state.status === "unavailable") return <Badge variant="neutral">Unavailable</Badge>;
  return <Badge variant="success">Loaded</Badge>;
}

export function SupervisorApprovalDomainCards({ states }: SupervisorApprovalDomainCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Approval domain sources">
      {states.map((state) => (
        <Card key={state.domain} className={state.available ? undefined : "bg-surface-muted"}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-text-primary">{state.label}</p>
              <p className="mt-1 truncate text-xs font-semibold text-text-muted" title={state.endpoint}>
                {state.endpoint}
              </p>
            </div>
            {state.available ? (
              <CheckCircle size={22} weight="duotone" className="shrink-0 text-status-success" aria-hidden />
            ) : state.status === "failed" ? (
              <WarningCircle size={22} weight="duotone" className="shrink-0 text-status-danger" aria-hidden />
            ) : (
              <Prohibit size={22} weight="duotone" className="shrink-0 text-text-muted" aria-hidden />
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {statusBadge(state)}
            <Badge variant="info">{state.permission}</Badge>
            <Badge variant={state.readOnly ? "success" : "warning"}>
              {state.readOnly ? "Read-only" : "Mutation only"}
            </Badge>
          </div>
          <div className="mt-4">
            {state.status === "loading" ? (
              <Skeleton className="h-7 w-24" />
            ) : state.count === null ? (
              <p className="text-xl font-bold tabular-nums text-text-secondary">Unavailable</p>
            ) : (
              <p className="text-xl font-bold tabular-nums text-text-primary">{state.count}</p>
            )}
          </div>
          {state.error || state.caveat ? (
            <p className="mt-3 text-sm leading-6 text-text-secondary">{state.error || state.caveat}</p>
          ) : (
            <p className="mt-3 text-sm leading-6 text-text-secondary">Loaded from the verified domain route.</p>
          )}
        </Card>
      ))}
    </div>
  );
}
