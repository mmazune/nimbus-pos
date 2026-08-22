import type { GetServerSideProps } from "next";

import { PostingSourceMapsScreen } from "@/components/manager/accounting/configuration/PostingSourceMapsScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function ManagerAccountingPostingSourceMapsPage() {
  return (
    <ManagerShell>
      <PostingSourceMapsScreen />
    </ManagerShell>
  );
}
