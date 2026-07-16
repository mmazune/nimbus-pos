import { Info, Lifebuoy } from "@phosphor-icons/react";

import { Card } from "@/components/ui";

export function CashierDemoHelpCard() {
  return (
    <Card aria-labelledby="cashier-demo-help-title">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-status-info-surface text-status-info">
          <Lifebuoy size={22} weight="duotone" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold uppercase tracking-normal text-text-muted">Demo help</p>
          <h2 id="cashier-demo-help-title" className="text-lg font-bold tracking-normal text-text-primary">
            Local Demo Credentials
          </h2>
        </div>
      </div>
      <div className="mt-5 flex items-start gap-3 rounded-md bg-surface-muted p-4 text-sm leading-6 text-text-secondary">
        <Info size={20} weight="bold" className="mt-0.5 shrink-0 text-status-info" aria-hidden />
        <p>
          Demo credentials are documented in <span className="font-semibold text-text-primary">demo-data/DEMO_LOGIN_CREDENTIALS.md</span>.
          Full passwords and PINs are not repeated inside the product UI.
        </p>
      </div>
      <p className="mt-4 text-sm leading-6 text-text-secondary">
        Use this panel as a support reference only. It does not import demo data, write database fixtures, or expose
        manager/admin access.
      </p>
    </Card>
  );
}
