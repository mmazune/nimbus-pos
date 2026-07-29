import { useRouter } from "next/router";
import { useState } from "react";

import {
  OperationalStatusBadge,
  ProfileMetaGrid,
  ProfileSection,
  RoleProfileHero,
  SessionCard,
} from "@/components/profile";
import { PageShell } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useCashierContext } from "@/lib/cashier/context";
import { useCashierReadiness } from "@/lib/cashier/readiness";

export function CashierMeScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const context = useCashierContext();
  const readiness = useCashierReadiness();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleLogout() {
    setIsSigningOut(true);
    await logout();
    if (typeof window !== "undefined") {
      window.location.replace("/login?reason=logged_out");
      return;
    }
    void router.replace("/login?reason=logged_out");
  }

  const readinessFailed = readiness.shift.status === "failed" || readiness.till.status === "failed";
  const heroStatus = readinessFailed
    ? {
        label: "Operational issue",
        detail: readiness.shift.status === "failed" ? readiness.shift.detail : readiness.till.detail,
        tone: "danger" as const,
      }
    : readiness.shift.status === "active" && readiness.till.status === "active"
      ? { label: "Till active", detail: readiness.till.detail, tone: "success" as const }
      : readiness.shift.status === "active"
        ? { label: "Till required", detail: readiness.till.detail, tone: "warning" as const }
        : readiness.till.status === "active"
          ? { label: "Shift required", detail: "A till is active, but checkout remains blocked until the shift is active.", tone: "warning" as const }
          : { label: "Off shift", detail: readiness.shift.detail, tone: "neutral" as const };

  return (
    <PageShell title="Me" subtitle="Your cashier profile, till readiness, and secure session." className="mx-auto w-full max-w-[1420px]">
      <RoleProfileHero
        role="cashier"
        displayName={context.displayName}
        roleLabel={context.roleLabel}
        email={context.email}
        branchName={context.branchName}
        operationalLabel={heroStatus.label}
        operationalDetail={heroStatus.detail}
        operationalTone={heroStatus.tone}
        secondaryStatus={readiness.shift.label}
      />

      <ProfileSection id="cashier-readiness" title="Shift and till" description="Cash checkout requires both an active shift and an active till.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-md bg-surface-muted p-5">
            <OperationalStatusBadge label={readiness.shift.label} tone={readiness.shift.tone} />
            <h3 className="mt-4 text-base font-bold text-text-primary">Shift</h3>
            <p className="mt-1 text-sm leading-6 text-text-secondary">{readiness.shift.detail}</p>
          </div>
          <div className="rounded-md bg-surface-muted p-5">
            <OperationalStatusBadge label={readiness.till.label} tone={readiness.till.tone} />
            <h3 className="mt-4 text-base font-bold text-text-primary">Till</h3>
            <p className="mt-1 text-sm leading-6 text-text-secondary">{readiness.till.detail}</p>
          </div>
        </div>
      </ProfileSection>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <ProfileSection id="cashier-context" title="Branch and account context" description="Verified context for this cashier terminal.">
          <ProfileMetaGrid items={[
            { label: "Organization", value: context.organizationName },
            { label: "Branch", value: context.branchName },
            { label: "Role", value: context.roleLabel },
            { label: "Account", value: context.email },
            { label: "Workstation", value: context.workstationLabel },
            { label: "Branch access", value: context.branchId ? "Ready" : "Unavailable" },
          ]} />
        </ProfileSection>

        <SessionCard
          accountLabel={context.email}
          branchName={context.branchName}
          platform={context.sessionPlatform}
          source={context.sessionSource}
          createdAt={context.sessionCreatedAt}
          lastActivityAt={context.sessionLastActivityAt}
          idleMessage="Sign out before leaving this shared cashier terminal. Active till state is not changed by signing out."
          isSigningOut={isSigningOut}
          onSignOut={() => void handleLogout()}
        />
      </div>

      <ProfileSection id="cashier-boundaries" title="Cashier operating context" description="Role boundaries remain enforced by the existing permissions and checkout workflows.">
        <ProfileMetaGrid items={[
          { label: "Checkout", value: "Cashier workspace" },
          { label: "Cash payments", value: readiness.till.status === "active" ? "Till ready" : "Blocked until till is active" },
          { label: "Provider mode", value: "Manual and reference-based where configured" },
          { label: "Manager functions", value: "Not available in cashier profile" },
        ]} className="lg:grid-cols-4" />
      </ProfileSection>
    </PageShell>
  );
}
