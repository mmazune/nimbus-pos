import { Badge } from "@/components/ui";
import { operationalIcons, operationalIconSizes, operationalIconWeights } from "@/components/pos-shell/role-icons";
import {
  managerAvatarToken,
  managerEmployeeStatusTone,
  managerInitial,
  titleCaseManagerStatus,
} from "@/lib/manager/staff-model";
import type { ManagerEmployeeRow } from "@/lib/manager/staff-types";
import { cn } from "@/lib/utils/cn";

/**
 * The Odoo **C7 kanban card** (Track B3, reference screenshot
 * `12-employees-kanban.jpg`): a solid colour avatar block on the left, then
 * stacked icon + value rows — job title, email, phone — and a status dot.
 *
 * Adapted, not copied:
 *
 * - Odoo's card shows a **contract window** (`Oct 1, 2025 - Jun 30, 2028`) on
 *   the last row. That is contract data, which the locked owner decision
 *   excludes from this workspace entirely, so the row here is the **hire date**
 *   — a fact the safe payload actually carries.
 * - The avatar colour is derived deterministically from the employee code using
 *   the four chart tokens Track B2 added. No new palette, no random colour, and
 *   the same person always reads the same.
 * - No photo. Nimbus stores no employee image, so a placeholder silhouette would
 *   imply an upload feature that does not exist.
 */
type ManagerEmployeeKanbanProps = {
  employees: readonly ManagerEmployeeRow[];
  selectedId: string | null;
  onSelect: (employee: ManagerEmployeeRow) => void;
};

function CardRow({
  icon,
  children,
  title,
}: {
  icon: keyof typeof operationalIcons;
  children: React.ReactNode;
  title?: string;
}) {
  const Icon = operationalIcons[icon];
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm text-text-secondary">
      <Icon
        size={operationalIconSizes.compactAction}
        weight={operationalIconWeights.default}
        className="shrink-0 text-text-muted"
        aria-hidden
      />
      {/* Kanban cards are narrow by design, so long values truncate. `title` keeps
          the full value reachable on hover — the same treatment the shared Floor
          gives an abbreviated table label. */}
      <span className="min-w-0 truncate" title={title}>
        {children}
      </span>
    </div>
  );
}

export function ManagerEmployeeKanban({
  employees,
  onSelect,
  selectedId,
}: ManagerEmployeeKanbanProps) {
  return (
    <ul
      data-manager-employee-kanban
      className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      {employees.map((employee) => (
        <li key={employee.id} className="min-w-0">
          <button
            type="button"
            data-manager-employee-card={employee.id}
            aria-pressed={selectedId === employee.id}
            onClick={() => onSelect(employee)}
            className={cn(
              "flex w-full min-w-0 overflow-hidden rounded-lg bg-surface text-left shadow-subtle outline-none transition-shadow duration-150 hover:shadow-panel focus-visible:shadow-focus",
              selectedId === employee.id && "shadow-panel ring-2 ring-brand-navy-900",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex w-20 shrink-0 items-center justify-center text-3xl font-bold text-text-inverse",
                managerAvatarToken(employee.employeeCode || employee.id),
              )}
            >
              {managerInitial(employee)}
            </span>

            <span className="flex min-w-0 flex-1 flex-col gap-1 p-3">
              <span className="flex min-w-0 items-start justify-between gap-2">
                <span
                  className="min-w-0 truncate text-base font-bold text-text-primary"
                  title={employee.displayName}
                >
                  {employee.displayName}
                </span>
                <Badge variant={managerEmployeeStatusTone(employee.status)}>
                  {titleCaseManagerStatus(employee.status)}
                </Badge>
              </span>

              <CardRow icon="staff" title={employee.positionTitle || undefined}>
                {employee.positionTitle || "No position recorded"}
              </CardRow>
              {employee.email ? (
                <CardRow icon="me" title={employee.email}>
                  {employee.email}
                </CardRow>
              ) : null}
              {employee.phone ? (
                <CardRow icon="workstation" title={employee.phone}>
                  {employee.phone}
                </CardRow>
              ) : null}
              <CardRow icon="time">
                {employee.hireDate
                  ? `Started ${new Intl.DateTimeFormat(undefined, {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(employee.hireDate))}`
                  : "Start date unavailable"}
              </CardRow>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
