import type { GetServerSideProps } from "next";

import { BankAccountsScreen } from "@/components/manager/accounting/bank/BankAccountsScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerAccountingBankAccountsPage() {
  return (
    <ManagerShell>
      <BankAccountsScreen />
    </ManagerShell>
  );
}
