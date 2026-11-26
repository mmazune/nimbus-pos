import type { GetServerSideProps } from "next";

import { CashierShell } from "@/components/cashier/shell";
import { TillScreen } from "@/screens/till/TillScreen";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function CashierTillPage() {
  return (
    <CashierShell bare>
      <TillScreen />
    </CashierShell>
  );
}
