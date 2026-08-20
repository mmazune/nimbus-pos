import type { GetServerSideProps } from "next";

import { ManagerFoundationScreen } from "@/components/manager/foundation/ManagerFoundationScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function ManagerOperationsPage() {
  return (
    <ManagerShell>
      <ManagerFoundationScreen
        surface="operations"
        title="Operations"
        subtitle="Read-only oversight of the selected branch's active service."
        scope={[
          "Floor and table status rendered through the shared operational floor, read-only.",
          "Orders and reservations oversight for the selected branch, with bounded pagination.",
          "Operational exceptions and escalations surfaced for review.",
        ]}
        boundaries={[
          "Oversight only: no checkout, no tender panel, no order builder, no order close.",
          "No tills or shifts tables — the branch-wide list routes do not exist on this backend.",
        ]}
      />
    </ManagerShell>
  );
}
