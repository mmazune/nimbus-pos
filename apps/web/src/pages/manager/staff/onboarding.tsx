import type { GetServerSideProps } from "next";

import { ManagerOnboardingScreen } from "@/components/manager/staff";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerStaffOnboardingPage() {
  return (
    <ManagerShell>
      <ManagerOnboardingScreen />
    </ManagerShell>
  );
}
