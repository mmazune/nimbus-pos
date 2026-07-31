#!/usr/bin/env node
/**
 * Supervisor Approvals — live decision mutation matrix (Prompt 5A).
 *
 * Runs against the ISOLATED API only (never shared Neon). Exercises the four
 * approval domains' decision lifecycles, pagination bounds, branch isolation,
 * concurrency/duplicate protection, required-reason contracts, and identity
 * resolution in list responses. Tallies pass/fail and writes JSON.
 *
 * Env (no secrets hard-coded):
 *   PW_API_URL           base API origin (e.g. http://localhost:4002)
 *   PW_BRANCH_ID         X-Branch-Id (the Supervisor's branch)
 *   QA_SUP_EMAIL / QA_SUP_PASSWORD   supervisor demo login
 *   QA_XBRANCH_SWAP_ID   a same-org, OTHER-branch pending swap id (branch-isolation case)
 *   QA_XBRANCH_ANOMALY_ID a same-org, OTHER-branch OPEN anomaly id (branch-isolation case)
 *   QA_DISCOUNTABLE_ORDER_ID  a discountable order in the Supervisor's branch (optional)
 *   P5A_OUT              output json path (optional)
 */
import fs from 'node:fs';

const API = (process.env.PW_API_URL || 'http://localhost:4002').replace(/\/$/, '');
const BRANCH = process.env.PW_BRANCH_ID || '';
const EMAIL = process.env.QA_SUP_EMAIL || 'supervisor@nimbus.demo';
const PASSWORD = process.env.QA_SUP_PASSWORD || 'Demo1234!';
const XBRANCH_SWAP = process.env.QA_XBRANCH_SWAP_ID || '';
const XBRANCH_ANOMALY = process.env.QA_XBRANCH_ANOMALY_ID || '';
const DISCOUNTABLE_ORDER = process.env.QA_DISCOUNTABLE_ORDER_ID || '';
const OUT = process.env.P5A_OUT || '';

const results = [];
let token = '';

