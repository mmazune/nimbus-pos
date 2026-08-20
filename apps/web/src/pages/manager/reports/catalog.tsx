import type { GetServerSideProps } from "next";

import { ManagerReportCatalogScreen } from "@/components/manager/reports";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerReportsCatalogPage() {
  return (
    <ManagerShell>
      <ManagerReportCatalogScreen />
    </ManagerShell>
  );
}
