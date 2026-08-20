import type { GetServerSideProps } from "next";

import { ManagerFoundationScreen } from "@/components/manager/foundation/ManagerFoundationScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function ManagerStaffPage() {
  return (
    <ManagerShell>
      <ManagerFoundationScreen
        surface="staff"
        title="Staff"
        subtitle="Roster, onboarding, Quick PIN administration, attendance, and leave or swap review."
        scope={[
          "Staff directory limited to safe fields, filtered to the selected branch.",
          "Frontline onboarding and Quick PIN administration with confirmations.",
          "Attendance review, leave review, and shift-swap review.",
        ]}
        boundaries={[
          "Compensation, contracts, payroll, bank details, tax IDs, and private HR notes are excluded from the manager workspace.",
          "The employee endpoint returns compensation on the wire and cannot be branch-filtered, so this surface needs an allow-list projection at the API-client boundary before it can ship.",
          "Approving a shift swap changes no roster rows on this backend, and this surface must not claim otherwise.",
        ]}
      />
    </ManagerShell>
  );
}
