import type { GetServerSideProps } from "next";

import { SupervisorShell } from "@/components/supervisor/shell";
import { ApprovalsScreen } from "@/screens/approvals/ApprovalsScreen";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

/**
 * T1 phase 5: the kit Approvals screen (drawing Supervisor-Approvals) on the
 * 5A approvals contract and each domain's own decision route.
 */
export default function SupervisorApprovalsPage() {
  return (
    <SupervisorShell bare>
      <ApprovalsScreen />
    </SupervisorShell>
  );
}
