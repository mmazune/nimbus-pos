import type { GetServerSideProps } from "next";

import { AuditTrailScreen } from "@/components/manager/accounting/review/AuditTrailScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerAccountingAuditTrailPage() {
  return (
    <ManagerShell>
      <AuditTrailScreen />
    </ManagerShell>
  );
}
