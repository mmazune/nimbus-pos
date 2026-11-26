import type { GetServerSideProps } from "next";

import { SupervisorShell } from "@/components/supervisor/shell";
import { ReservationsScreen } from "@/screens/reservations/ReservationsScreen";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

/**
 * T1 phase 2: the kit Reservations screen (drawing Reservations-Supervisor)
 * replaces the Prompt 4B workspace page. Same endpoints, same transitions.
 */
export default function SupervisorReservationsPage() {
  return (
    <SupervisorShell bare>
      <ReservationsScreen role="supervisor" />
    </SupervisorShell>
  );
}
