import type { GetServerSideProps } from "next";

import { ManagerTablesScreen } from "@/components/manager/operations";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerOperationsTablesPage() {
  return (
    <ManagerShell>
      <ManagerTablesScreen />
    </ManagerShell>
  );
}
