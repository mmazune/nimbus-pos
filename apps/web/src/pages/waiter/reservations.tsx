import type { GetServerSideProps } from "next";

import { WaiterReservationsScreen } from "@/components/waiter/reservations";
import { WaiterShell } from "@/components/waiter/shell";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function WaiterReservationsPage() {
  return (
    <WaiterShell>
      <WaiterReservationsScreen />
    </WaiterShell>
  );
}
