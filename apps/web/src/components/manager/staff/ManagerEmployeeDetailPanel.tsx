import Link from "next/link";

import { ManagerStatusPipeline } from "@/components/manager/chrome";
import { Badge, Card } from "@/components/ui";
import {
  MANAGER_EMPLOYEE_PIPELINE,
  managerEmployeePipelineIndex,
  managerEmployeeStatusTone,
  titleCaseManagerStatus,
} from "@/lib/manager/staff-model";
import { MANAGER_STAFF_ROUTES } from "@/lib/manager/staff-route";
import type { ManagerEmployeeRow } from "@/lib/manager/staff-types";

/**
 * The employee record (Track B3) — the Odoo **C5 form view** with a **C14
 * statusbar pipeline**, read-only.
 *
 * ## Why this does NOT call `GET /hr/employees/:id`
 *
 * The list row already carries every field this record shows. The detail route
 * additionally returns a `contracts[]` array — safe since C-02 (no salary), but
 * contracts are excluded from the Manager workspace by the locked owner decision
 * regardless of whether they are safe. Not calling it is therefore both the
 * correct boundary and one fewer request per selection (MP0-01 makes the same
 * recommendation: prefer the list row where it suffices).
 *
 * ## Why the pipeline is not Odoo's
 *
 * Odoo's employee statusbar reads `Invited ▸ Confirmed`. Nimbus has **no
 * invite-by-email flow** (NG-08) — an account is created directly with a PIN —
 * so the pipeline here is the real `EmployeeStatus` progression, and
 * `TERMINATED` renders as an exit rather than a stage.
 */
type ManagerEmployeeDetailPanelProps = {
  employee: ManagerEmployeeRow;
  /** True when the record belongs to a different branch than the one selected. */
  isOutsideBranch: boolean;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border-subtle/60 py-2 last:border-b-0">
      <dt className="text-xs font-bold uppercase tracking-[0.08em] text-text-muted">{label}</dt>
      <dd className="min-w-0 text-sm font-semibold text-text-primary">{children}</dd>
    </div>
  );
}

export function ManagerEmployeeDetailPanel({
  employee,
  isOutsideBranch,
}: ManagerEmployeeDetailPanelProps) {
  const pipelineIndex = managerEmployeePipelineIndex(employee.status);

  return (
    <Card className="min-w-0" data-manager-employee-detail={employee.id}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold tracking-tight text-text-primary">
            {employee.displayName}
          </h2>
          <p className="mt-0.5 text-sm text-text-secondary">
            {employee.employeeCode || "No employee code"}
          </p>
        </div>
        <Badge variant={managerEmployeeStatusTone(employee.status)}>
          {titleCaseManagerStatus(employee.status)}
        </Badge>
      </div>

      <div className="mt-4">
        <ManagerStatusPipeline
          ariaLabel="Employment status"
          stages={MANAGER_EMPLOYEE_PIPELINE.map(titleCaseManagerStatus)}
          currentIndex={pipelineIndex}
          exitLabel={`${titleCaseManagerStatus(employee.status)} — no longer employed`}
        />
      </div>

      <dl className="mt-5">
        <Field label="Position">{employee.positionTitle || "Not recorded"}</Field>
        <Field label="Department">{employee.positionDepartment || "Not recorded"}</Field>
        <Field label="Employment">{titleCaseManagerStatus(employee.employmentType)}</Field>
        <Field label="Started">
          {employee.hireDate
            ? new Intl.DateTimeFormat(undefined, {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }).format(new Date(employee.hireDate))
            : "Not recorded"}
        </Field>
        <Field label="Work phone">{employee.phone || "Not recorded"}</Field>
        <Field label="Work email">{employee.email || "PIN-only account"}</Field>
      </dl>

      {isOutsideBranch ? (
        <p className="mt-4 rounded-md bg-status-warning-surface px-3 py-2 text-xs leading-5 text-text-secondary">
          This record belongs to another branch in the organization. It is visible because the
          employee endpoint is organization-scoped and cannot be filtered by branch.
        </p>
      ) : null}

      {employee.userId ? (
        <Link
          href={{ pathname: MANAGER_STAFF_ROUTES.quickPin, query: { employeeId: employee.id } }}
          className="mt-5 inline-flex rounded-md px-2 py-1 text-sm font-semibold text-brand-navy-900 underline outline-none hover:bg-surface-muted focus-visible:shadow-focus"
        >
          Manage this person&apos;s Quick PIN
        </Link>
      ) : (
        <p className="mt-5 text-xs leading-5 text-text-muted">
          This employee has no linked login account, so there is no Quick PIN to administer.
        </p>
      )}

      <p className="mt-4 text-xs leading-5 text-text-muted">
        Read-only. Editing a staff profile, changing employment terms and everything to do with pay
        are outside this workspace.
      </p>
    </Card>
  );
}
