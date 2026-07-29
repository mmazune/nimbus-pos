import { OperationalHeader } from "@/components/pos-shell/OperationalHeader";
import { useCashierContext } from "@/lib/cashier/context";
import { getProfileInitials } from "@/lib/profile/profile-model";

export function CashierHeader() {
  const cashierContext = useCashierContext();

  return (
    <OperationalHeader
      branchLabel={cashierContext.branchName}
      contextKind="workstation"
      contextLabel={cashierContext.workstationLabel}
      displayName={cashierContext.displayName}
      initials={getProfileInitials(cashierContext.displayName)}
      roleLabel={cashierContext.roleLabel}
    />
  );
}
