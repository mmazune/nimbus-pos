import { Button } from "@/components/ui";
import { formatProfileDateTime } from "@/lib/profile/profile-model";

import { ProfileMetaGrid } from "./ProfileMetaGrid";
import { ProfileSection } from "./ProfileSection";

type SessionCardProps = {
  accountLabel: string;
  branchName: string;
  platform?: string | null;
  source?: string | null;
  createdAt?: string | null;
  lastActivityAt?: string | null;
  idleMessage?: string;
  isSigningOut?: boolean;
  onSignOut: () => void;
};

export function SessionCard({
  accountLabel,
  branchName,
  platform,
  source,
  createdAt,
  lastActivityAt,
  idleMessage,
  isSigningOut = false,
  onSignOut,
}: SessionCardProps) {
  return (
    <ProfileSection
      id="session"
      title="Session and sign out"
      description={idleMessage || "Use sign out before leaving a shared terminal."}
    >
      <ProfileMetaGrid
        items={[
          { label: "Account", value: accountLabel },
          { label: "Branch", value: branchName },
          { label: "Platform", value: platform || "Not available" },
          { label: "Sign-in source", value: source || "Not available" },
          { label: "Session started", value: formatProfileDateTime(createdAt) },
          { label: "Last activity", value: formatProfileDateTime(lastActivityAt) },
        ]}
      />
      <Button
        className="mt-6 min-h-11 w-full sm:w-auto"
        variant="secondary"
        disabled={isSigningOut}
        onClick={onSignOut}
      >
        {isSigningOut ? "Signing out" : "Sign out"}
      </Button>
      {isSigningOut ? <p className="mt-3 text-sm text-text-secondary" aria-live="polite">Signing out securely.</p> : null}
    </ProfileSection>
  );
}

