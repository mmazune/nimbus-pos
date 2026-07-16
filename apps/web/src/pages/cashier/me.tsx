import type { GetServerSideProps } from "next";

import { CashierMeScreen } from "@/components/cashier/me";
import { CashierShell } from "@/components/cashier/shell";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function CashierMePage() {
  return (
    <CashierShell>
      <CashierMeScreen />
    </CashierShell>
  );
}
