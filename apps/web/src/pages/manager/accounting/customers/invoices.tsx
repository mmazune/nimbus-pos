import type { GetServerSideProps } from "next";

import { CustomersInvoicesScreen } from "@/components/manager/accounting/customers/CustomersInvoicesScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerAccountingCustomerInvoicesPage() {
  return (
    <ManagerShell>
      <CustomersInvoicesScreen />
    </ManagerShell>
  );
}
