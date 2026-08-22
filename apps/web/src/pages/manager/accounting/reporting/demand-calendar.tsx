import type { GetServerSideProps } from "next";

import { DemandCalendarScreen } from "@/components/manager/accounting/reporting/DemandCalendarScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerAccountingDemandCalendarPage() {
  return (
    <ManagerShell>
      <DemandCalendarScreen />
    </ManagerShell>
  );
}
