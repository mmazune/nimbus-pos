import type { OperationalShellProps } from "./types";
export { operationalShellLayout } from "./layout";

export function OperationalShell({
  bottomNavigation,
  children,
  header,
  idleHandler,
  readiness,
}: OperationalShellProps) {
  return (
    <div className="min-h-screen bg-page" data-operational-shell>
      {idleHandler}
      <div className="fixed inset-x-0 top-0 z-40">{header}</div>
      {/* Density pass 2026-08-20: header 4rem, readiness 2.25rem, 1rem gap. */}
      <div className="fixed inset-x-0 top-16 z-30 h-9">{readiness}</div>
      <main className="mx-auto min-h-screen w-full max-w-[1600px] px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-[7.25rem] sm:px-4 lg:px-6">
        {children}
      </main>
      <div className="fixed inset-x-0 bottom-0 z-40">{bottomNavigation}</div>
    </div>
  );
}
