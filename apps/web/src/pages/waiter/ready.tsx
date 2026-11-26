import type { GetServerSideProps } from "next";

import { WaiterShell } from "@/components/waiter/shell";
import { ReadyScreen } from "@/screens/ready/ReadyScreen";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function WaiterReadyPage() {
  return (
    <WaiterShell bare>
      <ReadyScreen />
    </WaiterShell>
  );
}
