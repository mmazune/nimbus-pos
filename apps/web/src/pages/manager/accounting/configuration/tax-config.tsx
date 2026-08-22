import type { GetServerSideProps } from "next";

import { TaxConfigScreen } from "@/components/manager/accounting/configuration/TaxConfigScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerAccountingTaxConfigPage() {
  return (
    <ManagerShell>
      <TaxConfigScreen />
    </ManagerShell>
  );
}
