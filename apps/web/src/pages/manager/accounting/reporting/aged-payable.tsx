import type { GetServerSideProps } from "next";

import { AgedPayableScreen } from "@/components/manager/accounting/reporting/AgedPayableScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerAccountingAgedPayablePage() {
  return (
    <ManagerShell>
      <AgedPayableScreen />
    </ManagerShell>
  );
}
