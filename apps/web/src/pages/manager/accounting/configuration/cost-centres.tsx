import type { GetServerSideProps } from "next";

import { CostCentresScreen } from "@/components/manager/accounting/configuration/CostCentresScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerAccountingCostCentresPage() {
  return (
    <ManagerShell>
      <CostCentresScreen />
    </ManagerShell>
  );
}
