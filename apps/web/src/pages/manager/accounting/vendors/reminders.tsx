import type { GetServerSideProps } from "next";

import { VendorsRemindersScreen } from "@/components/manager/accounting/vendors/VendorsRemindersScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerAccountingVendorRemindersPage() {
  return (
    <ManagerShell>
      <VendorsRemindersScreen />
    </ManagerShell>
  );
}
