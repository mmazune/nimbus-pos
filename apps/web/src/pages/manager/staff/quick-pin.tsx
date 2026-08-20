import type { GetServerSideProps } from "next";

import { ManagerQuickPinScreen } from "@/components/manager/staff";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerStaffQuickPinPage() {
  return (
    <ManagerShell>
      <ManagerQuickPinScreen />
    </ManagerShell>
  );
}
