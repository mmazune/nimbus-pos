import type { GetServerSideProps } from "next";

import { VendorsSuppliersScreen } from "@/components/manager/accounting/vendors/VendorsSuppliersScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerAccountingVendorSuppliersPage() {
  return (
    <ManagerShell>
      <VendorsSuppliersScreen />
    </ManagerShell>
  );
}
