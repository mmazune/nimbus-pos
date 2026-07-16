import type { GetServerSideProps } from "next";

import { SupervisorMeScreen } from "@/components/supervisor/me";
import { SupervisorShell } from "@/components/supervisor/shell";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function SupervisorMePage() {
  return (
    <SupervisorShell>
      <SupervisorMeScreen />
    </SupervisorShell>
  );
}
