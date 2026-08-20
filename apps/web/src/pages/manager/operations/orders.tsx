import type { GetServerSideProps } from "next";

import { ManagerOrdersScreen } from "@/components/manager/operations";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerOperationsOrdersPage() {
  return (
    <ManagerShell>
      <ManagerOrdersScreen />
    </ManagerShell>
  );
}
