import type { GetServerSideProps } from "next";

import { MANAGER_OPERATIONS_LANDING } from "@/lib/manager/operations-route";

/**
 * Track B3 replaces the M-P1 honest-foundation screen at `/manager/operations`
 * with three real oversight surfaces, so the module root redirects to the first
 * of them — the same pattern `/manager` → `/manager/overview` already uses.
 */
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: MANAGER_OPERATIONS_LANDING, permanent: false },
});

export default function ManagerOperationsIndexPage() {
  return null;
}
