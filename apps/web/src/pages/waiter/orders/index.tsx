import type { GetServerSideProps } from "next";

import { WaiterOrdersQueueScreen } from "@/components/waiter/orders";
import { WaiterShell } from "@/components/waiter/shell";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function WaiterOrdersPage() {
  return (
    <WaiterShell>
      <WaiterOrdersQueueScreen />
    </WaiterShell>
  );
}
