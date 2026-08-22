import type { GetServerSideProps } from "next";

import { BudgetsScreen } from "@/components/manager/accounting/reporting/BudgetsScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerAccountingBudgetsPage() {
  return (
    <ManagerShell>
      <BudgetsScreen />
    </ManagerShell>
  );
}
