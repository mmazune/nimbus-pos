import { DesktopTower, IdentificationCard, Storefront, UserCircle } from "@phosphor-icons/react";

import { Badge, Card } from "@/components/ui";
import type { CashierWorkspaceContext } from "@/lib/cashier/context";
import { initialsFromName } from "@/lib/cashier/formatters";

type CashierProfileCardProps = {
  context: CashierWorkspaceContext;
};

function valueOrFallback(value: string | number | null | undefined, fallback = "Not available") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[132px_minmax(0,1fr)] gap-4 border-t border-border-subtle py-3 first:border-t-0 first:pt-0 last:pb-0">
      <dt className="text-xs font-semibold uppercase tracking-normal text-text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-semibold text-text-primary">{value}</dd>
    </div>
  );
}

export function CashierProfileCard({ context }: CashierProfileCardProps) {
  const initials = initialsFromName(context.displayName);

  return (
    <Card className="overflow-hidden p-0">
      <div className="grid grid-cols-[minmax(0,1fr)_280px]">
        <section className="min-w-0 p-6" aria-labelledby="cashier-profile-title">
          <div className="flex min-w-0 items-start gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-brand-navy-900 text-2xl font-bold tracking-normal text-text-inverse shadow-panel">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-normal text-text-muted">
                <UserCircle size={18} weight="bold" aria-hidden />
                <span>Profile</span>
              </div>
              <h2 id="cashier-profile-title" className="mt-2 truncate text-2xl font-bold tracking-normal text-text-primary">
                {context.displayName}
              </h2>
              <p className="mt-1 truncate text-sm text-text-secondary">{valueOrFallback(context.email)}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="info">{valueOrFallback(context.roleLabel)}</Badge>
                <Badge variant={context.branchId ? "success" : "warning"}>
                  {valueOrFallback(context.branchName, "Branch context unavailable")}
                </Badge>
                <Badge variant="neutral">{valueOrFallback(context.workstationLabel, "Cashier terminal")}</Badge>
              </div>
            </div>
          </div>

          <dl className="mt-6">
            <DetailRow label="Role" value={valueOrFallback(context.roleLabel)} />
            <DetailRow label="Job role" value={valueOrFallback(context.jobRole)} />
            <DetailRow label="User ID" value={valueOrFallback(context.userId)} />
            <DetailRow label="Email" value={valueOrFallback(context.email)} />
            <DetailRow label="Organization" value={valueOrFallback(context.organizationName)} />
            <DetailRow label="Organization ID" value={valueOrFallback(context.organizationId)} />
            <DetailRow label="Branch" value={valueOrFallback(context.branchName, "Branch context unavailable")} />
            <DetailRow label="Branch ID" value={valueOrFallback(context.branchId)} />
          </dl>
        </section>

        <aside className="border-l border-border-subtle bg-surface-muted p-5" aria-labelledby="terminal-context-title">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-surface text-brand-navy-900 shadow-subtle">
            <DesktopTower size={24} weight="duotone" aria-hidden />
          </div>
          <h3 id="terminal-context-title" className="mt-4 text-lg font-bold tracking-normal text-text-primary">
            Terminal Context
          </h3>
          <dl className="mt-5 grid gap-4">
            <div>
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-text-muted">
                <Storefront size={16} weight="bold" aria-hidden />
                Branches
              </dt>
              <dd className="mt-1 text-sm font-semibold text-text-primary">
                {context.branchCount ? `${context.branchCount} in session context` : "Not available"}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-text-muted">
                <IdentificationCard size={16} weight="bold" aria-hidden />
                Workstation
              </dt>
              <dd className="mt-1 text-sm font-semibold text-text-primary">
                {valueOrFallback(context.workstationLabel, "Cashier terminal")}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-normal text-text-muted">Platform</dt>
              <dd className="mt-1 break-words text-sm font-semibold text-text-primary">
                {valueOrFallback(context.sessionPlatform)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-normal text-text-muted">Session type</dt>
              <dd className="mt-1 break-words text-sm font-semibold text-text-primary">
                {valueOrFallback(context.sessionSource)}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </Card>
  );
}
