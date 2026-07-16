import { ReactNode } from "react";

type CashierLogoutPanelProps = {
  isLoggingOut: boolean;
  action: ReactNode;
};

export function CashierLogoutPanel({ isLoggingOut, action }: CashierLogoutPanelProps) {
  return (
    <section className="rounded-lg bg-surface-muted p-4" aria-labelledby="cashier-logout-title">
      <h3 id="cashier-logout-title" className="text-sm font-bold text-text-primary">
        Logout
      </h3>
      <p className="mt-1 text-sm leading-6 text-text-secondary">
        End cashier session calls the existing auth logout flow, then returns this terminal to login.
      </p>
      <div className="mt-4">{action}</div>
      {isLoggingOut ? (
        <p className="mt-3 text-sm font-semibold text-text-muted" aria-live="polite">
          Ending cashier session.
        </p>
      ) : null}
    </section>
  );
}
