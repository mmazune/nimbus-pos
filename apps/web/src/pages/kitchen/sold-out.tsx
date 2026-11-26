import type { GetServerSideProps } from "next";

import { KitchenShell } from "@/components/kitchen/KitchenShell";
import { SoldOutScreen } from "@/screens/kitchen/SoldOutScreen";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function KitchenSoldOutScreenPage() {
  return (
    <KitchenShell>
      <SoldOutScreen />
    </KitchenShell>
  );
}
