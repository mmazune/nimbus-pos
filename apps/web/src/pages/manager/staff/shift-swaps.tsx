import type { GetServerSideProps } from "next";

import { ManagerShiftSwapReviewScreen } from "@/components/manager/staff";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerStaffShiftSwapsPage() {
  return (
    <ManagerShell>
      <ManagerShiftSwapReviewScreen />
    </ManagerShell>
  );
}
