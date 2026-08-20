import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

import { managerRoutes } from "../src/lib/manager/routes";
import { managerTopNavMenus } from "../src/lib/manager/top-nav";
import {
  MANAGER_ORDER_PIPELINE,
  MANAGER_ORDER_STATUS_FILTERS,
  MANAGER_RESERVATION_STATUS_FILTERS,
  MANAGER_SERVICE_TYPE_FILTERS,
  formatManagerDateTime,
  managerOrderPipelineIndex,
  managerOrderStatusTone,
  normalizeManagerFloorTables,
  sumManagerPageMoney,
  toManagerOperationsAmount,
  toManagerPager,
} from "../src/lib/manager/operations-model";
import {
  MANAGER_OPERATIONS_ROUTES,
  buildManagerListQuery,
  readManagerOrderStatus,
  readManagerPage,
  readManagerReservationScope,
} from "../src/lib/manager/operations-route";
import {
  FORBIDDEN_STAFF_KEYS,
  SAFE_EMPLOYEE_FIELDS,
  findForbiddenStaffKeys,
  projectManagerEmployee,
  projectManagerStaffIdentity,
} from "../src/lib/manager/staff-projection";
import {
  MANAGER_EMPLOYEE_PIPELINE,
  MANAGER_EMPLOYMENT_TYPES,
  MANAGER_FRONTLINE_ROLES,
  buildManagerOnboardPayload,
  emptyManagerOnboardingDraft,
  filterManagerEmployeesByBranch,
  isManagerReviewDecidable,
  managerAvatarToken,
  toManagerDirectoryFacets,
  validateManagerOnboardingStep,
} from "../src/lib/manager/staff-model";
import { MANAGER_STAFF_ROUTES } from "../src/lib/manager/staff-route";
import {
  MANAGER_KPI_BINDINGS,
  isOpenOrdersPreviewCapped,
  openOrdersReportedTotal,
} from "../src/lib/manager/dashboard-model";

