import type { GetServerSideProps } from "next";

import { CashierShell } from "@/components/cashier/shell";
import { MeScreen } from "@/screens/me/MeScreen";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function CashierMePage() {
  return (
    <CashierShell bare>
      <MeScreen role="cashier" />
    </CashierShell>
  );
}
