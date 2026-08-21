import type { GetServerSideProps } from "next";

import { PostingRunsScreen } from "@/components/manager/accounting/review/PostingRunsScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerAccountingPostingRunsPage() {
  return (
    <ManagerShell>
      <PostingRunsScreen />
    </ManagerShell>
  );
}
