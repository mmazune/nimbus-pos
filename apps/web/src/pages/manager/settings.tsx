import type { GetServerSideProps } from "next";

import { ManagerFoundationScreen } from "@/components/manager/foundation/ManagerFoundationScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function ManagerSettingsPage() {
  return (
    <ManagerShell>
      <ManagerFoundationScreen
        surface="settings"
        title="Settings"
        subtitle="Branch profile and device registry for the selected branch."
        scope={[
          "Branch profile for the selected branch, read-only.",
          "Device registry with activation status and printer routing metadata.",
          "Terminal pairing presented as the stub it is.",
        ]}
        boundaries={[
          "The branch profile is read-only — this backend has no branch-update route.",
          "Printer routes are metadata only: no print-driver invocation.",
          "Terminal pairing is a stub: no acquirer or card-terminal traffic.",
          "Owner and admin settings, alert rules, sync-conflict resolution, and SaaS billing are outside the manager workspace.",
        ]}
      />
    </ManagerShell>
  );
}
