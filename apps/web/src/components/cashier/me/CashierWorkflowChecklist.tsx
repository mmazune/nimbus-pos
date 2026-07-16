import { ClipboardText } from "@phosphor-icons/react";

import { Card } from "@/components/ui";

const workflowSteps = [
  "Sign in with Quick PIN or email.",
  "Confirm branch/workstation.",
  "Confirm shift readiness.",
  "Open or verify active till.",
  "Work Queue.",
  "Take payments.",
  "Split/resolve orders only when needed.",
  "View receipts and record pending sends/reprints.",
  "Record refunds where cashier-authorized.",
  "Reconcile till before end of cash session.",
  "Logout.",
];

export function CashierWorkflowChecklist() {
  return (
    <Card aria-labelledby="cashier-workflow-title">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-muted text-brand-navy-900">
          <ClipboardText size={22} weight="duotone" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold uppercase tracking-normal text-text-muted">Checklist</p>
          <h2 id="cashier-workflow-title" className="text-lg font-bold tracking-normal text-text-primary">
            Cashier Workflow
          </h2>
        </div>
      </div>
      <ol className="mt-5 grid grid-cols-2 gap-3">
        {workflowSteps.map((step, index) => (
          <li key={step} className="flex min-h-12 items-start gap-3 rounded-md bg-surface-muted p-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-navy-900 text-xs font-bold tabular-nums text-text-inverse">
              {index + 1}
            </span>
            <span className="text-sm font-semibold leading-6 text-text-primary">{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm leading-6 text-text-secondary">
        Checklist items are informational only. They do not create hidden actions or bypass workflow guards.
      </p>
    </Card>
  );
}
