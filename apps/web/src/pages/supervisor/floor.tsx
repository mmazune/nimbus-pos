import type { GetServerSideProps } from "next";

import { SupervisorFloorScreen } from "@/components/supervisor/floor/SupervisorFloorScreen";
import { SupervisorShell } from "@/components/supervisor/shell";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function SupervisorFloorPage() {
  return (
    <SupervisorShell>
      <SupervisorFloorScreen />
    </SupervisorShell>
  );
}
