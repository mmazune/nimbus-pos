import type { GetServerSideProps } from "next";

import { CustomersAccountsScreen } from "@/components/manager/accounting/customers/CustomersAccountsScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerAccountingCustomerAccountsPage() {
  return (
    <ManagerShell>
      <CustomersAccountsScreen />
    </ManagerShell>
  );
}
