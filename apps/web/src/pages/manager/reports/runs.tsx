import type { GetServerSideProps } from "next";

import { ManagerReportRunsScreen } from "@/components/manager/reports";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerReportsRunsPage() {
  return (
    <ManagerShell>
      <ManagerReportRunsScreen />
    </ManagerShell>
  );
}
