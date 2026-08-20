import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useMemo, useState } from "react";

import {
  ManagerContentShell,
  ManagerControlPanel,
  ManagerFilterChip,
  ManagerListTable,
  ManagerSearchFilterMenu,
  ManagerViewSwitcher,
  type ManagerListColumn,
} from "@/components/manager/chrome";
import { ManagerEmployeeDetailPanel } from "@/components/manager/staff/ManagerEmployeeDetailPanel";
import { ManagerEmployeeKanban } from "@/components/manager/staff/ManagerEmployeeKanban";
import { ManagerSensitiveFieldsCard } from "@/components/manager/staff/ManagerSensitiveFieldsCard";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { useManagerDirectory } from "@/lib/manager/staff-context";
import {
  MANAGER_EMPLOYEE_STATUS_FILTERS,
  filterManagerEmployeesByBranch,
  filterManagerEmployeesByFacet,
  managerEmployeeStatusTone,
  titleCaseManagerStatus,
  toManagerDirectoryFacets,
} from "@/lib/manager/staff-model";
import {
  MANAGER_STAFF_ROUTES,
  buildManagerListQuery,
  firstManagerQueryValue,
  readManagerDirectoryScope,
  readManagerEmployeeStatus,
  readManagerStaffView,
} from "@/lib/manager/staff-route";
import type { ManagerEmployeeRow } from "@/lib/manager/staff-types";
import { cn } from "@/lib/utils/cn";
import { useDebouncedCallback } from "@/lib/utils/useDebouncedCallback";

/**
 * Staff → Directory (Track B3). The Odoo **C7 kanban** (screenshot `12`) with a
 * left facet sidebar and a **C4 list** behind the view switcher.
 *
 * ## The one honest complication on this screen
 *
 * `GET /hr/employees` is **organization-scoped and rejects `?branchId=`** with a
 * 400 (MP0-06 / C-09). There is no server-side branch filter to call. So the
 * directory:
 *
 * 1. reads the organization once with an explicit bound (`take=100` — the
 *    endpoint has no `@Max`, C-12);
 * 2. narrows to the selected branch **in the browser**, which is the default;
 * 3. **says so on screen**, and offers an explicit organization view — otherwise
 *    the branch switcher would appear broken on the one Manager surface it
 *    cannot drive, and a manager would wonder where a colleague went.
 *
 * Search and status filtering ARE server-side (`?search=`, `?status=`), so those
 * reduce the wire; only the branch narrowing is client-side.
 *
 * `?view=full` is never requested. See `staff-api.ts`.
 */
