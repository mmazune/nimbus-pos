import type { GetServerSideProps } from "next";

import { ReconciliationScreen } from "@/components/manager/accounting/bank/ReconciliationScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerAccountingBankReconciliationPage() {
  return (
    <ManagerShell>
      <ReconciliationScreen />
    </ManagerShell>
  );
}
