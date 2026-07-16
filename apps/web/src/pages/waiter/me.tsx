import type { GetServerSideProps } from "next";

import { WaiterMeScreen } from "@/components/waiter/me";
import { WaiterShell } from "@/components/waiter/shell";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function WaiterMePage() {
  return (
    <WaiterShell>
      <WaiterMeScreen />
    </WaiterShell>
  );
}