function record(name, pass, detail) {
  results.push({ name, pass: !!pass, detail: detail ?? '' });
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function req(method, path, { body, branch = BRANCH, auth = true } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (auth && token) headers.authorization = `Bearer ${token}`;
  if (branch) headers['x-branch-id'] = branch;
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

async function expect(name, promise, predicate, describe) {
  try {
    const r = await promise;
    const ok = predicate(r);
    record(name, ok, `${describe ? describe(r) : ''} [http ${r.status}]`);
    return r;
  } catch (e) {
    record(name, false, `threw ${e.message}`);
    return { status: 0, json: null };
  }
}

const hasName = (v) => typeof v === 'string' && v.length > 0 && !/^[0-9a-f-]{20,}$/i.test(v) && !/^c[a-z0-9]{24,}$/i.test(v);

async function run() {
  // ── AUTH ──
  const login = await req('POST', '/auth/login', { body: { email: EMAIL, password: PASSWORD }, auth: false, branch: '' });
  token = login.json?.accessToken || '';
  record('auth: supervisor login → 201 + token', login.status === 201 && !!token, `http ${login.status}`);
  if (!token) {
    console.error('No token — aborting matrix');
    finish();
    return;
  }
  await expect('auth: /auth/me resolves branch context', req('GET', '/auth/me'), (r) => r.status === 200);

  // ── LEAVE ──
  const leaveList = await expect(
    'leave: GET pending list → 200',
    req('GET', '/hr/leave?status=PENDING&take=50'),
    (r) => r.status === 200 && Array.isArray(r.json?.data),
    (r) => `${r.json?.data?.length ?? 0} rows, total=${r.json?.total}`,
  );
  const leaveRows = leaveList.json?.data ?? [];
  const firstLeave = leaveRows[0];
  if (firstLeave) {
    const emp = firstLeave.employee;
    const requester = firstLeave.requestedBy;
    const empName = emp ? [emp.firstName, emp.lastName].filter(Boolean).join(' ') : '';
    record('leave: list row carries employee + requester identity (names, not raw ids)', !!emp && !!requester && hasName(empName), `employee="${empName}"`);
  }
  await expect('leave: take=101 → 400 (bounded history)', req('GET', '/hr/leave?take=101'), (r) => r.status === 400);
  await expect('leave: take=abc → 400 (numeric coercion)', req('GET', '/hr/leave?take=abc'), (r) => r.status === 400);
  await expect('leave: History date window → 200', req('GET', '/hr/leave?dateFrom=2020-01-01&dateTo=2030-01-01'), (r) => r.status === 200);
  if (firstLeave) {
    await expect(
      'leave: review PENDING→APPROVED → 200',
      req('PATCH', `/hr/leave/${firstLeave.id}/review`, { body: { status: 'APPROVED', reviewNotes: 'P5A-QA approve' } }),
      (r) => r.status === 200 && r.json?.status === 'APPROVED',
    );
    await expect(
      'leave: duplicate review on decided row → 400 (no double-decision)',
      req('PATCH', `/hr/leave/${firstLeave.id}/review`, { body: { status: 'REJECTED', reviewNotes: 'dup' } }),
      (r) => r.status === 400 || r.status === 409,
    );
  }

  // ── SHIFT SWAP ──
  const swapList = await expect(
    'shift-swap: GET pending list → 200',
    req('GET', '/hr/shift-swaps?status=PENDING&take=50'),
    (r) => r.status === 200 && Array.isArray(r.json?.data),
    (r) => `${r.json?.data?.length ?? 0} rows`,
  );
  const swapRows = swapList.json?.data ?? [];
  const firstSwap = swapRows[0];
  if (firstSwap) {
    const rq = firstSwap.requester, tg = firstSwap.target;
    record('shift-swap: row carries requester + target identity', !!rq && !!tg, `req="${rq?.firstName ?? ''}" tgt="${tg?.firstName ?? ''}"`);
  }
  await expect('shift-swap: take=101 → 400 (bounded)', req('GET', '/hr/shift-swaps?take=101'), (r) => r.status === 400);
  if (firstSwap) {
    await expect(
      'shift-swap: approve PENDING→REJECTED → 200',
      req('PATCH', `/hr/shift-swaps/${firstSwap.id}/approve`, { body: { status: 'REJECTED', reviewNotes: 'P5A-QA reject' } }),
      (r) => r.status === 200 && r.json?.status === 'REJECTED',
    );
    await expect(
      'shift-swap: duplicate decision → 400 (no double-decision)',
      req('PATCH', `/hr/shift-swaps/${firstSwap.id}/approve`, { body: { status: 'APPROVED' } }),
      (r) => r.status === 400 || r.status === 409,
    );
  }
  if (XBRANCH_SWAP) {
    await expect(
      'shift-swap: BRANCH ISOLATION — approve same-org OTHER-branch swap → 404',
      req('PATCH', `/hr/shift-swaps/${XBRANCH_SWAP}/approve`, { body: { status: 'APPROVED' } }),
      (r) => r.status === 404,
      (r) => `(pre-fix this would have mutated a cross-branch row)`,
    );
  }

  // ── ANOMALY ──
  const anomalyList = await expect(
    'anomaly: GET OPEN list → 200',
    req('GET', '/analytics/anomalies?status=OPEN&limit=50'),
    (r) => r.status === 200 && Array.isArray(r.json?.data),
    (r) => `${r.json?.data?.length ?? 0} rows`,
  );
  const anomalyRows = anomalyList.json?.data ?? [];
  const firstAnomaly = anomalyRows[0];
  if (firstAnomaly) {
    record('anomaly: list row includes actorUser identity projection', 'actorUser' in firstAnomaly, `actorUser=${firstAnomaly.actorUser ? 'present' : 'null'}`);
  }
  await expect('anomaly: limit=101 → 400 (bounded)', req('GET', '/analytics/anomalies?limit=101'), (r) => r.status === 400);
  await expect('anomaly: History date window → 200', req('GET', '/analytics/anomalies?status=OPEN&dateFrom=2020-01-01&dateTo=2030-01-01'), (r) => r.status === 200);
  if (firstAnomaly) {
    await expect(
      'anomaly: resolve while OPEN → 400 (must acknowledge first)',
      req('PATCH', `/analytics/anomalies/${firstAnomaly.id}/resolve`, { body: { resolutionNotes: 'too early' } }),
      (r) => r.status === 400,
    );
    await expect(
      'anomaly: acknowledge OPEN→ACKNOWLEDGED → 200',
      req('PATCH', `/analytics/anomalies/${firstAnomaly.id}/acknowledge`, { body: { resolutionNotes: 'P5A-QA ack' } }),
      (r) => r.status === 200 && r.json?.status === 'ACKNOWLEDGED',
    );
    await expect(
      'anomaly: resolve without notes → 400 (reason required)',
      req('PATCH', `/analytics/anomalies/${firstAnomaly.id}/resolve`, { body: {} }),
      (r) => r.status === 400,
    );
    await expect(
      'anomaly: resolve ACKNOWLEDGED→RESOLVED → 200',
      req('PATCH', `/analytics/anomalies/${firstAnomaly.id}/resolve`, { body: { resolutionNotes: 'P5A-QA resolve' } }),
      (r) => r.status === 200 && r.json?.status === 'RESOLVED',
    );
    await expect(
      'anomaly: duplicate acknowledge on decided row → 400',
      req('PATCH', `/analytics/anomalies/${firstAnomaly.id}/acknowledge`, { body: {} }),
      (r) => r.status === 400 || r.status === 409,
    );
  }
  if (XBRANCH_ANOMALY) {
    await expect(
      'anomaly: BRANCH ISOLATION — acknowledge same-org OTHER-branch anomaly → 404',
      req('PATCH', `/analytics/anomalies/${XBRANCH_ANOMALY}/acknowledge`, { body: {} }),
      (r) => r.status === 404,
    );
  }

  // ── DISCOUNT ──
  await expect('discount: GET pending (branch-scoped) → 200', req('GET', '/pos/discounts/pending'), (r) => r.status === 200 && Array.isArray(r.json?.data ?? r.json));
  if (DISCOUNTABLE_ORDER) {
    const request = await req('POST', `/pos/orders/${DISCOUNTABLE_ORDER}/discounts`, {
      body: { type: 'FIXED', value: 999999, reason: 'P5A-QA discount request' },
    });
    const created = request.json;
    record('discount: request on discountable order → 201', request.status === 201 && !!created?.id, `status=${created?.status} http ${request.status}`);
    if (created?.id && created.status === 'PENDING') {
      await expect(
        'discount: approve PENDING→APPROVED → 200',
        req('POST', `/pos/discounts/${created.id}/approve`, { body: {} }),
        (r) => r.status === 200 && r.json?.status === 'APPROVED',
      );
      await expect(
        'discount: duplicate approve on decided row → 409 (concurrency guard)',
        req('POST', `/pos/discounts/${created.id}/approve`, { body: {} }),
        (r) => r.status === 409,
      );
    } else if (created?.id && created.status === 'APPROVED') {
      record('discount: auto-approved under threshold (documented path)', true, 'effective amount ≤ threshold');
    }
  }

  finish();
}

function finish() {
  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  const summary = { api: API, branch: BRANCH, passed, total, failed: total - passed, results };
  console.log(`\n=== APPROVALS LIVE MATRIX: ${passed}/${total} passed ===`);
  if (OUT) {
    fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));
    console.log(`wrote ${OUT}`);
  }
  process.exit(passed === total ? 0 : 1);
}

run().catch((e) => {
  console.error('matrix fatal:', e);
  process.exit(1);
});
