import { OperationalHeader } from "@/components/pos-shell/OperationalHeader";
import { getProfileInitials } from "@/lib/profile/profile-model";
import { useSupervisorContext } from "@/lib/supervisor/context";

export function SupervisorHeader() {
  const supervisorContext = useSupervisorContext();

  return (
    <OperationalHeader
      branchLabel={supervisorContext.branchName}
      contextKind="workstation"
      contextLabel={supervisorContext.workstationLabel}
      displayName={supervisorContext.displayName}
      initials={getProfileInitials(supervisorContext.displayName)}
      roleLabel={supervisorContext.roleLabel}
    />
  );
}
