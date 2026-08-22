import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

import { FORBIDDEN_STAFF_KEYS } from "../src/lib/manager/staff-projection";
import { MANAGER_INVITABLE_ROLES } from "../src/lib/manager/invitations-model";
import { MANAGER_SETTINGS_SECTIONS } from "../src/lib/manager/settings-model";
import { MANAGER_STAFF_ROUTES } from "../src/lib/manager/staff-route";
import { managerTopNavMenus } from "../src/lib/manager/top-nav";

/**
 * Track B6 — Manager Settings, Staff Onboarding, and Credential Management.
 *
 * Encodes the SECURITY BOUNDARY from the B6 brief as executable checks:
 *
 *   1. no compensation / PII field or `?view=full` request anywhere in the new
 *      settings/invitations code (reuses the B3 allow-list, never widens it);
 *   2. no plaintext secret is logged, cached, or persisted anywhere new;
 *   3. every destructive staff action's confirm dialog names the person;
 *   4. the dead/unconsumed settings fields (Platform access, Booking policies,
 *      Franchise weights) are never rendered;
 *   5. Invitations offers no branch picker (the backend ignores one) and only
 *      Manager/Accountant roles;
 *   6. the Settings screen has a real dirty-state navigation guard.
 */

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Manager B6 assertion failed: ${message}`);
}

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

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

const MANAGER_LIB_DIR = "apps/web/src/lib/manager";
const MANAGER_COMPONENT_DIR = "apps/web/src/components/manager";
const MANAGER_PAGES_DIR = "apps/web/src/pages/manager";

// The B6 file set specifically (a subset of the full Manager tree).
const B6_NEW_FILES = [
  `${MANAGER_LIB_DIR}/settings-api.ts`,
  `${MANAGER_LIB_DIR}/settings-model.ts`,
  `${MANAGER_LIB_DIR}/settings-context.ts`,
  `${MANAGER_LIB_DIR}/settings-types.ts`,
  `${MANAGER_LIB_DIR}/invitations-api.ts`,
  `${MANAGER_LIB_DIR}/invitations-model.ts`,
  `${MANAGER_LIB_DIR}/invitations-context.ts`,
  `${MANAGER_LIB_DIR}/invitations-types.ts`,
  `${MANAGER_COMPONENT_DIR}/settings/ManagerSettingsScreen.tsx`,
  `${MANAGER_COMPONENT_DIR}/settings/ManagerCurrencySection.tsx`,
  `${MANAGER_COMPONENT_DIR}/settings/ManagerTaxMatrixSection.tsx`,
  `${MANAGER_COMPONENT_DIR}/settings/ManagerRoundingSection.tsx`,
  `${MANAGER_COMPONENT_DIR}/settings/ManagerThresholdsSection.tsx`,
  `${MANAGER_COMPONENT_DIR}/settings/ManagerOperationsSection.tsx`,
  `${MANAGER_COMPONENT_DIR}/settings/ManagerTolerancesSection.tsx`,
  `${MANAGER_COMPONENT_DIR}/settings/ManagerExchangeRatesSection.tsx`,
  `${MANAGER_COMPONENT_DIR}/staff/ManagerEmployeeStatusAction.tsx`,
  `${MANAGER_COMPONENT_DIR}/staff/ManagerInvitationsScreen.tsx`,
  `${MANAGER_PAGES_DIR}/staff/invitations.tsx`,
];

// ═══════════════════════════════════════════════════════════════════════════
// 1. Files exist
// ═══════════════════════════════════════════════════════════════════════════

for (const file of B6_NEW_FILES) {
  assert(existsSync(join(process.cwd(), file)), `expected B6 file exists: ${file}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. HARD GUARD — no compensation/PII leak, no ?view=full, in the B6 file set
// ═══════════════════════════════════════════════════════════════════════════

