import type { GetServerSideProps } from "next";

import { SupervisorShell } from "@/components/supervisor/shell";
import { MeScreen } from "@/screens/me/MeScreen";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function SupervisorMePage() {
  return (
    <SupervisorShell bare>
      <MeScreen role="supervisor" />
    </SupervisorShell>
  );
}
