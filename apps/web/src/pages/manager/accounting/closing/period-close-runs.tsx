import type { GetServerSideProps } from "next";

import { PeriodCloseRunsScreen } from "@/components/manager/accounting/closing/PeriodCloseRunsScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerAccountingPeriodCloseRunsPage() {
  return (
    <ManagerShell>
      <PeriodCloseRunsScreen />
    </ManagerShell>
  );
}
