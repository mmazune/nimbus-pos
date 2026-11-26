import type { GetServerSideProps } from "next";

import { WaiterShell } from "@/components/waiter/shell";
import { MeScreen } from "@/screens/me/MeScreen";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function WaiterMePage() {
  return (
    <WaiterShell bare>
      <MeScreen role="waiter" />
    </WaiterShell>
  );
}
