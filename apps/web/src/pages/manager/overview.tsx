import type { GetServerSideProps } from "next";

import { ManagerFoundationScreen } from "@/components/manager/foundation/ManagerFoundationScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function ManagerOverviewPage() {
  return (
    <ManagerShell>
      <ManagerFoundationScreen
        surface="overview"
        title="Manager overview"
        subtitle="Branch performance, operational load, staff coverage, and pending exceptions."
        scope={[
          "Today KPIs for the selected branch: sales, open orders, coverage counts, pending approvals, low stock, anomalies.",
          "Payment mix, open-orders, low-stock, and pending-approvals snapshots.",
          "A live metrics stream with an explicit degraded state when the stream is unavailable.",
        ]}
        boundaries={[
          "Tills and shifts can only ever be counts — this backend has no branch-wide tills or shifts list.",
          "Approval counts must be filtered client-side first: the approvals list is only partly branch-scoped.",
          "Sales figures must be labelled precisely: the backend's net figure is tax-inclusive and its gross figure is not.",
        ]}
      />
    </ManagerShell>
  );
}
