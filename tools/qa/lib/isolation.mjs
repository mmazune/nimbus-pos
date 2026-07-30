// Fail-closed isolation helpers for disposable-branch QA (Supervisor Prompt 4D).
//
// Root cause this addresses (Prompt 4C incident): an inherited shell/profile DATABASE_URL
// overrode a swapped apps/api/.env, so an "isolated" API silently connected to shared Neon.
// `dotenv` never overrides an already-set process.env var, so the ONLY safe isolation is to
// construct the child process environment explicitly — delete every inherited DB/service key,
// then set the disposable values. No secrets are stored in this file.

/** Keys that could redirect a child process at a shared/production database. */
export const INHERITED_DB_KEYS = [
  'DATABASE_URL',
  'DIRECT_URL',
  'DIRECT_DATABASE_URL',
  'SHADOW_DATABASE_URL',
  'PGHOST',
  'PGHOSTADDR',
  'PGPORT',
  'PGDATABASE',
  'PGUSER',
  'PGPASSWORD',
];

/** Keys that could redirect a child process at a shared/production service (API/web). */
export const INHERITED_SERVICE_KEYS = [
  'API_PORT',
  'API_CORS_ORIGINS',
  'NEXT_PUBLIC_API_BASE_URL',
  'PW_API_URL',
  'PW_BASE_URL',
  'PW_BRANCH_ID',
];

/** Parse a postgres connection URL without exposing the password. */
export function parsePgUrl(url) {
  const u = new URL(url);
  return { host: u.hostname, port: u.port, db: u.pathname.replace(/^\//, ''), user: u.username };
}

/** Redact everything except the Neon endpoint id in a host. Safe for logs/reports. */
export function redactHost(host) {
  const m = /^(ep-[a-z0-9]+-[a-z0-9]+)/.exec(host || '');
  return m ? `${m[1]}…(redacted)` : '(redacted-host)';
}

/**
 * Fail-closed denylist. Throws unless the target URL matches the expected disposable endpoint
 * AND matches none of the forbidden (shared/production) identifiers.
 */
export function assertDisposableTarget(url, opts = {}) {
  const { expectedHostSubstr = '', forbiddenHostSubstrs = [] } = opts;
  if (!url) throw new Error('ISOLATION FAIL: no target DATABASE_URL provided (fail-closed)');
  const { host, db } = parsePgUrl(url);
  for (const bad of forbiddenHostSubstrs) {
    if (bad && host.includes(bad)) {
      throw new Error(`ISOLATION FAIL: target host matches forbidden/shared identifier "${bad}" — refusing`);
    }
  }
  if (expectedHostSubstr && !host.includes(expectedHostSubstr)) {
    throw new Error(
      `ISOLATION FAIL: target host does not match expected disposable endpoint "${expectedHostSubstr}" — refusing`,
    );
  }
  return { host, db };
}

/**
 * Build an explicit child-process environment for an isolated QA process.
 * Every inherited DB/service key is DELETED first (fail-closed), then `isolated` is applied.
 */
export function buildIsolatedChildEnv(baseEnv, isolated = {}) {
  const env = { ...baseEnv };
  for (const k of [...INHERITED_DB_KEYS, ...INHERITED_SERVICE_KEYS]) delete env[k];
  return { ...env, ...isolated };
}
