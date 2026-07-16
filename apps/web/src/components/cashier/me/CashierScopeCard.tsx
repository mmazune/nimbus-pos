import { CheckCircle } from "@phosphor-icons/react";

import { Badge, Card } from "@/components/ui";

type CashierScopeCardProps = {
  permissions: string[];
};

const scopeItems = [
  { label: "View active payable queue", permission: "pos:orders:read" },
  { label: "Settle supported payments", permission: "pos:payment:create" },
  { label: "Record manual references", permission: "pos:payment:manual-reference" },
  { label: "Use split tender where supported", permission: "pos:payment:manual-reference" },
  { label: "Split bill allocation", permission: "pos:order:split" },
  { label: "Split items with KDS boundary warning", permission: "pos:order:split" },
  { label: "View/reprint metadata receipts", permission: "pos:receipt:read" },
  { label: "Record pending receipt send requests", permission: "pos:receipt:send" },
  { label: "Open/review/reconcile till", permission: "pos:till:read" },
  { label: "Record safe drops", permission: "pos:till:safe-drop" },
  { label: "Create refund requests where authorized", permission: "pos:refund:create" },
];

export function CashierScopeCard({ permissions }: CashierScopeCardProps) {
  const permissionSet = new Set(permissions);

  return (
    <Card aria-labelledby="cashier-scope-title">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-normal text-text-muted">Allowed scope</p>
          <h2 id="cashier-scope-title" className="mt-1 text-lg font-bold tracking-normal text-text-primary">
            Cashier Can Do
          </h2>
        </div>
        <Badge variant="info">{permissions.length} permissions loaded</Badge>
      </div>
      <ul className="mt-5 grid grid-cols-2 gap-3">
        {scopeItems.map((item) => {
          const hasPermission = permissionSet.has(item.permission);
          return (
            <li key={item.label} className="rounded-md bg-surface-muted p-3">
              <div className="flex items-start gap-2">
                <CheckCircle
                  size={18}
                  weight="bold"
                  className={hasPermission ? "mt-0.5 shrink-0 text-status-success" : "mt-0.5 shrink-0 text-text-muted"}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-6 text-text-primary">{item.label}</p>
                  <p className="mt-1 break-words text-xs font-semibold text-text-muted">
                    {hasPermission ? item.permission : `${item.permission} not visible in current session`}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
