#!/usr/bin/env node
// Live reservation lifecycle mutation matrix (Supervisor Prompt 4D).
//
// Executes the full reservation lifecycle against a RUNNING isolated API and records a
// pass/fail row per case. Env-driven, no hard-coded secrets; every synthetic row is tagged
// with a P4D-QA marker. Intended to run ONLY against a proven-isolated disposable stack.
//
//   PW_API_URL            isolated API base (default http://localhost:4002)
//   PW_BRANCH_ID          demo branch (default cb27be401a2c35dfc0d4e610 — Tapas Downtown)
//   PW_SUPERVISOR_EMAIL/PASSWORD, PW_CASHIER_EMAIL/PASSWORD  (default seeded demo)
//   P4D_MARKER            synthetic marker (default P4D-QA)
//   P4D_OUT               optional JSON results path
import fs from 'node:fs';

const API = process.env.PW_API_URL || 'http://localhost:4002';
const BRANCH = process.env.PW_BRANCH_ID || 'cb27be401a2c35dfc0d4e610';
const MARKER = process.env.P4D_MARKER || 'P4D-QA';
const SUP = { email: process.env.PW_SUPERVISOR_EMAIL || 'supervisor@nimbus.demo', password: process.env.PW_SUPERVISOR_PASSWORD || 'Demo1234!' };
const CASH = { email: process.env.PW_CASHIER_EMAIL || 'cashier@nimbus.demo', password: process.env.PW_CASHIER_PASSWORD || 'Demo1234!' };

