import type { GetServerSideProps } from "next";

import { WaiterFloorScreen } from "@/components/waiter/floor";
import { WaiterShell } from "@/components/waiter/shell";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function WaiterFloorPage() {
  return (
    <WaiterShell>
      <WaiterFloorScreen />
    </WaiterShell>
  );
}
