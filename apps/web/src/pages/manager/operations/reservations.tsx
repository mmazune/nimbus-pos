import type { GetServerSideProps } from "next";

import { ManagerReservationsScreen } from "@/components/manager/operations";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerOperationsReservationsPage() {
  return (
    <ManagerShell>
      <ManagerReservationsScreen />
    </ManagerShell>
  );
}
