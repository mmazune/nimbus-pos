import type { GetServerSideProps } from "next";

import { PostingErrorsScreen } from "@/components/manager/accounting/review/PostingErrorsScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerAccountingPostingErrorsPage() {
  return (
    <ManagerShell>
      <PostingErrorsScreen />
    </ManagerShell>
  );
}