for (const file of B6_NEW_FILES) {
  const code = codeOnly(file);
  assert(!/view=full/.test(code), `${file} never requests ?view=full`);
  assert(
    !/hr\/compensation-profiles/.test(code),
    `${file} never calls the compensation-profiles endpoint`,
  );
  for (const key of FORBIDDEN_STAFF_KEYS) {
    // A handful of forbidden keys (e.g. "notes") are common English words that
    // could appear in unrelated prose (a UI label, a code comment already
    // stripped above). Match as a quoted/property-style token to avoid false
    // positives on ordinary sentences.
    const tokenPattern = new RegExp(`["'\`]${key}["'\`]|\\.${key}\\b|${key}:`);
    assert(!tokenPattern.test(code), `${file} references no forbidden staff key ("${key}")`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. HARD GUARD — no plaintext secret logged, cached, or persisted
// ═══════════════════════════════════════════════════════════════════════════

for (const file of [
  `${MANAGER_LIB_DIR}/invitations-api.ts`,
  `${MANAGER_LIB_DIR}/invitations-context.ts`,
  `${MANAGER_COMPONENT_DIR}/staff/ManagerInvitationsScreen.tsx`,
]) {
  const code = codeOnly(file);
  assert(!/console\.(log|warn|error|info|debug)/.test(code), `${file} contains no console.* call`);
  assert(!/localStorage|sessionStorage/.test(code), `${file} never touches Web Storage`);
}
// The temp password / invitation token are mutation results only (never a
// useQuery), matching the Quick-PIN one-time-secret precedent from B3.
const invitationsContext = codeOnly(`${MANAGER_LIB_DIR}/invitations-context.ts`);
assert(
  /createMutation\s*=\s*useMutation/.test(invitationsContext),
  "invitation creation is a mutation, not a cached query",
);

// ═══════════════════════════════════════════════════════════════════════════
// 4. Every destructive staff action names the person in its confirm dialog
// ═══════════════════════════════════════════════════════════════════════════

function titleNamesToken(code: string, token: string) {
  const titleIndex = code.indexOf("title={");
  if (titleIndex === -1) return false;
  // The `title` prop's own value ends at the matching top-level `}` of the
  // opening `{` — walk forward tracking brace depth rather than a naive
  // `[^}]*` regex, which stops at the FIRST `}` (e.g. the end of a
  // `${pendingAction.label}` template interpolation) long before the prop
  // value actually ends.
  let depth = 0;
  let end = titleIndex + "title={".length - 1;
  for (let i = titleIndex + "title={".length - 1; i < code.length; i += 1) {
    if (code[i] === "{") depth += 1;
    else if (code[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  return code.slice(titleIndex, end + 1).includes(token);
}

const statusActionSource = codeOnly(`${MANAGER_COMPONENT_DIR}/staff/ManagerEmployeeStatusAction.tsx`);
assert(
  titleNamesToken(statusActionSource, "employee.displayName"),
  "the employee status confirm dialog title names the person",
);
assert(
  /ActionConfirmDialog/.test(statusActionSource),
  "employee status changes go through the shared ActionConfirmDialog",
);

const invitationsScreenSource = codeOnly(`${MANAGER_COMPONENT_DIR}/staff/ManagerInvitationsScreen.tsx`);
assert(
  titleNamesToken(invitationsScreenSource, "pendingRevoke.displayName"),
  "the revoke-invitation confirm dialog title names the person",
);

// ═══════════════════════════════════════════════════════════════════════════
// 5. Dead/unconsumed settings fields are never rendered
// ═══════════════════════════════════════════════════════════════════════════

const settingsComponentFiles = listFiles(`${MANAGER_COMPONENT_DIR}/settings`);
assert(settingsComponentFiles.length >= 9, `Settings ships its screens (found ${settingsComponentFiles.length})`);

for (const file of settingsComponentFiles) {
  const code = codeOnly(file);
  assert(!/useRoleDefaults/.test(code), `${file} never renders Platform access (dead config, no consumer)`);
  assert(!/bookingPolicies/.test(code), `${file} never renders Booking policies (no consumer anywhere)`);
  assert(!/franchiseWeights/.test(code), `${file} never edits Franchise weights (Manager lacks :update)`);
  assert(!/parameters:\s*{/.test(code), `${file} renders no free-form parameters editor`);
}

assert(
  MANAGER_SETTINGS_SECTIONS.length === 7,
  `exactly 7 Settings sections are registered (found ${MANAGER_SETTINGS_SECTIONS.length})`,
);

// ═══════════════════════════════════════════════════════════════════════════
// 6. Invitations: no branch picker, Manager/Accountant only
// ═══════════════════════════════════════════════════════════════════════════

assert(
  MANAGER_INVITABLE_ROLES.length === 2 &&
    MANAGER_INVITABLE_ROLES.includes("Manager") &&
    MANAGER_INVITABLE_ROLES.includes("Accountant"),
  "only Manager and Accountant are invitable through this path",
);
assert(
  !/branchId:\s*draft/.test(invitationsScreenSource) && !/<select[^>]*branch/i.test(invitationsScreenSource),
  "the invitation form renders no branch picker — the backend ignores one",
);
assert(
  /oldest active branch|does not offer a choice/i.test(invitationsScreenSource),
  "the invitation form discloses that branch assignment is not the caller's choice",
);

// ═══════════════════════════════════════════════════════════════════════════
// 7. Settings has a real dirty-state navigation guard
// ═══════════════════════════════════════════════════════════════════════════

const settingsScreenSource = codeOnly(`${MANAGER_COMPONENT_DIR}/settings/ManagerSettingsScreen.tsx`);
assert(/routeChangeStart/.test(settingsScreenSource), "Settings guards in-app navigation while dirty");
assert(/beforeunload/.test(settingsScreenSource), "Settings guards tab close/refresh while dirty");
assert(/onDirtyChange/.test(settingsScreenSource), "Settings tracks each section's dirty state");

// ═══════════════════════════════════════════════════════════════════════════
// 8. Navigation — Invitations is wired into the Staff menu at a real route
// ═══════════════════════════════════════════════════════════════════════════

const staffMenu = managerTopNavMenus.find((menu) => menu.key === "staff");
const staffItems = (staffMenu?.groups || []).flatMap((group) => group.items);
const invitationsItem = staffItems.find((item) => item.key === "staff-invitations");
assert(invitationsItem?.available, "the Invitations row is live in the Staff menu");
assert(invitationsItem?.href === MANAGER_STAFF_ROUTES.invitations, "the Invitations row points at the real route");

console.log(
  `Manager B6 assertions passed — ${B6_NEW_FILES.length} new files, ` +
    `${FORBIDDEN_STAFF_KEYS.length} forbidden keys proven absent from the B6 file set, ` +
    `${MANAGER_SETTINGS_SECTIONS.length} settings sections, ` +
    `${MANAGER_INVITABLE_ROLES.length} invitable roles.`,
);
