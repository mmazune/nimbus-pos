import type { GetServerSideProps } from "next";

import { ManagerOverviewDashboard } from "@/components/manager/dashboard";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

/**
 * Manager landing surface. Track B1 shipped the honest foundation screen here;
 * Track B2 replaces it with the real KPI dashboard over the verified `/dash/*`
 * reads. Every other Manager surface keeps its foundation screen until its own
 * phase lands.
 */
export default function ManagerOverviewPage() {
  return (
    <ManagerShell>
      <ManagerOverviewDashboard />
    </ManagerShell>
  );
}
