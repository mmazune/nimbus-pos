import type { GetServerSideProps } from "next";

import { AgedReceivableScreen } from "@/components/manager/accounting/reporting/AgedReceivableScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerAccountingAgedReceivablePage() {
  return (
    <ManagerShell>
      <AgedReceivableScreen />
    </ManagerShell>
  );
}
