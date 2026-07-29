import { OperationalBottomNav } from "@/components/pos-shell/OperationalBottomNav";
import { getOperationalRoleNavigation } from "@/components/pos-shell/role-navigation";

export function CashierBottomNav() {
  return (
    <OperationalBottomNav
      ariaLabel="Cashier navigation"
      items={getOperationalRoleNavigation("cashier")}
    />
  );
}
