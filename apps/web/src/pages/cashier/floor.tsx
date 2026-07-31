import type { GetServerSideProps } from "next";

import { CashierFloorScreen } from "@/components/cashier/floor";
import { CashierShell } from "@/components/cashier/shell";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function CashierFloorPage() {
  return (
    <CashierShell>
      <CashierFloorScreen />
    </CashierShell>
  );
}
