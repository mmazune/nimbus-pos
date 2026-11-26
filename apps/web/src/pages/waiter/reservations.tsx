import type { GetServerSideProps } from "next";

import { WaiterShell } from "@/components/waiter/shell";
import { ReservationsScreen } from "@/screens/reservations/ReservationsScreen";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function WaiterReservationsPage() {
  return (
    <WaiterShell bare>
      <ReservationsScreen role="waiter" />
    </WaiterShell>
  );
}
