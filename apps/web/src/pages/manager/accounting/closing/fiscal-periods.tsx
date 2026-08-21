import type { GetServerSideProps } from "next";

import { FiscalPeriodsScreen } from "@/components/manager/accounting/closing/FiscalPeriodsScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerAccountingFiscalPeriodsPage() {
  return (
    <ManagerShell>
      <FiscalPeriodsScreen />
    </ManagerShell>
  );
}
