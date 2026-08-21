import type { GetServerSideProps } from "next";

import { BankStatementsScreen } from "@/components/manager/accounting/bank/BankStatementsScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerAccountingBankStatementsPage() {
  return (
    <ManagerShell>
      <BankStatementsScreen />
    </ManagerShell>
  );
}
