import type { GetServerSideProps } from "next";

import { CashierReceiptsScreen } from "@/components/cashier/receipts";
import { CashierShell } from "@/components/cashier/shell";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function CashierReceiptsPage() {
  return (
    <CashierShell>
      <CashierReceiptsScreen />
    </CashierShell>
  );
}
