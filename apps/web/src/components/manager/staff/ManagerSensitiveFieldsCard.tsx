import { Card } from "@/components/ui";

/**
 * The **sensitive-fields exclusion card** the roadmap requires on Staff:
 * "stating plainly what Manager cannot see".
 *
 * It is deliberately specific rather than a vague privacy notice, because the
 * interesting fact is that these are NOT permission blocks. The seeded Manager
 * JWT holds `pos:hr:compensation:read`, `pos:hr:contracts:read` and
 * `pos:hr:contracts:create` — 61 of 61 documented Manager permissions are held.
 * Every exclusion below is a product decision the FRONTEND enforces, which is
 * exactly why `lib/manager/permissions.ts` is an allow-list and not a
 * `hasPermission()` check.
 */
const EXCLUDED = [
  {
    label: "Pay and compensation",
    detail:
      "Salary basis, base amount, allowances and deductions are not requested by this workspace. The employee endpoint no longer returns them by default at all.",
  },
  {
    label: "Contracts",
    detail:
      "Employment contracts and their salary terms are outside the manager workspace, even though the token could read them.",
  },
  {
    label: "Personal records",
    detail:
      "Date of birth, home address, emergency contacts and private HR notes are never fetched. Only work phone and work email are shown.",
  },
  {
    label: "Payroll, bank details and tax identifiers",
    detail: "Pay runs, payslips, bank accounts and tax IDs have no manager surface.",
  },
  {
    label: "Roles and permissions",
    detail:
      "There is no role or permission editor. Role-to-permission mapping is fixed in the seed and has no API to change it.",
  },
] as const;

/**
 * What Nimbus cannot offer that Odoo's equivalent security tab does (NG-08).
 * Listed as absent capabilities rather than greyed-out buttons — a disabled
 * "Send password reset" advertises a flow that does not exist anywhere in the
 * backend.
 */
const ABSENT = [
  "Password administration and password resets — frontline staff have no password concept.",
  "Two-factor authentication, API keys and passkeys — none exist in this backend.",
  "Per-user session revocation — /api/devices is a hardware registry, not a session list.",
  "Invite-by-email onboarding — staff are created directly, with a PIN.",
] as const;

export function ManagerSensitiveFieldsCard() {
  return (
    <Card className="min-w-0" data-manager-sensitive-fields>
      <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">
        What this workspace does not show
      </h3>
      <dl className="mt-3 space-y-3">
        {EXCLUDED.map((entry) => (
          <div key={entry.label}>
            <dt className="text-sm font-bold text-text-primary">{entry.label}</dt>
            <dd className="mt-0.5 text-sm leading-6 text-text-secondary">{entry.detail}</dd>
          </div>
        ))}
      </dl>

      <h3 className="mt-6 text-xs font-bold uppercase tracking-[0.1em] text-text-muted">
        Not built anywhere in Nimbus
      </h3>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-text-secondary">
        {ABSENT.map((entry) => (
          <li key={entry} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-border-strong" aria-hidden />
            <span className="min-w-0">{entry}</span>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-xs leading-5 text-text-muted">
        These are product boundaries, not permission errors. This account&apos;s token would be
        allowed to read compensation and contracts; the workspace does not ask.
      </p>
    </Card>
  );
}
