import { Badge, Card, PageShell } from "@/components/ui";
import { operationalIcons, operationalIconSizes, operationalIconWeights } from "@/components/pos-shell/role-icons";
import { useManagerBranch } from "@/lib/manager/branch-context";
import { getManagerSurface, type ManagerSurfaceKey } from "@/lib/manager/permissions";

type ManagerFoundationScreenProps = {
  surface: Exclude<ManagerSurfaceKey, "me">;
  title: string;
  subtitle: string;
  /** What this surface will own once its phase lands. Plain scope statements — never sample data. */
  scope: readonly string[];
  /** Verified backend boundaries this surface must respect. Sourced from the M-P0 audit. */
  boundaries?: readonly string[];
};

/**
 * M-P1 foundation screen.
 *
 * These pages exist so the Manager shell, nav, guard, and branch switcher are real
 * and navigable NOW. They deliberately render **no data, no widgets, and no
 * actions** — the roadmap forbids placeholder fake data, and every KPI card, table,
 * and form belongs to a later phase with its own completion gate. What they do show
 * is truthful: the active branch, the scope this surface will own, the phase that
 * brings it, and the verified backend limits it will have to respect.
 */
export function ManagerFoundationScreen({
  surface,
  title,
  subtitle,
  scope,
  boundaries,
}: ManagerFoundationScreenProps) {
  const branch = useManagerBranch();
  const definition = getManagerSurface(surface);
  // Every non-Me manager surface key is also its canonical registry icon name.
  const Icon = operationalIcons[surface];

  return (
    <PageShell
      title={title}
      subtitle={subtitle}
      actions={
        <Badge variant="info" aria-label={`Live data arrives in ${definition?.liveFrom}`}>
          Live data arrives in {definition?.liveFrom}
        </Badge>
      }
    >
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.55fr)]">
        <Card className="min-w-0">
          <div className="flex items-start gap-4">
            <span className="mt-0.5 shrink-0 text-text-muted">
              <Icon
                size={operationalIconSizes.pageState}
                weight={operationalIconWeights.default}
                aria-hidden
              />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight text-text-primary">
                This surface is not built yet
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
                The manager workspace foundation — shell, six-tab navigation, session guard, and
                branch switcher — is live. This surface stays intentionally empty until its phase
                ships, so nothing here can imply data that has not been read.
              </p>
              {definition?.summary ? (
                <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-text-primary">
                  {definition.summary}
                </p>
              ) : null}

              <h3 className="mt-6 text-xs font-bold uppercase tracking-[0.1em] text-text-muted">
                Planned scope
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                {scope.map((entry) => (
                  <li key={entry} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-border-strong" aria-hidden />
                    <span className="min-w-0">{entry}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>

        <div className="flex min-w-0 flex-col gap-5">
          <Card className="min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">
              Active branch
            </h3>
            <p className="mt-2 truncate text-lg font-bold tracking-tight text-text-primary" title={branch.branchName}>
              {branch.branchName}
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              {branch.isMultiBranch
                ? `Switching branch in the header re-scopes every manager read across your ${branch.options.length} branch memberships.`
                : "This account has a single branch membership, so every manager read is scoped to it."}
            </p>
          </Card>

          {boundaries?.length ? (
            <Card className="min-w-0 bg-status-warning-surface">
              <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-status-warning">
                Verified limits this surface must respect
              </h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-text-secondary">
                {boundaries.map((entry) => (
                  <li key={entry} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-status-warning" aria-hidden />
                    <span className="min-w-0">{entry}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}