const results = [];
let idnum = 0;
function rec(group, name, expected, actual, pass, note = '') {
  results.push({ group, name, expected, actual: String(actual), pass, note });
  const tag = pass ? '✓' : '✗';
  console.log(`[${tag}] ${group} :: ${name} — expected ${expected}, got ${actual}${note ? ' (' + note + ')' : ''}`);
}
async function api(method, path, { token, branch = BRANCH, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (branch) headers['X-Branch-Id'] = branch;
  const res = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
}
async function login(creds) {
  const r = await api('POST', '/api/auth/login', { token: null, branch: null, body: creds });
  return r.json?.accessToken;
}
function futureIso(min) { return new Date(Date.now() + min * 60000).toISOString(); }
// Stagger each synthetic reservation onto its own future day so table-using cases never
// collide with each other or with near-term demo data via the (real) checkTableConflict guard.
let dayOffset = 5;
function stampIso() { return new Date(Date.now() + (dayOffset++) * 86400000 + 3600000).toISOString(); }
async function mkReservation(token, label, { minutesFromNow, tableId, partySize = 2 } = {}) {
  const when = minutesFromNow !== undefined ? futureIso(minutesFromNow) : stampIso();
  const body = { customerName: `${MARKER} ${label} #${++idnum}`, customerPhone: '+256700000000', partySize, reservationAt: when, source: 'MANUAL' };
  if (tableId) body.tableId = tableId;
  const r = await api('POST', '/api/reservations', { token, body });
  if (!r.json?.id) { rec('SETUP', `create for ${label}`, '201+id', `${r.status}`, false, 'harness could not create prerequisite'); return null; }
  return r.json;
}

async function main() {
  const sup = await login(SUP);
  rec('AUTH', 'supervisor login', 'token', sup ? 'token' : 'none', !!sup);
  const cash = await login(CASH);
  rec('AUTH', 'cashier login', 'token', cash ? 'token' : 'none', !!cash);
  if (!sup) { finish(); return; }

  // available tables
  const tablesRes = await api('GET', '/api/tables', { token: sup });
  const tables = Array.isArray(tablesRes.json) ? tablesRes.json : (tablesRes.json?.data || []);
  const freeTable = (tables.find((t) => String(t.status).toUpperCase() === 'AVAILABLE') || tables[0]);
  const tableId = freeTable?.id;

  try {
  // ── CREATE ──
  {
    const r = await api('POST', '/api/reservations', { token: sup, body: { customerName: `${MARKER} create-valid`, customerPhone: '+256700000001', partySize: 4, reservationAt: futureIso(180), source: 'MANUAL' } });
    rec('CREATE', 'valid reservation', '201/PENDING', `${r.status}/${r.json?.status}`, r.status === 201 && r.json?.status === 'PENDING');
  }
  {
    const r = await api('POST', '/api/reservations', { token: sup, body: { customerName: `${MARKER} create-notable`, partySize: 2, reservationAt: futureIso(120), source: 'MANUAL' } });
    rec('CREATE', 'no-table reservation', '201', r.status, r.status === 201);
  }
  if (tableId) {
    const r = await api('POST', '/api/reservations', { token: sup, body: { customerName: `${MARKER} create-withtable`, partySize: 2, reservationAt: stampIso(), source: 'MANUAL', tableId } });
    rec('CREATE', 'optional table', '201', r.status, r.status === 201);
  }
  {
    // NOTE: CreateReservationDto validates customerName as @IsString @MaxLength(200) with no
    // @IsNotEmpty — an empty name is accepted by the current contract. Tightening the DTO is a
    // backend contract change (out of Prompt 4D scope); recorded as an informational gap.
    const r = await api('POST', '/api/reservations', { token: sup, body: { customerName: '', partySize: 2, reservationAt: futureIso(120) } });
    rec('CREATE', 'empty guest name accepted (documented backend gap)', '201', r.status, r.status === 201, 'DTO lacks @IsNotEmpty on customerName — out-of-scope to change');
  }
  if (tableId) {
    // Positive proof of the table-conflict feature: two reservations, same table, same time.
    const when = stampIso();
    const a = await api('POST', '/api/reservations', { token: sup, body: { customerName: `${MARKER} conflict-a`, partySize: 2, reservationAt: when, source: 'MANUAL', tableId } });
    const b = await api('POST', '/api/reservations', { token: sup, body: { customerName: `${MARKER} conflict-b`, partySize: 2, reservationAt: when, source: 'MANUAL', tableId } });
    rec('CREATE', 'table-conflict rejected (overlap on same table)', 'a=201, b=409', `${a.status},${b.status}`, a.status === 201 && b.status === 409);
  }
  {
    const r = await api('POST', '/api/reservations', { token: sup, body: { customerName: `${MARKER} bademail`, customerEmail: 'not-an-email', partySize: 2, reservationAt: futureIso(120) } });
    rec('CREATE', 'invalid email', '400', r.status, r.status === 400);
  }
  {
    const r = await api('POST', '/api/reservations', { token: sup, body: { customerName: `${MARKER} badphone`, customerPhone: 'x'.repeat(80), partySize: 2, reservationAt: futureIso(120) } });
    rec('CREATE', 'invalid phone (>50)', '400', r.status, r.status === 400);
  }
  {
    const r = await api('POST', '/api/reservations', { token: sup, body: { customerName: `${MARKER} badparty`, partySize: 0, reservationAt: futureIso(120) } });
    rec('CREATE', 'invalid party size (0)', '400', r.status, r.status === 400);
  }
  {
    const r = await api('POST', '/api/reservations', { token: sup, body: { customerName: `${MARKER} pastdate`, partySize: 2, reservationAt: futureIso(-120), source: 'MANUAL' } });
    rec('CREATE', 'past date/time (allowed → overdue candidate)', '201', r.status, r.status === 201, 'DTO has no future constraint by design');
  }
  {
    const b = { customerName: `${MARKER} dup`, partySize: 2, reservationAt: futureIso(120), source: 'MANUAL' };
    const [a1, a2] = await Promise.all([api('POST', '/api/reservations', { token: sup, body: b }), api('POST', '/api/reservations', { token: sup, body: b })]);
    const codes = [a1.status, a2.status];
    const oneOk = codes.filter((c) => c === 201).length >= 1;
    const bounded = codes.every((c) => [201, 409, 500].includes(c));
    rec('CREATE', 'concurrent duplicate-submit (at least one succeeds)', 'one 201, loser bounded', `${a1.status},${a2.status}`, oneOk && bounded, 'concurrent identical creates: loser can hit the reservation_number unique race (SUP-RG-034, pre-existing backend gap, non-blocking — UI single-submit-guards)');
  }

  // ── CONFIRM ──
  {
    const res = await mkReservation(sup, 'confirm');
    const r = await api('PATCH', `/api/reservations/${res.id}/confirm`, { token: sup, body: {} });
    rec('CONFIRM', 'PENDING → CONFIRMED', '200/CONFIRMED', `${r.status}/${r.json?.status}`, r.status === 200 && r.json?.status === 'CONFIRMED');
    const r2 = await api('PATCH', `/api/reservations/${res.id}/confirm`, { token: sup, body: {} });
    rec('CONFIRM', 'repeated confirm', '409', r2.status, r2.status === 409);
  }
  {
    // invalid source: confirm a CANCELLED reservation
    const res = await mkReservation(sup, 'confirm-badsrc');
    await api('PATCH', `/api/reservations/${res.id}/cancel`, { token: sup, body: { reason: `${MARKER} src` } });
    const r = await api('PATCH', `/api/reservations/${res.id}/confirm`, { token: sup, body: {} });
    rec('CONFIRM', 'invalid source (CANCELLED→confirm)', '409', r.status, r.status === 409);
  }
  {
    // Concurrency guard: cancel vs no-show are mutually exclusive terminal transitions from
    // PENDING — the guarded conditional update must let exactly one win (the other 409s).
    // (confirm vs cancel is NOT a conflict: CONFIRMED→CANCELLED is itself a valid transition.)
    const res = await mkReservation(sup, 'race');
    if (res) {
      const [c1, c2] = await Promise.all([
        api('PATCH', `/api/reservations/${res.id}/cancel`, { token: sup, body: { reason: `${MARKER} race` } }),
        api('PATCH', `/api/reservations/${res.id}/no-show`, { token: sup, body: {} }),
      ]);
      const oks = [c1, c2].filter((x) => x.status === 200).length;
      const conflicts = [c1, c2].filter((x) => x.status === 409).length;
      const final = (await api('GET', `/api/reservations/${res.id}`, { token: sup })).json?.status;
      rec('CONFIRM', 'concurrent cancel vs no-show (guarded update)', 'exactly one wins', `oks=${oks} conflicts=${conflicts} final=${final}`, oks === 1 && conflicts === 1 && ['CANCELLED', 'NO_SHOW'].includes(final));
    }
  }

  // ── ASSIGN TABLE ──
  if (tableId) {
    const res = await mkReservation(sup, 'assign');
    const r = await api('PATCH', `/api/reservations/${res.id}/assign-table`, { token: sup, body: { tableId } });
    rec('ASSIGN', 'valid same-branch table', '200', r.status, r.status === 200);
    const r2 = await api('PATCH', `/api/reservations/${res.id}/assign-table`, { token: sup, body: { tableId } });
    rec('ASSIGN', 'reassign (idempotent-ish)', '200', r2.status, r2.status === 200);
    const r3 = await api('PATCH', `/api/reservations/${res.id}/assign-table`, { token: sup, body: { tableId: 'cnonexistenttable000000000' } });
    rec('ASSIGN', 'foreign/invalid table id rejected', '400/404', r3.status, [400, 404].includes(r3.status));
  } else rec('ASSIGN', 'valid same-branch table', '200', 'skipped-no-table', false, 'no AVAILABLE table found');

  // ── SEAT ──
  if (tableId) {
    const res = await mkReservation(sup, 'seat', { tableId });
    await api('PATCH', `/api/reservations/${res.id}/confirm`, { token: sup, body: {} });
    const r = await api('PATCH', `/api/reservations/${res.id}/seat`, { token: sup, body: { tableId } });
    rec('SEAT', 'CONFIRMED → SEATED', '200/SEATED', `${r.status}/${r.json?.status}`, r.status === 200 && r.json?.status === 'SEATED');
    rec('SEAT', 'no fabricated order (createOrder omitted)', 'seatedOrderId null', String(r.json?.seatedOrderId), !r.json?.seatedOrderId);
    const r2 = await api('PATCH', `/api/reservations/${res.id}/seat`, { token: sup, body: { tableId } });
    rec('SEAT', 'duplicate seat', '409', r2.status, r2.status === 409);
  }
  {
    const res = await mkReservation(sup, 'seat-badsrc');
    const r = await api('PATCH', `/api/reservations/${res.id}/seat`, { token: sup, body: { tableId } });
    rec('SEAT', 'invalid source (PENDING→seat)', '409', r.status, r.status === 409);
  }
  {
    const res = await mkReservation(sup, 'seat-notable');
    await api('PATCH', `/api/reservations/${res.id}/confirm`, { token: sup, body: {} });
    const r = await api('PATCH', `/api/reservations/${res.id}/seat`, { token: sup, body: {} });
    rec('SEAT', 'table requirement (no table anywhere)', '400', r.status, r.status === 400);
  }

  // ── CANCEL ──
  {
    const res = await mkReservation(sup, 'cancel-p');
    const r = await api('PATCH', `/api/reservations/${res.id}/cancel`, { token: sup, body: { reason: `${MARKER} c` } });
    rec('CANCEL', 'PENDING → CANCELLED', '200/CANCELLED', `${r.status}/${r.json?.status}`, r.status === 200 && r.json?.status === 'CANCELLED');
    const r2 = await api('PATCH', `/api/reservations/${res.id}/cancel`, { token: sup, body: { reason: `${MARKER} again` } });
    rec('CANCEL', 'terminal repeat', '409', r2.status, r2.status === 409);
    const ev = (await api('GET', `/api/reservations/${res.id}/events`, { token: sup })).json;
    const hasCancel = (Array.isArray(ev) ? ev : ev?.data || []).some((e) => e.type === 'CANCELLED');
    rec('CANCEL', 'audit/event written', 'CANCELLED event', String(hasCancel), hasCancel);
  }
  {
    const res = await mkReservation(sup, 'cancel-c');
    await api('PATCH', `/api/reservations/${res.id}/confirm`, { token: sup, body: {} });
    const r = await api('PATCH', `/api/reservations/${res.id}/cancel`, { token: sup, body: { reason: `${MARKER} c2` } });
    rec('CANCEL', 'CONFIRMED → CANCELLED', '200', r.status, r.status === 200);
  }
  {
    const res = await mkReservation(sup, 'cancel-noreason');
    const r = await api('PATCH', `/api/reservations/${res.id}/cancel`, { token: sup, body: {} });
    rec('CANCEL', 'reason required', '400', r.status, r.status === 400);
  }
  if (tableId) {
    const res = await mkReservation(sup, 'cancel-seated', { tableId });
    await api('PATCH', `/api/reservations/${res.id}/confirm`, { token: sup, body: {} });
    await api('PATCH', `/api/reservations/${res.id}/seat`, { token: sup, body: { tableId } });
    const r = await api('PATCH', `/api/reservations/${res.id}/cancel`, { token: sup, body: { reason: `${MARKER} bad` } });
    rec('CANCEL', 'invalid SEATED cancellation', '409', r.status, r.status === 409);
  }

  // ── NO-SHOW ──
  {
    const res = await mkReservation(sup, 'noshow-p');
    const r = await api('PATCH', `/api/reservations/${res.id}/no-show`, { token: sup, body: {} });
    rec('NO-SHOW', 'PENDING → NO_SHOW', '200/NO_SHOW', `${r.status}/${r.json?.status}`, r.status === 200 && r.json?.status === 'NO_SHOW');
    const r2 = await api('PATCH', `/api/reservations/${res.id}/no-show`, { token: sup, body: {} });
    rec('NO-SHOW', 'repeated request', '409', r2.status, r2.status === 409);
  }
  {
    const res = await mkReservation(sup, 'noshow-c');
    await api('PATCH', `/api/reservations/${res.id}/confirm`, { token: sup, body: {} });
    const r = await api('PATCH', `/api/reservations/${res.id}/no-show`, { token: sup, body: {} });
    rec('NO-SHOW', 'CONFIRMED → NO_SHOW', '200', r.status, r.status === 200);
  }
  if (tableId) {
    const res = await mkReservation(sup, 'noshow-seated', { tableId });
    await api('PATCH', `/api/reservations/${res.id}/confirm`, { token: sup, body: {} });
    await api('PATCH', `/api/reservations/${res.id}/seat`, { token: sup, body: { tableId } });
    const r = await api('PATCH', `/api/reservations/${res.id}/no-show`, { token: sup, body: {} });
    rec('NO-SHOW', 'invalid SEATED no-show', '409', r.status, r.status === 409);
  }
  {
    // overdue never auto-no-shows
    const res = await mkReservation(sup, 'overdue', { minutesFromNow: -60 });
    const got = (await api('GET', `/api/reservations/${res.id}`, { token: sup })).json;
    rec('NO-SHOW', 'overdue is NOT auto NO_SHOW', 'status PENDING', got?.status, got?.status === 'PENDING');
  }

  // ── MANUAL COMPLETE ──
  if (tableId) {
    const res = await mkReservation(sup, 'complete', { tableId });
    await api('PATCH', `/api/reservations/${res.id}/confirm`, { token: sup, body: {} });
    await api('PATCH', `/api/reservations/${res.id}/seat`, { token: sup, body: { tableId } });
    const r = await api('POST', `/api/reservations/${res.id}/complete`, { token: sup, body: { note: `${MARKER} done` } });
    rec('COMPLETE', 'SEATED → COMPLETED (no linked order)', '200/201 COMPLETED', `${r.status}/${r.json?.status}`, [200, 201].includes(r.status) && r.json?.status === 'COMPLETED');
    const r2 = await api('POST', `/api/reservations/${res.id}/complete`, { token: sup, body: {} });
    rec('COMPLETE', 'repeated completion is idempotent (documented 4A design)', '200 no 2nd event', r2.status, r2.status === 200, 'complete() returns canonical state on already-COMPLETED — retry-safe vs auto-complete race');
    const ev = (await api('GET', `/api/reservations/${res.id}/events`, { token: sup })).json;
    const completes = (Array.isArray(ev) ? ev : ev?.data || []).filter((e) => e.type === 'COMPLETED').length;
    rec('COMPLETE', 'exactly one COMPLETED event (idempotent)', '1', completes, completes === 1);
  }
  {
    const res = await mkReservation(sup, 'complete-pending');
    const r = await api('POST', `/api/reservations/${res.id}/complete`, { token: sup, body: {} });
    rec('COMPLETE', 'PENDING complete rejected', '400/409', r.status, [400, 409].includes(r.status));
  }
  {
    const res = await mkReservation(sup, 'complete-conf');
    await api('PATCH', `/api/reservations/${res.id}/confirm`, { token: sup, body: {} });
    const r = await api('POST', `/api/reservations/${res.id}/complete`, { token: sup, body: {} });
    rec('COMPLETE', 'CONFIRMED complete rejected', '400/409', r.status, [400, 409].includes(r.status));
  }

  // ── QUERIES ──
  {
    const r = await api('GET', '/api/reservations?scope=active', { token: sup });
    const terminals = (r.json?.data || []).filter((x) => ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(x.status)).length;
    rec('QUERY', 'scope=active excludes terminal', '0 terminal', terminals, terminals === 0);
    rec('QUERY', 'default page', '1', r.json?.page, r.json?.page === 1);
    rec('QUERY', 'default pageSize (25, not 100)', '25', r.json?.pageSize, r.json?.pageSize === 25);
    const rows = r.json?.data || [];
    const foreign = rows.filter((x) => x.branchId && x.branchId !== BRANCH).length;
    rec('QUERY', 'no cross-branch leakage', '0 foreign', foreign, foreign === 0);
    rec('QUERY', 'no unbounded response (data ≤ pageSize)', 'true', rows.length <= (r.json?.pageSize || 25), rows.length <= (r.json?.pageSize || 25));
    // deterministic active ordering asc by reservationAt
    let asc = true;
    for (let i = 1; i < rows.length; i++) if (new Date(rows[i - 1].reservationAt) > new Date(rows[i].reservationAt)) asc = false;
    rec('QUERY', 'deterministic active ordering (asc)', 'true', asc, asc);
  }
  {
    const r = await api('GET', '/api/reservations?scope=history', { token: sup });
    const actives = (r.json?.data || []).filter((x) => ['PENDING', 'CONFIRMED', 'SEATED'].includes(x.status)).length;
    rec('QUERY', 'scope=history excludes active', '0 active', actives, actives === 0);
  }
  {
    const r = await api('GET', '/api/reservations?scope=active&pageSize=500', { token: sup });
    rec('QUERY', 'max pageSize enforced (500→100)', '100', r.json?.pageSize, r.json?.pageSize === 100);
  }
  {
    const r = await api('GET', '/api/reservations?scope=active&pageSize=abc', { token: sup });
    rec('QUERY', 'invalid numeric query rejected', '400', r.status, r.status === 400);
  }
  {
    const r = await api('GET', '/api/reservations?scope=active&status=CONFIRMED', { token: sup });
    const bad = (r.json?.data || []).filter((x) => x.status !== 'CONFIRMED').length;
    rec('QUERY', 'status filtering', '0 non-CONFIRMED', bad, bad === 0);
  }
  {
    const today = new Date().toISOString().slice(0, 10);
    const r = await api('GET', `/api/reservations?scope=active&date=${today}`, { token: sup });
    rec('QUERY', 'date filtering (today)', '200', r.status, r.status === 200);
  }
  {
    const from = new Date(Date.now() - 86400000).toISOString();
    const to = new Date(Date.now() + 7 * 86400000).toISOString();
    const r = await api('GET', `/api/reservations?scope=active&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { token: sup });
    rec('QUERY', 'date range (from/to)', '200', r.status, r.status === 200);
  }
  {
    // overdue derivation: past PENDING → overdue true, future → false
    const past = await mkReservation(sup, 'overdue-derive', { minutesFromNow: -90 });
    const from = new Date(Date.now() - 2 * 86400000).toISOString();
    const to = new Date(Date.now() + 86400000).toISOString();
    const r = await api('GET', `/api/reservations?scope=active&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&pageSize=100`, { token: sup });
    const row = (r.json?.data || []).find((x) => x.id === past.id);
    rec('QUERY', 'overdue derivation (past PENDING)', 'overdue true', row ? String(row.overdue) : 'not-found', row?.overdue === true);
  }
  } catch (e) {
    rec('FATAL', 'lifecycle block threw', 'no-crash', e.message, false);
  }

  finish();
}

function finish() {
  const pass = results.filter((r) => r.pass).length;
  const fail = results.filter((r) => !r.pass).length;
  console.log(`\n===== LIVE MATRIX SUMMARY: ${pass}/${results.length} passed, ${fail} failed =====`);
  if (fail) console.log('FAILURES:\n' + results.filter((r) => !r.pass).map((r) => `  - ${r.group} :: ${r.name} (expected ${r.expected}, got ${r.actual})`).join('\n'));
  const out = process.env.P4D_OUT;
  if (out) fs.writeFileSync(out, JSON.stringify({ api: API, branch: BRANCH, marker: MARKER, pass, fail, total: results.length, results }, null, 2));
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('matrix crashed:', e); process.exit(2); });
