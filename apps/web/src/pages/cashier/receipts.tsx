import type { GetServerSideProps } from "next";

import { CashierShell } from "@/components/cashier/shell";
import { ReceiptsScreen } from "@/screens/receipts/ReceiptsScreen";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function CashierReceiptsPage() {
  return (
    <CashierShell bare>
      <ReceiptsScreen />
    </CashierShell>
  );
}
