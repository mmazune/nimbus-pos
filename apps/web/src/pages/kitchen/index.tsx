import type { GetServerSideProps } from "next";

import { KitchenShell } from "@/components/kitchen/KitchenShell";
import { TicketsScreen } from "@/screens/kitchen/TicketsScreen";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function KitchenTicketsScreenPage() {
  return (
    <KitchenShell>
      <TicketsScreen />
    </KitchenShell>
  );
}
