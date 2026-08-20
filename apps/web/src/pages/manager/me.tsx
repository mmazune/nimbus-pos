import type { GetServerSideProps } from "next";

import { ManagerMeScreen } from "@/components/manager/me/ManagerMeScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function ManagerMePage() {
  return (
    <ManagerShell>
      <ManagerMeScreen />
    </ManagerShell>
  );
}
