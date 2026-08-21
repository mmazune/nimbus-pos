import type { GetServerSideProps } from "next";

import { VendorsRecurringScreen } from "@/components/manager/accounting/vendors/VendorsRecurringScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerAccountingVendorRecurringPage() {
  return (
    <ManagerShell>
      <VendorsRecurringScreen />
    </ManagerShell>
  );
}
