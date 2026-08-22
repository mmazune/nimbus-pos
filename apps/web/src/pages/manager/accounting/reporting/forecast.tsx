import type { GetServerSideProps } from "next";

import { ForecastScreen } from "@/components/manager/accounting/reporting/ForecastScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerAccountingForecastPage() {
  return (
    <ManagerShell>
      <ForecastScreen />
    </ManagerShell>
  );
}
