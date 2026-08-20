import { useRouter } from "next/router";
import { useState } from "react";

import { Badge, Button, Card } from "@/components/ui";
import { ManagerContentShell, ManagerControlPanel } from "@/components/manager/chrome";
import {
  ProfileMetaGrid,
  ProfileSection,
  RoleProfileHero,
  type ProfileMetaItem,
} from "@/components/profile";
import { operationalIcons, operationalIconSizes, operationalIconWeights } from "@/components/pos-shell/role-icons";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useManagerBranch } from "@/lib/manager/branch-context";
import { useManagerContext } from "@/lib/manager/context";
import { managerExcludedSurfaces } from "@/lib/manager/permissions";
import { formatProfileDateTime } from "@/lib/profile/profile-model";

/**
 * Manager Me (M-P1).
 *
 * Every value here comes from the ONE `/api/auth/me` payload the shell already
 * fetched — identity, session, memberships, permission count. No extra request, no
 * HR/employee read (that endpoint returns compensation on the wire, MP0-01), and no
 * fabricated shift/attendance state. Presentation is the shared `components/profile`
 * primitive set, with Manager as the fourth `roleAccentMap` consumer.
 */
export function ManagerMeScreen() {
  const router = useRouter();
  const { logout, user } = useAuth();
  const managerContext = useManagerContext();
  const branch = useManagerBranch();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const LogoutIcon = operationalIcons.logout;
  const BranchIcon = operationalIcons.branch;

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    await logout();
    if (typeof window !== "undefined") {
      window.location.replace("/login?reason=logged_out");
      return;
    }
    void router.replace("/login?reason=logged_out");
  }

  const identityItems: ProfileMetaItem[] = [
    { label: "Email", value: managerContext.email },
    { label: "Job role", value: managerContext.jobRole },
    { label: "Organization", value: managerContext.organizationName },
    { label: "Employee record", value: managerContext.employeeLabel },
  ];

  const sessionItems: ProfileMetaItem[] = [
    { label: "Session platform", value: managerContext.sessionPlatform },
    { label: "Session source", value: managerContext.sessionSource },
    { label: "Session started", value: formatProfileDateTime(managerContext.sessionCreatedAt) },
    { label: "Last activity", value: formatProfileDateTime(managerContext.sessionLastActivityAt) },
  ];

  return (
    <ManagerContentShell>
      <ManagerControlPanel
        title="Manager profile"
        secondaryActions={
          <Button
            variant="secondary"
            aria-busy={isLoggingOut}
            disabled={isLoggingOut}
            leadingIcon={
              <LogoutIcon
                size={operationalIconSizes.compactAction}
                weight={operationalIconWeights.default}
                aria-hidden
              />
            }
            onClick={handleLogout}
          >
            {isLoggingOut ? "Logging out" : "Log out"}
          </Button>
        }
      />
      <p className="max-w-2xl text-sm text-text-secondary">
        Identity, session, and branch context for this manager workspace.
      </p>
      <div className="flex min-w-0 flex-col gap-5">
        <RoleProfileHero
          role="manager"
          displayName={managerContext.displayName}
          roleLabel={managerContext.roleLabel}
          email={user?.email}
          branchName={managerContext.branchName}
          operationalLabel={branch.isReady ? "Branch selected" : "Select branch"}
          operationalDetail={
            branch.isMultiBranch
              ? `This account holds ${managerContext.membershipCount} active branch memberships. The header switcher decides which branch every manager read is scoped to.`
              : "This account holds a single active branch membership, so every manager read is scoped to it."
          }
          operationalTone={branch.isReady ? "success" : "warning"}
          secondaryStatus={`${managerContext.permissionCount} permissions on this session`}
        />

        <ProfileSection
          id="manager-identity"
          title="Identity"
          description="Read from the authenticated /api/auth/me context."
        >
          <ProfileMetaGrid items={identityItems} />
        </ProfileSection>

        <ProfileSection
          id="manager-memberships"
          title="Branch memberships"
          description="Active memberships from this session. Selecting one here is the same action as the header switcher."
        >
          <ul className="grid gap-3 sm:grid-cols-2">
            {branch.options.map((option) => {
              const active = option.branchId === branch.branchId;
              return (
                <li key={option.branchId}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => branch.selectBranch(option.branchId)}
                    className={`flex min-h-16 w-full items-center gap-3 rounded-md border px-4 py-3 text-left transition-[background-color,border-color] duration-150 ease-out ${
                      active
                        ? "border-brand-navy-900 bg-role-manager-soft"
                        : "border-border-subtle bg-surface hover:bg-surface-muted"
                    }`}
                  >
                    <BranchIcon
                      className="shrink-0 text-text-muted"
                      size={operationalIconSizes.compactAction}
                      weight={operationalIconWeights.default}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-text-primary">
                        {option.branchName}
                      </span>
                      <span className="block truncate text-xs text-text-muted">
                        {option.organizationName || managerContext.organizationName}
                      </span>
                    </span>
                    {option.isDefaultBranch ? <Badge variant="neutral">Default</Badge> : null}
                    {active ? <Badge variant="success">Active</Badge> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </ProfileSection>

        <ProfileSection
          id="manager-session"
          title="Session"
          description="Manager sessions share the operational idle-logout mechanism; inactivity returns you to login."
        >
          <ProfileMetaGrid items={sessionItems} />
        </ProfileSection>

        <ProfileSection
          id="manager-restricted"
          title="Restricted surfaces"
          description="This session holds permissions for the surfaces below, but the approved manager scope excludes them. The workspace never opens them."
        >
          <ul className="flex flex-col gap-3">
            {managerExcludedSurfaces.map((surface) => (
              <li key={surface.label}>
                <Card className="bg-surface-muted" padded>
                  <p className="text-sm font-semibold text-text-primary">{surface.label}</p>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">{surface.detail}</p>
                </Card>
              </li>
            ))}
          </ul>
        </ProfileSection>
      </div>
    </ManagerContentShell>
  );
}