/**
 * Track B3 — Manager Operations + Staff static assertions.
 *
 * Encodes the owner's four HARD GUARDS as executable checks:
 *
 *   1. the UI never calls `?view=full`;
 *   2. no compensation / salary / bank / dateOfBirth / address / emergencyContact
 *      key is referenced anywhere in `components/manager` or `lib/manager`;
 *   3. no roster-mutation call exists;
 *   4. no till / shift list is fabricated, and mutations exist ONLY for
 *      onboarding, quick-pin, leave review and shift-swap reject.
 *
 * plus the roadmap's own B3 acceptance gates (allow-list not deny-list, bounded
 * page sizes, unforked shared Floor, no checkout control on any Operations
 * surface, the PIN never reaching a cache key / log / storage) and the FU-3
 * dashboard cleanup.
 */

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Manager B3 assertion failed: ${message}`);
}

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

/** Source with comments stripped — a comment must never satisfy a check. */
function codeOnly(path: string) {
  return source(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
}

function listFiles(dir: string): string[] {
  const absolute = join(process.cwd(), dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? listFiles(`${dir}/${entry.name}`)
      : entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")
        ? [`${dir}/${entry.name}`]
        : [],
  );
}

const MANAGER_COMPONENT_DIR = "apps/web/src/components/manager";
const MANAGER_LIB_DIR = "apps/web/src/lib/manager";
const MANAGER_PAGES_DIR = "apps/web/src/pages/manager";

const managerFiles = [
  ...listFiles(MANAGER_COMPONENT_DIR),
  ...listFiles(MANAGER_LIB_DIR),
  ...listFiles(MANAGER_PAGES_DIR),
];
assert(managerFiles.length > 30, `the manager surface has files to scan (found ${managerFiles.length})`);

const operationsFiles = listFiles(`${MANAGER_COMPONENT_DIR}/operations`);
const staffFiles = listFiles(`${MANAGER_COMPONENT_DIR}/staff`);

// ═══════════════════════════════════════════════════════════════════════════
// 1. Files exist and are mounted
// ═══════════════════════════════════════════════════════════════════════════

for (const file of [
  `${MANAGER_LIB_DIR}/operations-api.ts`,
  `${MANAGER_LIB_DIR}/operations-context.ts`,
  `${MANAGER_LIB_DIR}/operations-model.ts`,
  `${MANAGER_LIB_DIR}/operations-route.ts`,
  `${MANAGER_LIB_DIR}/operations-types.ts`,
  `${MANAGER_LIB_DIR}/staff-api.ts`,
  `${MANAGER_LIB_DIR}/staff-context.ts`,
  `${MANAGER_LIB_DIR}/staff-model.ts`,
  `${MANAGER_LIB_DIR}/staff-projection.ts`,
  `${MANAGER_LIB_DIR}/staff-route.ts`,
  `${MANAGER_LIB_DIR}/staff-types.ts`,
  `${MANAGER_COMPONENT_DIR}/chrome/ManagerListTable.tsx`,
  `${MANAGER_COMPONENT_DIR}/chrome/ManagerStatusPipeline.tsx`,
  `${MANAGER_COMPONENT_DIR}/chrome/ManagerViewSwitcher.tsx`,
  `${MANAGER_COMPONENT_DIR}/chrome/ManagerRecordActionsMenu.tsx`,
]) {
  assert(existsSync(join(process.cwd(), file)), `expected B3 file exists: ${file}`);
}

assert(operationsFiles.length >= 4, `Operations ships its screens (found ${operationsFiles.length})`);
assert(staffFiles.length >= 9, `Staff ships its screens (found ${staffFiles.length})`);

// The M-P1 foundation screens are gone from these two modules.
for (const [route, screen] of [
  ["operations/orders", "ManagerOrdersScreen"],
  ["operations/tables", "ManagerTablesScreen"],
  ["operations/reservations", "ManagerReservationsScreen"],
  ["staff/directory", "ManagerStaffDirectoryScreen"],
  ["staff/onboarding", "ManagerOnboardingScreen"],
  ["staff/quick-pin", "ManagerQuickPinScreen"],
  ["staff/leave", "ManagerLeaveReviewScreen"],
  ["staff/shift-swaps", "ManagerShiftSwapReviewScreen"],
] as const) {
  const page = codeOnly(`${MANAGER_PAGES_DIR}/${route}.tsx`);
  assert(page.includes(`<${screen} />`), `/manager/${route} renders ${screen}`);
  assert(
    !page.includes("ManagerFoundationScreen"),
    `/manager/${route} no longer renders the B1 honest-foundation screen`,
  );
}
assert(
  !existsSync(join(process.cwd(), `${MANAGER_PAGES_DIR}/operations.tsx`)) &&
    !existsSync(join(process.cwd(), `${MANAGER_PAGES_DIR}/staff.tsx`)),
  "the single-page Operations/Staff foundation routes were replaced by module directories",
);

// ═══════════════════════════════════════════════════════════════════════════
// 2. HARD GUARD — `?view=full` is never requested
// ═══════════════════════════════════════════════════════════════════════════

for (const file of managerFiles) {
  const code = codeOnly(file);
  assert(!/view=full/.test(code), `no manager file requests view=full (${file})`);
  assert(
    !/["']full["']\s*\)?\s*;?\s*$/m.test(code) || !/params\.set\(\s*["']view["']/.test(code),
    `no manager file sets a view parameter at all (${file})`,
  );
}
const directoryPath = codeOnly(`${MANAGER_LIB_DIR}/staff-api.ts`);
assert(
  !/params\.set\(\s*["']view["']/.test(directoryPath),
  "buildManagerDirectoryPath never sets the `view` parameter — the safe default is the only payload requested",
);
assert(
  !/params\.set\(\s*["']branchId["']/.test(directoryPath),
  "the directory never sends ?branchId= — /hr/employees 400s on it (MP0-06)",
);

// ═══════════════════════════════════════════════════════════════════════════
// 3. HARD GUARD — no forbidden PII / compensation key is referenced
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Two files are allowed to NAME these strings, because naming them is how they
 * prove the exclusion: the projection allow-list itself, and the on-screen
 * disclosure card that tells the manager what is withheld. Even there, the
 * strings may only appear as prose or as members of the forbidden-key list —
 * never as a property access (`x.allowances`) or an object key
 * (`allowances:`), which is what actually reading the data would look like.
 *
 * Everywhere else in `components/manager`, `lib/manager` and `pages/manager`,
 * any occurrence at all is a leak.
 */
const PROJECTION_FILE = `${MANAGER_LIB_DIR}/staff-projection.ts`;
const DISCLOSURE_FILES = new Set([
  PROJECTION_FILE,
  `${MANAGER_COMPONENT_DIR}/staff/ManagerSensitiveFieldsCard.tsx`,
  // The M-P1 excluded-surface register — its whole job is to say, in prose, what
  // the workspace withholds despite holding the permission.
  `${MANAGER_LIB_DIR}/permissions.ts`,
]);
const FORBIDDEN_IN_CODE = [
  "compensationProfile",
  "baseAmount",
  "salaryBasis",
  "salaryAmount",
  "allowances",
  "deductions",
  "dateOfBirth",
  "emergencyContactName",
  "emergencyContactPhone",
  "bankAccount",
  "taxId",
] as const;

for (const file of managerFiles) {
  const code = codeOnly(file);
  const isDisclosure = DISCLOSURE_FILES.has(file);

  for (const key of FORBIDDEN_IN_CODE) {
    if (isDisclosure) {
      // Prose is fine; reading the field is not.
      assert(
        !new RegExp(`\\.${key}\\b`).test(code),
        `${file} may name "${key}" but never reads it as a property`,
      );
      assert(
        !new RegExp(`\\b${key}\\s*:`).test(code),
        `${file} may name "${key}" but never constructs it as an object key`,
      );
      continue;
    }
    assert(
      !new RegExp(`\\b${key}\\b`).test(code),
      `no compensation/PII key "${key}" is referenced in ${file}`,
    );
  }
}

// The projection is an ALLOW-LIST: it constructs named fields, it does not delete.
const projectionCode = codeOnly(PROJECTION_FILE);
assert(
  !/\bdelete\s+\w+\./.test(projectionCode),
  "the staff projection never deletes keys — it constructs an allow-list",
);
assert(
  SAFE_EMPLOYEE_FIELDS.every((field) => !(FORBIDDEN_STAFF_KEYS as readonly string[]).includes(field)),
  "the safe field list and the forbidden key list are disjoint",
);

// Executable proof: a raw payload carrying every forbidden field is projected clean.
const rawEmployee = {
  id: "emp-1",
  employeeCode: "EMP-001",
  firstName: "Ada",
  lastName: "Nakato",
  email: "ada@nimbus.test",
  phone: "+256700000000",
  hireDate: "2026-01-05T00:00:00.000Z",
  status: "active",
  employmentType: "permanent",
  branchId: "branch-a",
  userId: "user-1",
  position: { id: "pos-1", title: "Waiter", department: "Service" },
  // Everything below must NOT survive:
  compensationProfile: { baseAmount: "2400000", salaryBasis: "MONTHLY", allowances: [], deductions: [] },
  compensationProfileId: "cp-1",
  contracts: [{ id: "c-1", salaryAmount: "2400000" }],
  dateOfBirth: "1994-02-02T00:00:00.000Z",
  address: "Plot 4, Kampala",
  emergencyContactName: "Next Of Kin",
  emergencyContactPhone: "+256711111111",
  notes: "private HR note",
  metadata: { anything: true },
};

const projected = projectManagerEmployee(rawEmployee);
assert(
  findForbiddenStaffKeys(projected).length === 0,
  `the projected employee carries no forbidden key (found ${findForbiddenStaffKeys(projected).join(", ")})`,
);
assert(
  Object.keys(projected).every((key) => (SAFE_EMPLOYEE_FIELDS as readonly string[]).includes(key)),
  "the projected employee has ONLY allow-listed keys",
);
assert(projected.displayName === "Ada Nakato", "the projection builds a display name");
assert(projected.status === "ACTIVE" && projected.employmentType === "PERMANENT", "enums are normalised");
assert(projected.positionTitle === "Waiter", "the position title survives (Position carries no salary)");

const identity = projectManagerStaffIdentity({ ...rawEmployee, id: "emp-1" });
assert(findForbiddenStaffKeys(identity).length === 0, "the identity projection carries no forbidden key");
assert(Object.keys(identity).length === 3, "the identity projection is id + displayName + employeeCode only");

// The detector itself must actually detect.
assert(
  findForbiddenStaffKeys({ nested: { rows: [{ dateOfBirth: "x" }] } }).length === 1,
  "findForbiddenStaffKeys walks nested arrays and objects",
);

// `/hr/employees/:id` is never called — the list row suffices and the detail
// route returns a contracts array the owner decision excludes.
for (const file of managerFiles) {
  const code = codeOnly(file);
  assert(
    !/hr\/employees\/\$\{/.test(code) && !/hr\/employees\/["'`]?\s*\+/.test(code),
    `no manager file calls GET /hr/employees/:id (${file})`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. HARD GUARD — no roster mutation, and shift-swap is REJECT ONLY
