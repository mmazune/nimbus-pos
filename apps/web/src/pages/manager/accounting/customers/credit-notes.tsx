import type { GetServerSideProps } from "next";

import { CustomersCreditNotesScreen } from "@/components/manager/accounting/customers/CustomersCreditNotesScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerAccountingCustomerCreditNotesPage() {
  return (
    <ManagerShell>
      <CustomersCreditNotesScreen />
    </ManagerShell>
  );
}
