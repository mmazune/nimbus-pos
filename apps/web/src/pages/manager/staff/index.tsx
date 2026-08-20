import type { GetServerSideProps } from "next";

import { MANAGER_STAFF_LANDING } from "@/lib/manager/staff-route";

/**
 * Track B3 replaces the M-P1 honest-foundation screen at `/manager/staff` with
 * five real surfaces, so the module root redirects to the directory — the same
 * pattern `/manager` → `/manager/overview` already uses.
 */
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: MANAGER_STAFF_LANDING, permanent: false },
});

export default function ManagerStaffIndexPage() {
  return null;
}
