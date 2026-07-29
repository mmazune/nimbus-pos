import { OperationalHeader } from "@/components/pos-shell/OperationalHeader";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getPrimaryRoleLabel } from "@/lib/auth/role";
import { getProfileInitials } from "@/lib/profile/profile-model";

export function WaiterHeader() {
  const { branchName, displayName, user } = useAuth();

  return (
    <OperationalHeader
      branchLabel={branchName || "Branch context unavailable"}
      contextKind="service-area"
      contextLabel="Service area unavailable"
      displayName={displayName}
      initials={getProfileInitials(displayName)}
      roleLabel={getPrimaryRoleLabel(user)}
    />
  );
}
