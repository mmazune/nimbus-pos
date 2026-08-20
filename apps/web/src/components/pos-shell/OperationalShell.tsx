import { cn } from "@/lib/utils/cn";

import type { OperationalShellProps } from "./types";
export { operationalShellLayout } from "./layout";

/**
 * `navigation="top"` (Track B1, D-MGRTOPNAV) is an ADDITIVE variant: it only
 * removes the fixed bottom bar and its content clearance. Everything else —
 * header slot, readiness strip, idle handler, max content width — is identical
 * across both modes. Waiter/Cashier/Supervisor never pass `navigation`, so they
 * take the `"bottom"` default and render exactly the markup they always have.
 */
export function OperationalShell({
  bottomNavigation,
  children,
  header,
  idleHandler,
  navigation = "bottom",
  readiness,
}: OperationalShellProps) {
  return (
    <div className="min-h-screen bg-page" data-operational-shell data-operational-shell-nav={navigation}>
      {idleHandler}
      <div className="fixed inset-x-0 top-0 z-40">{header}</div>
      {/* Density pass 2026-08-20: header 4rem, readiness 2.25rem, 1rem gap. */}
      <div className="fixed inset-x-0 top-16 z-30 h-9">{readiness}</div>
      <main
        className={cn(
          "mx-auto min-h-screen w-full max-w-[1600px] px-3 pt-[7.25rem] sm:px-4 lg:px-6",
          navigation === "top" ? "pb-6" : "pb-[calc(5rem+env(safe-area-inset-bottom))]",
        )}
      >
        {children}
      </main>
      {navigation === "bottom" ? (
        <div className="fixed inset-x-0 bottom-0 z-40">{bottomNavigation}</div>
      ) : null}
    </div>
  );
}
