#!/usr/bin/env node
// Fail-closed launcher for the isolated Nimbus API against a disposable Neon branch (Prompt 4D).
//
// Order of operations (all fail-closed):
//   1. build an EXPLICIT child environment — delete inherited DB/service vars, set disposable ones
//   2. run the production/shared-target denylist on the disposable URL
//   3. run the DB-identity preflight with the EXACT child env the API will use
//   4. ONLY on success, spawn `node dist/main.js` (the API) with that child env
//
// The disposable connection string is read from a git-ignored secret env file (never committed,
// never printed). Everything else comes from non-secret QA_* identifiers.
//
//   QA_SECRET_ENV_FILE   path to a file containing QA_DATABASE_URL=... (or pass as argv[2])
//   QA_EXPECTED_HOST_SUBSTR / QA_FORBIDDEN_HOST_SUBSTRS / QA_EXPECTED_BRANCH /
//   QA_SENTINEL_MARKER / QA_EXPECTED_BRANCH_ROW   identity inputs (see preflight)
//   QA_API_PORT (default 4002)   QA_WEB_ORIGIN (default http://localhost:3101)
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { buildIsolatedChildEnv, assertDisposableTarget, redactHost } from './lib/isolation.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

function loadSecretEnv(file) {
  const out = {};
  if (file && fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m) out[m[1]] = m[2];
    }
  }
  return out;
}

const secretFile = process.env.QA_SECRET_ENV_FILE || process.argv[2];
const secrets = loadSecretEnv(secretFile);
const qaUrl = process.env.QA_DATABASE_URL || secrets.QA_DATABASE_URL;
const apiPort = process.env.QA_API_PORT || '4002';
const webOrigin = process.env.QA_WEB_ORIGIN || 'http://localhost:3101';
const expectedHostSubstr = process.env.QA_EXPECTED_HOST_SUBSTR || '';
const forbiddenHostSubstrs = (process.env.QA_FORBIDDEN_HOST_SUBSTRS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// (2) denylist BEFORE constructing anything else
try {
  const { host, db } = assertDisposableTarget(qaUrl, { expectedHostSubstr, forbiddenHostSubstrs });
  console.log(`[launcher] denylist passed: ${redactHost(host)} db=${db}`);
} catch (e) {
  console.error(`[launcher] ${e.message}`);
  process.exit(2);
}

// (1) explicit child env — inherited DB/service keys are stripped, disposable values applied
const childEnv = buildIsolatedChildEnv(process.env, {
  DATABASE_URL: qaUrl,
  DIRECT_DATABASE_URL: qaUrl,
  API_PORT: apiPort,
  API_CORS_ORIGINS: webOrigin,
  QA_EXPECTED_HOST_SUBSTR: expectedHostSubstr,
  QA_FORBIDDEN_HOST_SUBSTRS: process.env.QA_FORBIDDEN_HOST_SUBSTRS || '',
  QA_EXPECTED_BRANCH: process.env.QA_EXPECTED_BRANCH || '',
  QA_SENTINEL_MARKER: process.env.QA_SENTINEL_MARKER || '',
  QA_EXPECTED_BRANCH_ROW: process.env.QA_EXPECTED_BRANCH_ROW || '',
});

// (3) preflight with the EXACT child env
const pf = spawnSync(process.execPath, [path.join(here, 'db-identity-preflight.mjs')], {
  env: childEnv,
  stdio: 'inherit',
});
if (pf.status !== 0) {
  console.error('[launcher] preflight FAILED — refusing to start the API (fail-closed)');
  process.exit(3);
}

// (4) spawn API only after isolation is proven
console.log(`[launcher] preflight passed — starting isolated API on :${apiPort} (CORS ${webOrigin})`);
const api = spawn(process.execPath, ['dist/main.js'], {
  cwd: path.join(repoRoot, 'apps', 'api'),
  env: childEnv,
  stdio: 'inherit',
});
api.on('exit', (c) => process.exit(c ?? 0));
