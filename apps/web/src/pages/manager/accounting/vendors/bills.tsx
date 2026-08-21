import type { GetServerSideProps } from "next";

import { VendorsBillsScreen } from "@/components/manager/accounting/vendors/VendorsBillsScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerAccountingVendorBillsPage() {
  return (
    <ManagerShell>
      <VendorsBillsScreen />
    </ManagerShell>
  );
}