export function ManagerStaffDirectoryScreen() {
  const router = useRouter();
  const view = readManagerStaffView(router.query.view);
  const scope = readManagerDirectoryScope(router.query.scope);
  const status = readManagerEmployeeStatus(router.query.status);
  const facet = firstManagerQueryValue(router.query.facet);
  const selectedId = firstManagerQueryValue(router.query.employeeId);
  const [search, setSearch] = useState(() => firstManagerQueryValue(router.query.q) || "");

  const { branchId, branchName, listQuery } = useManagerDirectory({
    search: firstManagerQueryValue(router.query.q),
    status,
  });

  const patchQuery = useCallback(
    (patch: Record<string, string | number | null>) => {
      void router.replace(
        { pathname: router.pathname, query: buildManagerListQuery(router.query, patch) },
        undefined,
        { shallow: true },
      );
    },
    [router],
  );

  /**
   * `?search=` is a REAL server filter, so writing it to the URL on every
   * keystroke would be one request per character. The input stays responsive
   * through local state; only the URL write — and therefore the refetch — waits
   * for a pause in typing (CLAUDE.md §15).
   */
  const commitSearch = useDebouncedCallback((value: string) => {
    patchQuery({ q: value.trim() || null });
  });

  const allRows = useMemo(() => listQuery.data?.rows || [], [listQuery.data]);
  const branchRows = useMemo(
    () => (scope === "branch" ? filterManagerEmployeesByBranch(allRows, branchId) : allRows),
    [allRows, branchId, scope],
  );
  const facets = useMemo(() => toManagerDirectoryFacets(branchRows), [branchRows]);
  const rows = useMemo(
    () => filterManagerEmployeesByFacet(branchRows, facet),
    [branchRows, facet],
  );

  const selected = useMemo(
    () => allRows.find((employee) => employee.id === selectedId) || null,
    [allRows, selectedId],
  );

  const organizationTotal = listQuery.data?.organizationTotal ?? 0;
  const requestedTake = listQuery.data?.requestedTake ?? 0;
  const isPartialRead = organizationTotal > allRows.length;

  const columns: ManagerListColumn<ManagerEmployeeRow>[] = useMemo(
    () => [
      { key: "name", header: "Name", render: (row) => row.displayName },
      { key: "employeeCode", header: "Code", render: (row) => row.employeeCode || "—" },
      {
        key: "position",
        header: "Position",
        render: (row) => row.positionTitle || <span className="text-text-muted">Not recorded</span>,
      },
      {
        key: "department",
        header: "Department",
        optional: true,
        hideBelowLarge: true,
        render: (row) => row.positionDepartment || <span className="text-text-muted">—</span>,
      },
      {
        key: "employmentType",
        header: "Employment",
        optional: true,
        hideBelowLarge: true,
        render: (row) => titleCaseManagerStatus(row.employmentType),
      },
      {
        key: "phone",
        header: "Work phone",
        optional: true,
        defaultHidden: true,
        render: (row) => row.phone || "—",
      },
      {
        key: "status",
        header: "Status",
        render: (row) => (
          <Badge variant={managerEmployeeStatusTone(row.status)}>
            {titleCaseManagerStatus(row.status)}
          </Badge>
        ),
      },
    ],
    [],
  );

  return (
    <ManagerContentShell>
      <ManagerControlPanel
        title="Staff directory"
        primaryAction={
          <Link href={MANAGER_STAFF_ROUTES.onboarding}>
            <Button variant="primary">New</Button>
          </Link>
        }
        secondaryActions={
          <div
            className="flex items-center gap-1 rounded-md bg-surface-muted p-0.5"
            role="group"
            aria-label="Directory scope"
          >
            {(
              [
                { key: "branch", label: branchName },
                { key: "organization", label: "Whole organization" },
              ] as const
            ).map((option) => (
              <button
                key={option.key}
                type="button"
                aria-pressed={scope === option.key}
                data-manager-directory-scope={option.key}
                onClick={() => patchQuery({ scope: option.key === "branch" ? null : option.key })}
                className={cn(
                  "max-w-[12rem] truncate rounded px-2.5 py-1 text-sm font-semibold outline-none focus-visible:shadow-focus",
                  scope === option.key
                    ? "bg-surface text-text-primary shadow-subtle"
                    : "text-text-muted hover:text-text-secondary",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        }
        search={{
          // `/hr/employees` really does have `?search=` (firstName, lastName,
          // employeeCode, email — case-insensitive), so this input is genuinely
          // server-backed and the box is not decorative.
          value: search,
          onChange: (value) => {
            setSearch(value);
            commitSearch(value);
          },
          placeholder: "Search name, code or email…",
          filterChips: (
            <>
              {status ? (
                <ManagerFilterChip
                  label={titleCaseManagerStatus(status)}
                  onClear={() => patchQuery({ status: null })}
                />
              ) : null}
              {facet ? <ManagerFilterChip label={facet} onClear={() => patchQuery({ facet: null })} /> : null}
            </>
          ),
          filterMenu: (
            <ManagerSearchFilterMenu
              ariaLabel="Filter staff"
              filters={MANAGER_EMPLOYEE_STATUS_FILTERS.map((value) => ({
                key: value,
                label: titleCaseManagerStatus(value),
              }))}
              activeFilterKeys={status ? [status] : []}
              onToggleFilter={(key) => patchQuery({ status: status === key ? null : key })}
            />
          ),
        }}
        viewSwitcher={
          <ManagerViewSwitcher
            ariaLabel="Directory view"
            options={[
              { key: "kanban", label: "Cards", icon: "staff" },
              { key: "list", label: "List", icon: "operations" },
            ]}
            value={view}
            onChange={(next) => patchQuery({ view: next === "kanban" ? null : next })}
          />
        }
      />

      <p className="max-w-4xl text-sm text-text-secondary" data-manager-directory-note>
        {scope === "branch"
          ? `Showing ${rows.length} of ${allRows.length} people read from this organization, narrowed to ${branchName} in the browser — this endpoint is organization-scoped and rejects a branch filter, so the branch switcher cannot narrow it server-side.`
          : `Showing ${rows.length} people across the whole organization. Switch back to ${branchName} to narrow to the selected branch.`}
        {isPartialRead
          ? ` This read is bounded to ${requestedTake} records and the organization has ${organizationTotal} — use search to reach anyone not listed.`
          : ""}
      </p>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.5fr)]">
        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(9rem,0.22fr)_minmax(0,1fr)]">
          {/* The Odoo left facet panel (screenshot 12: DEPARTMENT → All / ▸ …). */}
          <nav aria-label="Filter by position" className="min-w-0">
            <p className="px-2 pb-2 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-text-muted">
              Position
            </p>
            <ul className="flex flex-col">
              <li>
                <button
                  type="button"
                  aria-pressed={!facet}
                  onClick={() => patchQuery({ facet: null })}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm font-semibold outline-none hover:bg-surface-muted focus-visible:shadow-focus",
                    !facet ? "bg-surface-muted text-text-primary" : "text-text-secondary",
                  )}
                >
                  All
                  <span className="tabular-nums text-text-muted">{branchRows.length}</span>
                </button>
              </li>
              {facets.map((entry) => (
                <li key={entry.key}>
                  <button
                    type="button"
                    aria-pressed={facet === entry.key}
                    data-manager-directory-facet={entry.key}
                    onClick={() => patchQuery({ facet: facet === entry.key ? null : entry.key })}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm font-semibold outline-none hover:bg-surface-muted focus-visible:shadow-focus",
                      facet === entry.key ? "bg-surface-muted text-text-primary" : "text-text-secondary",
                    )}
                  >
                    <span className="min-w-0 truncate">{entry.label}</span>
                    <span className="tabular-nums text-text-muted">{entry.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0">
            {listQuery.isLoading ? (
              <LoadingState title="Loading the staff directory…" />
            ) : listQuery.isError ? (
              <div className="flex flex-col items-start gap-3">
                <ErrorState
                  title="Directory unavailable"
                  description="The employee list could not be read. Retry when the connection is stable."
                />
                <Button variant="secondary" onClick={() => void listQuery.refetch()}>
                  Retry
                </Button>
              </div>
            ) : !rows.length ? (
              <EmptyState
                title="No staff match"
                description={
                  scope === "branch"
                    ? `Nobody in ${branchName} matches the current filters. Try the whole-organization view.`
                    : "Nobody in this organization matches the current filters."
                }
              />
            ) : view === "kanban" ? (
              <ManagerEmployeeKanban
                employees={rows}
                selectedId={selectedId}
                onSelect={(employee) => patchQuery({ employeeId: employee.id })}
              />
            ) : (
              <ManagerListTable
                caption="Staff directory"
                columns={columns}
                rows={rows}
                getRowId={(row) => row.id}
                selectedRowId={selectedId}
                onSelectRow={(row) => patchQuery({ employeeId: row.id })}
              />
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {selected ? (
            <ManagerEmployeeDetailPanel
              employee={selected}
              isOutsideBranch={Boolean(branchId) && selected.branchId !== branchId}
            />
          ) : (
            <Card className="min-w-0">
              <h2 className="text-lg font-semibold text-text-primary">Select a person</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Choosing someone opens their read-only record: position, employment type, start date
                and work contact. Nothing to do with pay is fetched.
              </p>
            </Card>
          )}

          <ManagerSensitiveFieldsCard />
        </div>
      </div>
    </ManagerContentShell>
  );
}
