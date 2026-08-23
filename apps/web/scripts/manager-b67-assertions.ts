import { existsSync, readFileSync } from "fs";
import { join } from "path";

/**
 * Track B6.7 — Manager-initiated credential (password) reset.
 * See docs/manager-settings-docs/CREDENTIAL_RESET.md for the full design.
 *
 * Encodes the SECURITY BOUNDARY from the B6.7 brief as executable checks:
 *
 *   1. the QA-only `_devOnlyDeliveryPreview` field is never read anywhere in
 *      the Manager frontend tree — the field exists on the wire only against
 *      a non-production API, but this UI must never surface it regardless;
 *   2. there is no Manager-set-password/PIN code path anywhere in the new
 *      component — no password-shaped input, no client-chosen secret sent to
 *      the trigger endpoint;
 *   3. the confirm dialog names the person by their display name;
 *   4. the trigger API function's return type carries only `expiresAt`, never
 *      a token/secret field;
 *   5. the new files exist.
 */

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Manager B6.7 assertion failed: ${message}`);
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

const MANAGER_LIB_DIR = "apps/web/src/lib/manager";
const MANAGER_COMPONENT_DIR = "apps/web/src/components/manager";

const NEW_FILES = [
  `${MANAGER_COMPONENT_DIR}/staff/ManagerCredentialResetAction.tsx`,
  `${MANAGER_LIB_DIR}/staff-api.ts`,
  `${MANAGER_LIB_DIR}/staff-context.ts`,
  `${MANAGER_LIB_DIR}/staff-types.ts`,
];
for (const file of NEW_FILES) {
  assert(existsSync(join(process.cwd(), file)), `expected B6.7 file exists: ${file}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. The dev-only token-preview field is never read by any Manager UI code.
// ═══════════════════════════════════════════════════════════════════════════

function listTsFiles(dir: string): string[] {
  const { readdirSync } = require("fs") as typeof import("fs");
  const absolute = join(process.cwd(), dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry: any) =>
    entry.isDirectory()
      ? listTsFiles(`${dir}/${entry.name}`)
      : entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")
        ? [`${dir}/${entry.name}`]
        : [],
  );
}

const managerFiles = [...listTsFiles(MANAGER_LIB_DIR), ...listTsFiles(MANAGER_COMPONENT_DIR)];
for (const file of managerFiles) {
  const code = codeOnly(file);
  assert(
    !code.includes("_devOnlyDeliveryPreview"),
    `_devOnlyDeliveryPreview must never be read in live code — found in ${file}`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. No Manager-set-secret code path — no password-shaped input, no
//    client-chosen value sent to the trigger endpoint.
// ═══════════════════════════════════════════════════════════════════════════

const actionCode = codeOnly(`${MANAGER_COMPONENT_DIR}/staff/ManagerCredentialResetAction.tsx`);
assert(!/type=["']password["']/.test(actionCode), "no password-typed input in the credential-reset action");
assert(!/<input/i.test(actionCode), "no raw <input> at all — the trigger takes no body");
assert(
  !/newPassword|resetToken|tempPassword|temporaryPassword/.test(actionCode),
  "no secret-shaped field is composed or sent from this component",
);

const staffApiCode = codeOnly(`${MANAGER_LIB_DIR}/staff-api.ts`);
const triggerFnMatch = staffApiCode.match(
  /export async function triggerManagerCredentialReset[\s\S]*?\n}/,
);
assert(triggerFnMatch, "triggerManagerCredentialReset is defined in staff-api.ts");
const triggerFnBody = triggerFnMatch![0];
assert(
  /body:\s*\{\s*\}/.test(triggerFnBody),
  "the trigger request body is empty — the Manager supplies nothing, not even a hint",
);
assert(
  !/newPassword|resetToken|pin\b/i.test(triggerFnBody),
  "the trigger function never composes a secret value into its request",
);

// ═══════════════════════════════════════════════════════════════════════════
// 3. The trigger API function's return type carries only `expiresAt`.
// ═══════════════════════════════════════════════════════════════════════════

assert(
  /Promise<\{\s*expiresAt:\s*string \| null;?\s*\}>/.test(staffApiCode),
  "triggerManagerCredentialReset's return type is exactly { expiresAt }",
);
assert(
  /return \{ expiresAt: str\(raw\.expiresAt\) \};/.test(staffApiCode),
  "the trigger function returns only expiresAt, dropping every other response field including any token",
);

// ═══════════════════════════════════════════════════════════════════════════
// 4. The confirm dialog names the person.
// ═══════════════════════════════════════════════════════════════════════════

assert(
  /title=\{`\$\{label\} for \$\{employee\.displayName\}\?`\}/.test(actionCode),
  "the confirm dialog title names the employee by display name",
);
assert(
  /consequence=\{`\$\{employee\.displayName\}/.test(actionCode),
  "the confirm dialog consequence copy names the employee by display name",
);

// ═══════════════════════════════════════════════════════════════════════════
// 5. Eligibility is read from the server, never re-derived from the backend's
//    synthetic-email convention on the frontend.
// ═══════════════════════════════════════════════════════════════════════════

assert(
  !/nimbus\.pin\.local|isSyntheticEmail/.test(actionCode) && !/nimbus\.pin\.local|isSyntheticEmail/.test(staffApiCode),
  "eligibility is read from the credential-reset status endpoint's own `eligible` field, never guessed from an email suffix",
);

console.log(
  "Manager B6.7 assertions passed — no dev-preview leakage, no Manager-set-secret path, " +
    "confirm dialog names the person, trigger return type carries only expiresAt, " +
    "eligibility never re-derived client-side.",
);
