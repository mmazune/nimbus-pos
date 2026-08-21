import type { GetServerSideProps } from "next";

import { ACCOUNTING_LANDING } from "@/lib/accounting/routes";

/**
 * Accounting is a MODULE, not a single page, so its root redirects to the first
 * real surface — the same pattern `/manager/operations` (B3), `/manager/staff`
 * (B3) and `/manager/reports` (B4) already use. B5.1 ships one surface; later
 * sub-phases add siblings without changing this redirect.
 */
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: ACCOUNTING_LANDING, permanent: false },
});

export default function ManagerAccountingIndexPage() {
  return null;
}
