import type { GetServerSideProps } from "next";

import { KitchenShell } from "@/components/kitchen/KitchenShell";
import { DoneScreen } from "@/screens/kitchen/DoneScreen";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function KitchenDoneScreenPage() {
  return (
    <KitchenShell>
      <DoneScreen />
    </KitchenShell>
  );
}
