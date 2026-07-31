import type { GetServerSideProps } from "next";

import { SupervisorApprovalsWorkspace } from "@/components/supervisor/approvals/workspace";
import { SupervisorShell } from "@/components/supervisor/shell";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

/**
 * Supervisor Approvals — premium master-detail decision workspace (Prompt 5B1).
 *
 * Replaces the former read-only triple-query page. Discounts + Leave are fully
 * actionable; Shift-swaps + Anomalies render read-only through the same shared
 * queue/detail architecture (their live decisions land in Prompt 5B2). All queue
 * state (scope / domain / page / date range / selected record) is URL-persisted.
 */
export default function SupervisorApprovalsPage() {
  return (
    <SupervisorShell>
      <SupervisorApprovalsWorkspace />
    </SupervisorShell>
  );
}
