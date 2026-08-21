import type { GetServerSideProps } from "next";

import { VendorsCreditNotesScreen } from "@/components/manager/accounting/vendors/VendorsCreditNotesScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerAccountingVendorCreditNotesPage() {
  return (
    <ManagerShell>
      <VendorsCreditNotesScreen />
    </ManagerShell>
  );
}
