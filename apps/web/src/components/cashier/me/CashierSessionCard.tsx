import { ClockClockwise, Key, SignOut, ShieldCheck, Storefront } from "@phosphor-icons/react";
import type { ReactNode } from "react";

import { Badge, Button, Card } from "@/components/ui";
import type { CashierWorkspaceContext } from "@/lib/cashier/context";

import { CashierLogoutPanel } from "./CashierLogoutPanel";

type CashierSessionCardProps = {
  context: CashierWorkspaceContext;
  isAuthenticated: boolean;
  isCashier: boolean;
  isLoading: boolean;
  branchReady: boolean;
  isLoggingOut: boolean;
  onLogout: () => void;
};

function formatSessionTime(value: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function SessionStatusRow({
  icon,
  label,
  status,
  detail,
  variant,
}: {
  icon: ReactNode;
  label: string;
  status: string;
  detail: string;
  variant: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  return (
    <li className="flex items-start justify-between gap-4 rounded-md bg-surface-muted p-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 text-brand-navy-900">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-text-primary">{label}</p>
          <p className="mt-1 text-xs leading-5 text-text-secondary">{detail}</p>
        </div>
      </div>
      <Badge variant={variant} className="shrink-0">
        {status}
      </Badge>
    </li>
  );
}

export function CashierSessionCard({
  context,
  isAuthenticated,
  isCashier,
  isLoading,
  branchReady,
  isLoggingOut,
  onLogout,
}: CashierSessionCardProps) {
  const sessionState = isLoading ? "Loading" : isAuthenticated ? "Active" : "Not signed in";
  const sessionVariant = isLoading ? "info" : isAuthenticated ? "success" : "danger";

  return (
    <Card aria-labelledby="cashier-session-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-normal text-text-muted">Session</p>
          <h2 id="cashier-session-title" className="mt-1 text-lg font-bold tracking-normal text-text-primary">
            Current Login
          </h2>
        </div>
        <Badge variant={sessionVariant}>{sessionState}</Badge>
      </div>

      <ul className="mt-5 grid gap-3">
        <SessionStatusRow
          icon={<Key size={18} weight="bold" aria-hidden />}
          label="Login state"
          status={sessionState}
          detail={`Source: ${context.sessionSource || "Not available"}. Platform: ${context.sessionPlatform || "Not available"}.`}
          variant={sessionVariant}
        />
        <SessionStatusRow
          icon={<ShieldCheck size={18} weight="bold" aria-hidden />}
          label="Cashier access"
          status={isCashier ? "Authorized" : "Blocked"}
          detail={isCashier ? "Cashier role is present in the auth context." : "Cashier role is required."}
          variant={isCashier ? "success" : "danger"}
        />
        <SessionStatusRow
          icon={<Storefront size={18} weight="bold" aria-hidden />}
          label="Branch context"
          status={branchReady ? "Ready" : "Missing"}
          detail={branchReady ? context.branchName : "Branch context unavailable."}
          variant={branchReady ? "success" : "warning"}
        />
        <SessionStatusRow
          icon={<ClockClockwise size={18} weight="bold" aria-hidden />}
          label="Last context refresh"
          status={formatSessionTime(context.sessionLastActivityAt)}
          detail={`Created: ${formatSessionTime(context.sessionCreatedAt)}. Session ID: ${context.sessionId || "Not available"}.`}
          variant="neutral"
        />
      </ul>

      <div className="mt-5">
        <CashierLogoutPanel
          isLoggingOut={isLoggingOut}
          action={
            <Button
              className="w-full"
              variant="secondary"
              size="pos"
              leadingIcon={<SignOut size={20} weight="bold" aria-hidden />}
              disabled={isLoggingOut}
              onClick={onLogout}
            >
              {isLoggingOut ? "Ending session" : "End cashier session"}
            </Button>
          }
        />
      </div>
    </Card>
  );
}
