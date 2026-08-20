import type { GetServerSideProps } from "next";

import { MANAGER_REPORTS_LANDING } from "@/lib/manager/reports-route";

/**
 * Track B4 replaces the M-P1 honest-foundation screen at `/manager/reports`
 * with two real surfaces, so the module root redirects to the first of them —
 * the same pattern `/manager/operations` and `/manager/staff` already use.
 *
 * The B2 Overview's Sales card drills into `/manager/reports`, so this redirect
 * is what makes that link land on the catalog rather than a dead page.
 */
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: MANAGER_REPORTS_LANDING, permanent: false },
});

export default function ManagerReportsIndexPage() {
  return null;
}