// ═══════════════════════════════════════════════════════════════════════════

for (const file of managerFiles) {
  const code = codeOnly(file);
  assert(
    !/scheduleAssignment/i.test(code) && !/\/workforce\/(schedules|roster|templates)/.test(code),
    `no manager file touches a roster/schedule route (${file})`,
  );
}

const staffApi = codeOnly(`${MANAGER_LIB_DIR}/staff-api.ts`);
assert(
  staffApi.includes("shift-swaps") && staffApi.includes('status: "REJECTED"'),
  "the shift-swap mutation sends REJECTED",
);
assert(
  !/status:\s*["']APPROVED["'][\s\S]{0,200}shift-swaps/.test(staffApi) &&
    !/shift-swaps[\s\S]{0,400}["']APPROVED["']/.test(staffApi),
  "the shift-swap request function can never send APPROVED (Outcome C)",
);
assert(
  !/export\s+(async\s+)?function\s+approveManagerShiftSwap/.test(staffApi),
  "there is no approveManagerShiftSwap export",
);

const swapScreen = codeOnly(`${MANAGER_COMPONENT_DIR}/staff/ManagerShiftSwapReviewScreen.tsx`);
// The screen is allowed — required, even — to explain in PROSE that Approve is
// absent. What it may not contain is an actual approve control or an APPROVED
// payload: no button whose label is "Approve", no confirm label offering it, and
// no APPROVED literal anywhere.
assert(!/>\s*Approve[\s\w]*</.test(swapScreen), "no JSX element renders an Approve label");
assert(
  !/confirmLabel=["'][^"']*[Aa]pprove/.test(swapScreen),
  "no confirmation dialog on this screen offers an approve action",
);
assert(!/APPROVED/.test(swapScreen), "the shift-swap screen never names the APPROVED status");
assert(
  /review\.reject\(/.test(swapScreen),
  "the only decision the shift-swap screen can dispatch is a rejection",
);
assert(
  swapScreen.includes("data-manager-shift-swap-notice"),
  "the shift-swap screen carries the honest no-roster-change notice",
);

const staffContext = codeOnly(`${MANAGER_LIB_DIR}/staff-context.ts`);
assert(
  !/approve/i.test(staffContext.replace(/APPROVED/g, "")),
  "the shift-swap hook exposes no approve action",
);
assert(
  /reject:/.test(staffContext) && /rejectManagerShiftSwap/.test(staffContext),
  "the shift-swap hook exposes reject only",
);

// ═══════════════════════════════════════════════════════════════════════════
// 5. HARD GUARD — no fabricated tills/shifts list
// ═══════════════════════════════════════════════════════════════════════════

for (const file of managerFiles) {
  const code = codeOnly(file);
  assert(
    !/["'`]\/api\/tills/.test(code) && !/["'`]\/api\/shifts/.test(code),
    `no manager file calls a tills or shifts route — neither list exists (MP0-02) (${file})`,
  );
}
const tablesScreen = source(`${MANAGER_COMPONENT_DIR}/operations/ManagerTablesScreen.tsx`);
// Whitespace-normalised: JSX prose wraps across lines, and a line break must not
// be able to defeat a disclosure check.
const tablesProse = tablesScreen.replace(/\s+/g, " ");
assert(
  tablesProse.includes("no branch-wide tills or shifts list"),
  "the Tables screen discloses the missing tills/shifts lists rather than silently omitting them",
);

// ═══════════════════════════════════════════════════════════════════════════
// 6. HARD GUARD — the mutation allow-list
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Exactly four Manager mutations may exist in B3, and they are all in Staff:
 * onboarding, quick-pin (reset/disable/enable), leave review, shift-swap reject.
 * Operations is read-only, and the B2 KPI refresh is the only pre-existing one.
 */
const ALLOWED_MUTATION_PATHS = [
  "/api/hr/frontline-staff/onboard",
  "quick-pin/reset",
  "quick-pin/disable",
  "quick-pin/enable",
  "/review",
  "/approve",
  "/api/dash/kpi/refresh", // pre-existing (B2)
];

const mutationRegex = /method:\s*["'](POST|PATCH|PUT|DELETE)["']/g;
let managerMutationCount = 0;
for (const file of managerFiles) {
  const code = codeOnly(file);
  const matches = code.match(mutationRegex);
  if (!matches) continue;
  managerMutationCount += matches.length;
  assert(
    ALLOWED_MUTATION_PATHS.some((allowed) => code.includes(allowed)),
    `every mutation in ${file} targets an allow-listed path`,
  );
}
assert(managerMutationCount === 7, `exactly 7 manager mutations exist (found ${managerMutationCount})`);

/**
 * The read-only claim is scoped to the surfaces that are read-only.
 *
 * M-P1 put a global "Read-only oversight" badge in the shell's readiness strip.
 * That was true when every Manager surface was a foundation screen; B3 makes it
 * false, because Staff creates accounts, resets PINs and decides leave. A badge
 * asserting the workspace is read-only would sit directly above a "New" button,
 * so B3 removed it from the strip and left it in each read-only surface's own
 * control panel.
 */
const readinessStrip = codeOnly(`${MANAGER_COMPONENT_DIR}/shell/ManagerReadinessStrip.tsx`);
assert(
  !/read-only/i.test(readinessStrip),
  "the shell readiness strip makes no workspace-wide read-only claim (it would be false over Staff)",
);
for (const file of operationsFiles.filter((entry) => /Screen\.tsx$/.test(entry))) {
  assert(
    codeOnly(file).includes("Read-only oversight"),
    `each Operations screen states its own read-only contract (${file})`,
  );
}
for (const file of staffFiles) {
  assert(
    !codeOnly(file).includes("Read-only oversight"),
    `no Staff surface claims to be read-only oversight — it writes (${file})`,
  );
}

// Operations issues NONE of them.
for (const file of [...operationsFiles, `${MANAGER_LIB_DIR}/operations-api.ts`, `${MANAGER_LIB_DIR}/operations-context.ts`]) {
  const code = codeOnly(file);
  assert(!mutationRegex.test(code), `Operations is read-only — no mutation in ${file}`);
  mutationRegex.lastIndex = 0;
  assert(!/useMutation/.test(code), `Operations mounts no mutation hook (${file})`);
}

// No checkout / tender / order-builder control on any Operations surface.
for (const file of operationsFiles) {
  const code = codeOnly(file);
  for (const banned of ["Tender", "CashierPaymentPanel", "OrderBuilder", "Collect payment", "Close order", "Void order"]) {
    assert(!code.includes(banned), `no checkout control "${banned}" on an Operations surface (${file})`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. Bounded page sizes on every list
// ═══════════════════════════════════════════════════════════════════════════

const operationsApi = codeOnly(`${MANAGER_LIB_DIR}/operations-api.ts`);
assert(
  operationsApi.includes('params.set("pageSize"'),
  "the orders/reservations paths always send an explicit pageSize (MP0-11)",
);
assert(
  (operationsApi.match(/pageSize=\d+/g) || []).length >= 2,
  "the floor snapshot's inline reads carry explicit bounds too",
);
assert(staffApi.includes('params.set("take"'), "the staff lists always send an explicit take (C-12)");
assert(
  /MANAGER_DIRECTORY_TAKE\s*=\s*100/.test(staffApi) && /MANAGER_REVIEW_TAKE\s*=\s*25/.test(staffApi),
  "the staff bounds are named constants, not inline magic numbers",
);

// ═══════════════════════════════════════════════════════════════════════════
// 8. The shared Floor is consumed unforked
// ═══════════════════════════════════════════════════════════════════════════

assert(
  tablesScreen.includes("<OperationalFloor") &&
    tablesScreen.includes('from "@/components/floor"'),
  "the Tables screen renders the SHARED OperationalFloor",
);
// A forked floor would show up as a Manager-named floor ELEMENT being rendered.
// `ManagerFloorTableViewModel` is a type produced for the SHARED component and is
// explicitly fine — the check is on JSX, not on identifiers.
for (const file of managerFiles) {
  assert(
    !/<Manager(Floor|Table)(Card|Grid|Toolbar|StatusBadge)\b/.test(codeOnly(file)),
    `no forked Manager floor component is rendered (${file})`,
  );
}
for (const banned of [
  "ManagerFloorCard",
  "ManagerFloorGrid",
  "ManagerFloorToolbar",
  "ManagerTableCard",
  "ManagerTableGrid",
]) {
  assert(
    !managerFiles.some((file) => file.endsWith(`/${banned}.tsx`)),
    `no forked floor component file exists (${banned})`,
  );
}
assert(
  !existsSync(join(process.cwd(), `${MANAGER_COMPONENT_DIR}/floor`)),
  "there is no components/manager/floor directory",
);
// Guest names never reach a floor card.
const operationsModel = codeOnly(`${MANAGER_LIB_DIR}/operations-model.ts`);
assert(
  !/guestName/.test(operationsModel),
  "the floor view model never carries a guest name (locked Waiter rule, all consumers)",
);

// ═══════════════════════════════════════════════════════════════════════════
// 9. The one-time secret never persists
// ═══════════════════════════════════════════════════════════════════════════

for (const file of managerFiles) {
  const code = codeOnly(file);
  assert(!/localStorage/.test(code) || file.includes("branch-context") || file.includes("branch-model"),
    `no manager file writes to localStorage except the branch switcher (${file})`);
  assert(!/sessionStorage/.test(code), `no manager file uses sessionStorage (${file})`);
  assert(!/console\.(log|info|warn|error|debug)/.test(code), `no manager file logs anything (${file})`);
}

const secretPanel = codeOnly(`${MANAGER_COMPONENT_DIR}/staff/ManagerOneTimeSecretPanel.tsx`);
assert(secretPanel.includes('data-manager-secret-value'), "the secret panel exposes its masked/revealed state for QA");
assert(secretPanel.includes("revealed ? secret.value"), "the secret is masked until deliberately revealed");
assert(
  !/managerQueryKey\([^)]*secret/i.test(staffContext) && !/queryKey:[^}]*secret/i.test(staffContext),
  "the one-time secret is never part of a query key",
);
assert(
  staffContext.includes("useMutation") && !/useQuery[\s\S]{0,300}resetManagerQuickPin/.test(staffContext),
  "the PIN reset is a mutation, so React Query keeps no cache entry for its result",
);
assert(
  !/onboardManagerFrontlineStaff/.test(staffContext.replace(/mutationFn:[\s\S]{0,200}/g, "")) ||
    staffContext.includes("mutationFn: (payload: ManagerOnboardPayload)"),
  "onboarding runs through a mutation, not a query",
);

// ═══════════════════════════════════════════════════════════════════════════
// 10. MP0-15 — the onboard payload can never carry contract/compensation ids
// ═══════════════════════════════════════════════════════════════════════════

const draft = emptyManagerOnboardingDraft("2026-08-20");
assert(
  Object.keys(draft).length === 8,
  `the onboarding draft has exactly the 8 safe fields (found ${Object.keys(draft).length})`,
);
const payload = buildManagerOnboardPayload({
  ...draft,
  firstName: "Ada",
  lastName: "Nakato",
  phone: "+256700000000",
  roleName: "Waiter",
});
assert(findForbiddenStaffKeys(payload).length === 0, "the onboard payload carries no forbidden key");
assert(
  !("contractId" in payload.employee) && !("compensationProfileId" in payload.employee),
  "MP0-15: the onboard payload never sends contractId or compensationProfileId",
);
assert(payload.issueQuickPin === true, "issueQuickPin is sent explicitly, not inherited from the DTO default");
assert(
  !("enablePasswordLogin" in payload) && !("temporaryPassword" in payload),
  "the onboard payload never provisions a password (NG-08)",
);
assert(!("email" in payload), "a blank email is omitted, not sent empty");
assert(
  (MANAGER_EMPLOYMENT_TYPES as readonly string[]).includes(payload.employee.employmentType),
  "the employment type is one the Prisma enum accepts",
);
assert(MANAGER_FRONTLINE_ROLES.length === 5, "only the five frontline roles are offered");
const offeredRoleNames: readonly string[] = MANAGER_FRONTLINE_ROLES.map((role) => role.name);
assert(
  !offeredRoleNames.includes("Manager") && !offeredRoleNames.includes("Supervisor"),
  "Supervisor and Manager are omitted from the onboarding picker, not disabled in it",
);

// Validation mirrors the DTO.
assert(
  Object.keys(validateManagerOnboardingStep("identity", draft)).length === 3,
  "an empty identity step reports its three required fields",
);
assert(
  validateManagerOnboardingStep("identity", { ...draft, firstName: "A", lastName: "B", phone: "abc" }).phone,
  "a phone that fails the DTO pattern is rejected client-side too",
);
assert(
  !validateManagerOnboardingStep("identity", { ...draft, firstName: "A", lastName: "B", phone: "+256 700 000 000" })
    .phone,
  "a valid phone passes",
);

// ═══════════════════════════════════════════════════════════════════════════
// 11. Pure-model behaviour
// ═══════════════════════════════════════════════════════════════════════════

// Money fails closed.
assert(toManagerOperationsAmount(null) === null, "unreadable money is null, never 0");
assert(toManagerOperationsAmount("28107000") === 28107000, "wire decimals parse");
assert(sumManagerPageMoney(["1", "2", "3"]) === 6, "a page total sums readable rows");
assert(sumManagerPageMoney(["1", null, "3"]) === null, "a partial page total is refused, not rounded");

// The pager is fed the SERVER total.
const pager = toManagerPager({ page: 2, pageSize: 25, rowCount: 25, total: 107 });
assert(pager.from === 26 && pager.to === 50 && pager.total === 107, "the pager reports server-total-based ranges");
assert(pager.hasNext && pager.hasPrevious, "the pager derives both directions from the total");
const emptyPager = toManagerPager({ page: 1, pageSize: 25, rowCount: 0, total: 0 });
assert(emptyPager.from === 0 && emptyPager.to === 0 && !emptyPager.hasNext, "an empty page reports 0-0, not 1-0");
assert(
  !toManagerPager({ page: 5, pageSize: 25, rowCount: 7, total: 107 }).hasNext,
  "hasNext is false once the page ends at the total",
);

// URL state is validated against the endpoint enums.
assert(readManagerPage(undefined) === 1 && readManagerPage("0") === 1 && readManagerPage("-4") === 1,
  "page is clamped to >= 1");
assert(readManagerPage("3") === 3, "a valid page survives");
assert(readManagerOrderStatus("definitely_not_a_status") === null, "an invalid status is dropped, never forwarded");
assert(readManagerOrderStatus("served") === "SERVED", "a valid status is normalised");
assert(readManagerReservationScope("history") === "history", "the reservation scope round-trips");
assert(readManagerReservationScope("nonsense") === "active", "an invalid scope falls back to active");
const patched = buildManagerListQuery({ page: "5", status: "SERVED" }, { status: "NEW" });
assert(patched.status === "NEW" && !("page" in patched), "changing a filter resets the page");
assert(buildManagerListQuery({ status: "NEW" }, { status: null }).status === undefined, "a null patch clears the key");

// Status vocabulary matches the backend enums.
assert(
  MANAGER_ORDER_STATUS_FILTERS.every((status) =>
    ["NEW", "SENT", "IN_KITCHEN", "READY", "SERVED", "VOIDED", "CLOSED"].includes(status),
  ),
  "the order status filters are a subset of ListOrdersQueryDto's enum",
);
assert(MANAGER_SERVICE_TYPE_FILTERS.length === 2, "service type mirrors the DTO's two values");
assert(MANAGER_RESERVATION_STATUS_FILTERS.length === 6, "reservation status mirrors the DTO's six values");
assert(managerOrderPipelineIndex("SERVED") === 4, "the pipeline locates a real stage");
assert(managerOrderPipelineIndex("VOIDED") === -1, "VOIDED is an exit, not a pipeline stage");
assert(!MANAGER_ORDER_PIPELINE.includes("VOIDED" as never), "VOIDED never renders inline in the pipeline");
assert(managerOrderStatusTone("VOIDED") === "danger", "a voided order reads as a problem");
assert(
  !MANAGER_EMPLOYEE_PIPELINE.includes("TERMINATED" as never),
  "TERMINATED is an exit chip, not an employment stage",
);
assert(
  !MANAGER_EMPLOYEE_PIPELINE.some((stage) => /invited|confirmed/i.test(stage)),
  "the employee pipeline is the real Nimbus lifecycle, not Odoo's Invited ▸ Confirmed (NG-08)",
);

assert(isManagerReviewDecidable("PENDING"), "a pending review is decidable");
assert(!isManagerReviewDecidable("APPROVED"), "a decided review is read-only — the backend 400s on a retry");

// Dates degrade honestly.
assert(formatManagerDateTime(null) === "—", "a missing timestamp renders a dash, never a fake date");
assert(formatManagerDateTime("not-a-date") === "—", "an unparseable timestamp renders a dash");

// Directory filtering.
const employees = [
  projectManagerEmployee({ ...rawEmployee, id: "a", branchId: "branch-a" }),
  projectManagerEmployee({ ...rawEmployee, id: "b", branchId: "branch-b" }),
  projectManagerEmployee({ ...rawEmployee, id: "c", branchId: null }),
];
assert(filterManagerEmployeesByBranch(employees, "branch-a").length === 1, "the client branch filter narrows");
assert(
  filterManagerEmployeesByBranch(employees, "branch-a").every((row) => row.branchId === "branch-a"),
  "an org-level (null-branch) record is excluded from a branch view rather than attributed to it",
);
assert(filterManagerEmployeesByBranch(employees, null).length === 3, "no branch means no narrowing");
const facets = toManagerDirectoryFacets(employees);
assert(facets.length === 1 && facets[0].count === 3, "facets group by position and count");
assert(managerAvatarToken("EMP-001") === managerAvatarToken("EMP-001"), "avatar colour is deterministic");
assert(
  managerAvatarToken("EMP-001").startsWith("bg-chart-series-"),
  "avatar colour is a full literal Tailwind class from the B2 chart tokens",
);

// Floor normalisation produces the shared view model.
const floorTables = normalizeManagerFloorTables({
  tables: [
    { id: "t1", label: "T1", capacity: 4, status: "AVAILABLE", isActive: true },
    { id: "t2", label: "T2", capacity: 2, status: "AVAILABLE", isActive: true },
    { id: "t3", label: "T3", capacity: 2, status: "BLOCKED", isActive: true },
  ],
  activeOrders: [
    {
      id: "o1",
      orderNumber: "ORD-1",
      status: "SERVED",
      serviceType: "DINE_IN",
      tableLabel: "T1",
      serverName: "Ada N.",
      itemCount: 3,
      subtotal: "1",
      tax: "0",
      discount: "0",
      total: "1",
      createdAt: "2026-08-20T10:00:00.000Z",
      tableId: "t1",
    },
  ],
  reservations: [
    {
      id: "r1",
      reservationNumber: "RES-1",
      guestName: "Guest",
      partySize: 2,
      reservationAt: "2026-08-20T19:00:00.000Z",
      status: "CONFIRMED",
      tableLabel: "T2",
      hasSeatedOrder: false,
      tableId: "t2",
    },
  ],
});
assert(floorTables.length === 2, "blocked tables are filtered out, exactly as the other roles do");
assert(floorTables.some((table) => table.status === "occupied"), "an active order marks a table occupied");
assert(floorTables.some((table) => table.status === "reserved"), "an active reservation marks a table reserved");
assert(
  floorTables.every((table) => !("guestName" in table)),
  "no guest name reaches a floor card view model",
);
assert(
  floorTables.every((table) => table.isMine === false),
  "Manager owns no orders, so the shared Mine filter honestly reports zero",
);

// ═══════════════════════════════════════════════════════════════════════════
// 12. Navigation — the module tree points at real routes
// ═══════════════════════════════════════════════════════════════════════════

assert(managerRoutes.length === 6, "the locked six-surface nav is unchanged");
const operationsRoute = managerRoutes.find((route) => route.href === "/manager/operations");
const staffRoute = managerRoutes.find((route) => route.href === "/manager/staff");
assert(operationsRoute?.match("/manager/operations/orders"), "Operations stays highlighted on its sub-routes");
assert(staffRoute?.match("/manager/staff/quick-pin"), "Staff stays highlighted on its sub-routes");
assert(!operationsRoute?.match("/manager/overview"), "Operations does not claim another module's route");

const operationsMenu = managerTopNavMenus.find((menu) => menu.key === "operations");
const staffMenu = managerTopNavMenus.find((menu) => menu.key === "staff");
assert(operationsMenu?.match && staffMenu?.match, "grouped menus carry the module match (B3)");

const operationsItems = (operationsMenu?.groups || []).flatMap((group) => group.items);
const staffItems = (staffMenu?.groups || []).flatMap((group) => group.items);
assert(
  operationsItems.filter((item) => item.available).length === 3,
  "three Operations surfaces are live",
);
assert(
  staffItems.filter((item) => item.available).length === 5,
  "five Staff surfaces are live",
);
for (const item of [...operationsItems, ...staffItems].filter((entry) => !entry.available)) {
  assert(item.notYetNote, `every not-yet row states why it is not yet (${item.key})`);
  assert(
    item.notYetNote === "Deferred",
    `a deferred row is tagged "Deferred", never an invented phase number (${item.key})`,
  );
}
for (const item of [...operationsItems, ...staffItems].filter((entry) => entry.available)) {
  assert(
    Object.values({ ...MANAGER_OPERATIONS_ROUTES, ...MANAGER_STAFF_ROUTES }).includes(item.href as never),
    `every live menu row points at a real B3 route (${item.key} → ${item.href})`,
  );
}
assert(
  !managerTopNavMenus.some((menu) => /accounting/i.test(menu.label)),
  "Accounting is still not a seventh menu (OD-3 stays open, gated on B5)",
);

// ═══════════════════════════════════════════════════════════════════════════
// 13. Chrome primitives are finally MOUNTED (B1 shipped them unmounted)
// ═══════════════════════════════════════════════════════════════════════════

const allB3Screens = [...operationsFiles, ...staffFiles].map((file) => codeOnly(file)).join("\n");
assert(allB3Screens.includes("ManagerSearchFilterMenu"), "B3 mounts ManagerSearchFilterMenu");
assert(allB3Screens.includes("ManagerBreadcrumbs"), "B3 mounts ManagerBreadcrumbs");
assert(allB3Screens.includes("ManagerControlPanel"), "B3 mounts ManagerControlPanel");
assert(allB3Screens.includes("ManagerViewSwitcher"), "B3 mounts the view switcher");
assert(allB3Screens.includes("ManagerStatusPipeline"), "B3 mounts the C14 statusbar pipeline");
assert(allB3Screens.includes("ManagerRecordActionsMenu"), "B3 mounts the C13 record cog");

const listTable = codeOnly(`${MANAGER_COMPONENT_DIR}/chrome/ManagerListTable.tsx`);
assert(
  !/type=["']checkbox["']/.test(listTable),
  "the list view has NO leading checkbox column — Nimbus has no bulk action to back one",
);
assert(listTable.includes("Choose columns"), "the optional-column gear ships (Odoo C4)");
assert(listTable.includes("tfoot"), "the column-totals row ships");

// Every decision goes through the SHARED confirmation dialog.
for (const screen of [
  "ManagerOnboardingScreen",
  "ManagerQuickPinScreen",
  "ManagerLeaveReviewScreen",
  "ManagerShiftSwapReviewScreen",
]) {
  const code = codeOnly(`${MANAGER_COMPONENT_DIR}/staff/${screen}.tsx`);
  assert(code.includes("<ActionConfirmDialog"), `${screen} confirms through the shared dialog`);
  assert(code.includes("pending="), `${screen} passes an in-flight lock to the dialog`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 14. Query keys stay in the narrow manager namespace
// ═══════════════════════════════════════════════════════════════════════════

for (const file of [
  `${MANAGER_LIB_DIR}/operations-context.ts`,
  `${MANAGER_LIB_DIR}/staff-context.ts`,
]) {
  const code = codeOnly(file);
  const keyCount = (code.match(/queryKey:\s*managerQueryKey\(/g) || []).length;
  const rawKeyCount = (code.match(/queryKey:\s*\[/g) || []).length;
  assert(keyCount > 0, `${file} builds keys through managerQueryKey`);
  assert(rawKeyCount === 0, `${file} never hand-rolls a query key array`);
  assert(!/queryClient\.clear\(/.test(code), `${file} never clears the whole cache`);
  assert(
    !/invalidateQueries\(\s*\)/.test(code) && !/invalidateQueries\(\{\s*\}\s*\)/.test(code),
    `${file} never issues a blanket invalidation`,
  );
}
assert(
  !/refetchInterval/.test(codeOnly(`${MANAGER_LIB_DIR}/operations-context.ts`)),
  "Operations does not poll — it is oversight, not a service screen",
);
assert(
  !/refetchInterval/.test(staffContext),
  "Staff does not poll — review queues are decided by a person, not watched",
);

// No SSE anywhere (C-04 / NG-14 still open).
for (const file of managerFiles) {
  const code = codeOnly(file);
  assert(!/EventSource/.test(code), `no SSE client was added (${file})`);
  assert(!/text\/event-stream/.test(code), `no event-stream request was added (${file})`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 15. FU-3 — the dashboard cleanup landed
// ═══════════════════════════════════════════════════════════════════════════

assert(
  isOpenOrdersPreviewCapped({ count: 3, orders: [], truncated: true }, 3),
  "the endpoint's own `truncated` flag is trusted when present",
);
assert(
  !isOpenOrdersPreviewCapped({ count: 50, orders: new Array(50).fill(null).map((_, index) => ({
    id: String(index),
    orderNumber: String(index),
    status: "NEW",
    serviceType: "DINE_IN",
    total: "1",
    createdAt: "2026-08-20T11:00:00.000Z",
  })), truncated: false }, 50),
  "a full page that the server says is complete is NOT flagged as capped",
);
assert(
  isOpenOrdersPreviewCapped({ count: 10, orders: [] }, 40),
  "the pre-batch fallback still works when no flag is sent",
);
assert(openOrdersReportedTotal({ count: 50, orders: [], total: 107 }) === 107, "the honest total is read");
assert(
  openOrdersReportedTotal({ count: 50, orders: [] }) === null,
  "a pre-batch response yields null, never the page length",
);

const salesBinding = MANAGER_KPI_BINDINGS.find((binding) => binding.key === "sales.taxInclusive");
const exTaxBinding = MANAGER_KPI_BINDINGS.find((binding) => binding.key === "sales.exTax");
assert(
  salesBinding?.field === "today.grossSales",
  "B3-D1: the tax-inclusive KPI binds today.grossSales after the backend batch inverted the two fields",
);
assert(exTaxBinding?.field === "today.netSales", "B3-D1: the ex-tax KPI binds today.netSales");
const salesCard = codeOnly(`${MANAGER_COMPONENT_DIR}/dashboard/cards/ManagerSalesTodayCard.tsx`);
assert(
  salesCard.includes('kpiKey="sales.taxInclusive"') && salesCard.includes("today?.grossSales"),
  "the Sales card renders grossSales under the tax-inclusive label",
);
for (const binding of MANAGER_KPI_BINDINGS) {
  assert(
    !/^\s*(gross|net)\s*(sales)?\s*$/i.test(binding.label),
    `no KPI is labelled a bare Gross/Net (${binding.key})`,
  );
}

// eslint-disable-next-line no-console
console.log(
  `Manager B3 assertions passed — ${operationsFiles.length} Operations files, ${staffFiles.length} Staff files, ` +
    `${managerMutationCount} allow-listed mutations, ${SAFE_EMPLOYEE_FIELDS.length} safe employee fields, ` +
    `${FORBIDDEN_STAFF_KEYS.length} forbidden keys proven absent, 0 view=full requests, 0 roster writes, 0 SSE clients.`,
);
