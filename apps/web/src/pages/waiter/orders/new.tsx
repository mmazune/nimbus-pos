import type { GetServerSideProps } from "next";

import { WaiterNewOrderScreen } from "@/components/waiter/orders";
import { WaiterShell } from "@/components/waiter/shell";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function WaiterNewOrderPage() {
  return (
    <WaiterShell>
      <WaiterNewOrderScreen />
    </WaiterShell>
  );
}
