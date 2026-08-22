import type { GetServerSideProps } from "next";

import { ManagerInvitationsScreen } from "@/components/manager/staff";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerStaffInvitationsPage() {
  return (
    <ManagerShell>
      <ManagerInvitationsScreen />
    </ManagerShell>
  );
}
