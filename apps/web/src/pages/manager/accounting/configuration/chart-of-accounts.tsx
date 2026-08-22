import type { GetServerSideProps } from "next";

import { ChartOfAccountsScreen } from "@/components/manager/accounting/configuration/ChartOfAccountsScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerAccountingChartOfAccountsPage() {
  return (
    <ManagerShell>
      <ChartOfAccountsScreen />
    </ManagerShell>
  );
}
