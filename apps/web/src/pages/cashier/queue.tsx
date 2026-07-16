import type { GetServerSideProps } from "next";

import { CashierQueueScreen } from "@/components/cashier/queue";
import { CashierShell } from "@/components/cashier/shell";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function CashierQueuePage() {
  return (
    <CashierShell>
      <CashierQueueScreen />
    </CashierShell>
  );
}
