import type { GetServerSideProps } from "next";

import { CashierTillScreen } from "@/components/cashier/till";
import { CashierShell } from "@/components/cashier/shell";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function CashierTillPage() {
  return (
    <CashierShell>
      <CashierTillScreen />
    </CashierShell>
  );
}
