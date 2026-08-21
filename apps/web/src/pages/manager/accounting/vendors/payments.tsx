import type { GetServerSideProps } from "next";

import { VendorsPaymentsScreen } from "@/components/manager/accounting/vendors/VendorsPaymentsScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerAccountingVendorPaymentsPage() {
  return (
    <ManagerShell>
      <VendorsPaymentsScreen />
    </ManagerShell>
  );
}
