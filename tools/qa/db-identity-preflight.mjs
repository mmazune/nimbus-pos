#!/usr/bin/env node
// Executable, fail-closed database-identity preflight (Supervisor Prompt 4D).
//
// Uses the SAME generated Prisma client the API uses (resolved from packages/db), so it proves
// identity for the exact datasource the API will connect to. Exits non-zero on ANY mismatch and
// NEVER prints credentials. Health checks alone cannot prove branch identity — this can.
//
// Required env (set by the launcher into the child environment):
//   DATABASE_URL              the disposable connection string under test
//   QA_EXPECTED_HOST_SUBSTR   disposable endpoint id that MUST appear in the host
//   QA_FORBIDDEN_HOST_SUBSTRS csv of shared/production endpoint ids that MUST NOT appear
//   QA_SENTINEL_MARKER        disposable-branch-only sentinel marker that MUST be present
//   QA_EXPECTED_BRANCH        expected sentinel branch_id
//   QA_EXPECTED_BRANCH_ROW    (optional) a demo branch id that must exist (data sanity)
//   QA_REQUIRED_MIGRATION     (optional) migration that must be applied
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { redactHost, assertDisposableTarget } from './lib/isolation.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(here, '../../packages/db/package.json'));
const { PrismaClient } = require('@prisma/client');

const url = process.env.DATABASE_URL;
const expectedHostSubstr = process.env.QA_EXPECTED_HOST_SUBSTR || '';
const forbiddenHostSubstrs = (process.env.QA_FORBIDDEN_HOST_SUBSTRS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const expectedBranch = process.env.QA_EXPECTED_BRANCH || '';
const sentinelMarker = process.env.QA_SENTINEL_MARKER || '';
const expectedBranchRow = process.env.QA_EXPECTED_BRANCH_ROW || '';
const requiredMigration =
  process.env.QA_REQUIRED_MIGRATION || '20260518000000_prompt4a_reservation_completed_event';

function fail(msg) {
  console.error(`[preflight] ✗ ${msg}`);
  process.exit(1);
}
function ok(msg) {
  console.log(`[preflight] ✓ ${msg}`);
}

let host, db;
try {
  ({ host, db } = assertDisposableTarget(url, { expectedHostSubstr, forbiddenHostSubstrs }));
} catch (e) {
  fail(e.message);
}
ok(`denylist passed: host ${redactHost(host)} db=${db} (expected "${expectedHostSubstr}", forbidden ${JSON.stringify(forbiddenHostSubstrs)})`);

const prisma = new PrismaClient();
try {
  await prisma.$queryRawUnsafe('SELECT 1');
  ok('prisma connected with the isolated DATABASE_URL');

  if (!sentinelMarker) fail('no QA_SENTINEL_MARKER supplied — refusing to proceed (fail-closed)');
  const rows = await prisma.$queryRawUnsafe(
    'SELECT marker, branch_id FROM _p4d_qa_sentinel WHERE marker = $1',
    sentinelMarker,
  );
  if (!rows.length)
    fail(`disposable sentinel "${sentinelMarker}" NOT found — this is NOT the disposable branch (fail-closed)`);
  if (expectedBranch && rows[0].branch_id !== expectedBranch)
    fail(`sentinel branch_id ${rows[0].branch_id} != expected ${expectedBranch}`);
  ok(`disposable sentinel present (marker=${sentinelMarker}, branch=${rows[0].branch_id})`);

  const mig = await prisma.$queryRawUnsafe(
    'SELECT 1 FROM _prisma_migrations WHERE migration_name = $1 AND finished_at IS NOT NULL',
    requiredMigration,
  );
  if (!mig.length) fail(`required migration ${requiredMigration} not applied`);
  ok(`required migration applied: ${requiredMigration}`);

  const en = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM pg_enum WHERE enumtypid = 'public."ReservationEventType"'::regtype AND enumlabel = 'COMPLETED'`,
  );
  if (!en.length) fail('ReservationEventType.COMPLETED missing');
  ok('ReservationEventType.COMPLETED present');

  if (expectedBranchRow) {
    const br = await prisma.$queryRawUnsafe('SELECT 1 FROM branches WHERE id = $1', expectedBranchRow);
    if (!br.length) fail(`expected demo branch row ${expectedBranchRow} missing`);
    ok(`demo branch row present: ${expectedBranchRow}`);
  }

  console.log('[preflight] ✅ ISOLATION VERIFIED — safe to run mutation QA against the disposable branch');
  await prisma.$disconnect();
  process.exit(0);
} catch (e) {
  await prisma.$disconnect().catch(() => {});
  fail(e.message);
}
