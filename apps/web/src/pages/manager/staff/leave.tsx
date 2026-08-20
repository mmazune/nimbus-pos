import type { GetServerSideProps } from "next";

import { ManagerLeaveReviewScreen } from "@/components/manager/staff";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerStaffLeavePage() {
  return (
    <ManagerShell>
      <ManagerLeaveReviewScreen />
    </ManagerShell>
  );
}
