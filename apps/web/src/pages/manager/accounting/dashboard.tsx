import type { GetServerSideProps } from "next";

import { AccountingDashboard } from "@/components/manager/accounting";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

/**
 * The Accounting module's landing surface (Track B5.1) — the seventh Manager
 * module, approved as OD-3 on 2026-08-21.
 */
export default function ManagerAccountingDashboardPage() {
  return (
    <ManagerShell>
      <AccountingDashboard />
    </ManagerShell>
  );
}
