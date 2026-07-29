import { Card } from "@/components/ui";
import {
  getProfileInitials,
  getRoleAccent,
  type OperationalTone,
  type ProfileRole,
} from "@/lib/profile/profile-model";
import { cn } from "@/lib/utils/cn";

import { OperationalStatusBadge } from "./OperationalStatusBadge";

type RoleProfileHeroProps = {
  role: ProfileRole;
  displayName: string;
  roleLabel?: string;
  email?: string | null;
  branchName?: string | null;
  serviceArea?: string | null;
  operationalLabel: string;
  operationalDetail: string;
  operationalTone: OperationalTone;
  secondaryStatus?: string;
};

export function RoleProfileHero({
  role,
  displayName,
  roleLabel,
  email,
  branchName,
  serviceArea,
  operationalLabel,
  operationalDetail,
  operationalTone,
  secondaryStatus,
}: RoleProfileHeroProps) {
  const accent = getRoleAccent(role);
  const initials = getProfileInitials(displayName, email || "");

  return (
    <Card className="overflow-hidden p-0">
      <div className="grid min-h-52 lg:grid-cols-[220px_minmax(0,1fr)_minmax(260px,0.62fr)]">
        <div className={cn("flex flex-col justify-between p-6", accent.heroClassName)}>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-current/75">Nimbus profile</p>
          <div>
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface/95 text-2xl font-bold tracking-tight text-text-primary shadow-panel">
              {initials}
            </div>
            <p className="mt-4 text-sm font-semibold text-current/80">{roleLabel || accent.label}</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-center px-6 py-7 lg:px-8">
          <p className={cn("text-xs font-bold uppercase tracking-[0.12em]", accent.textClassName)}>
            {accent.label} account
          </p>
          <h2 className="mt-2 text-balance text-3xl font-bold tracking-tight text-text-primary">
            {displayName}
          </h2>
          {email ? <p className="mt-2 truncate text-sm text-text-secondary">{email}</p> : null}
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {branchName ? (
              <p>
                <span className="text-text-muted">Branch</span>{" "}
                <span className="font-semibold text-text-primary">{branchName}</span>
              </p>
            ) : null}
            {serviceArea ? (
              <p>
                <span className="text-text-muted">Service area</span>{" "}
                <span className="font-semibold text-text-primary">{serviceArea}</span>
              </p>
            ) : null}
          </div>
        </div>

        <div className={cn("flex flex-col justify-center p-6 lg:p-7", accent.softClassName)}>
          <OperationalStatusBadge label={operationalLabel} tone={operationalTone} className="self-start" />
          <p className="mt-4 text-xl font-bold tracking-tight text-text-primary">Current status</p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-text-secondary">{operationalDetail}</p>
          {secondaryStatus ? (
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">
              {secondaryStatus}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

