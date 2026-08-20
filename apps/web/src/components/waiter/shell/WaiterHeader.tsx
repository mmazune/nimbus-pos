import { OperationalHeader } from "@/components/pos-shell/OperationalHeader";
import { useStationTerminalLabel } from "@/components/pos-shell/station";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getPrimaryRoleLabel } from "@/lib/auth/role";
import { getProfileInitials } from "@/lib/profile/profile-model";

export function WaiterHeader() {
  const { branchName, displayName, user } = useAuth();
  // Station label, NOT backend data — see components/pos-shell/station.ts. The API
  // exposes no service-area record, so the terminal identifies itself instead of
  // printing a dead "Service area unavailable".
  const terminalLabel = useStationTerminalLabel();

  return (
    <OperationalHeader
      branchLabel={branchName || "Branch context unavailable"}
      contextKind="service-area"
      contextLabel={terminalLabel}
      displayName={displayName}
      initials={getProfileInitials(displayName)}
      roleLabel={getPrimaryRoleLabel(user)}
    />
  );
}
