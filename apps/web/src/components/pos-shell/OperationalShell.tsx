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
      <div className="fixed inset-x-0 top-20 z-30 h-11">{readiness}</div>
      <main className="mx-auto min-h-screen w-full max-w-[1600px] px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-40 sm:px-6 lg:px-8">
        {children}
      </main>
      <div className="fixed inset-x-0 bottom-0 z-40">{bottomNavigation}</div>
    </div>
  );
}
