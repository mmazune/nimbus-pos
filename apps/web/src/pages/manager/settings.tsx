import type { GetServerSideProps } from "next";

import { ManagerSettingsScreen } from "@/components/manager/settings";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

/**
 * Manager Settings — Track B6. Replaces the M-P1 honest foundation page with the
 * real org-settings editor: Currency, Tax & VAT, Rounding, Approval thresholds,
 * Reservations & receipts, Attendance & inventory, Exchange rates. See
 * `docs/manager-settings-docs/MANAGER_SETTINGS_API_MATRIX.md` for the full
 * endpoint census and what is deliberately not built here (device/printer/
 * terminal registry, Platform access, Booking policies).
 */
export default function ManagerSettingsPage() {
  return (
    <ManagerShell>
      <ManagerSettingsScreen />
    </ManagerShell>
  );
}
