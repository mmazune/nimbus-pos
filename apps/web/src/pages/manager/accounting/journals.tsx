import type { GetServerSideProps } from "next";

import { JournalsScreen } from "@/components/manager/accounting/core/JournalsScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerAccountingJournalsPage() {
  return (
    <ManagerShell>
      <JournalsScreen />
    </ManagerShell>
  );
}
