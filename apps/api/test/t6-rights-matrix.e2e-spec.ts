// T6 phase 2 — the rights matrix.
//  1. The seeded database matches docs/direction/rights-matrix.json (`proposed`, else `current`),
//     with the rulings recorded in packages/db/prisma/rights-rulings.ts (DEFERRED_KEYS: no row).
//  2. R14: the manager holds every right but pos:hr:compensation:read; waiter, cashier and
//     supervisor hold no accounting, finance, procurement or payroll right.
//  3. Every endpoint a screen in apps/web calls is walked as every role: the permission guard
//     refuses exactly the roles the matrix says lack its keys.
import * as fs from 'fs';
import * as path from 'path';
import { DiscoveryService, ModulesContainer, MetadataScanner } from '@nestjs/core';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { bootWorld, T2World } from './support/t2-helpers';
import { makeEmployee } from './support/t6-helpers';
import { PERMISSIONS_KEY } from '../src/common/decorators';
import { DEFERRED_KEYS, RIGHTS_RULINGS } from '../../../packages/db/prisma/rights-rulings';

jest.setTimeout(600000);

const ROOT = path.resolve(__dirname, '../../..');
const matrix = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'docs/direction/rights-matrix.json'), 'utf8'),
) as {
  roles: string[];
  keys: Record<string, { current?: string[]; proposed?: string[]; hasPermissionRow?: boolean }>;
};

const ROLES = [
  'Owner',
  'Manager',
  'Supervisor',
  'Cashier',
  'Waiter',
  'Bartender',
  'Chef',
  'Stock Manager',
  'Accountant',
];
const NOT_ROLE_RIGHTS = ['hms:read:*', 'pos:feedback:public:token:read'];

/** Who should hold each key, by the matrix and the recorded rulings. */
function expectedHolders(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [k, v] of Object.entries(matrix.keys)) {
    out.set(k, [...(v.proposed ?? v.current ?? [])].sort());
  }
  for (const k of DEFERRED_KEYS) out.set(k, []);
  for (const [k, r] of Object.entries(RIGHTS_RULINGS)) out.set(k, [...r.holders].sort());
  return out;
}

let w: T2World;
const expected = expectedHolders();

beforeAll(async () => {
  w = await bootWorld();
});
afterAll(async () => w?.app.close());

describe('The seed matches rights-matrix.json (T6 phase 2)', () => {
  let actual: Map<string, string[]>;
  let rows: Set<string>;

  beforeAll(async () => {
    const grants = await w.prisma.rolePermission.findMany({
      include: { role: { select: { name: true } }, permission: { select: { action: true } } },
    });
    actual = new Map();
    for (const g of grants) {
      const list = actual.get(g.permission.action) ?? [];
      list.push(g.role.name);
      actual.set(g.permission.action, list);
    }
    rows = new Set(
      (await w.prisma.permission.findMany({ select: { action: true } })).map((p) => p.action),
    );
  });

  it('every key in the matrix has exactly its holders among the matrix roles', () => {
    const wrong: string[] = [];
    for (const [k, want] of expected) {
      const have = (actual.get(k) ?? []).filter((r) => matrix.roles.includes(r)).sort();
      if (JSON.stringify(have) !== JSON.stringify(want)) {
        wrong.push(`${k}: seeded [${have.join(', ')}], matrix [${want.join(', ')}]`);
      }
    }
    expect(wrong).toEqual([]);
    expect(expected.size).toBeGreaterThan(300);
  });

  it('the deferred keys have no row and no holder (decision D8)', () => {
    for (const k of DEFERRED_KEYS) expect([k, rows.has(k)]).toEqual([k, false]);
  });

  it('R14 line 1: the manager holds every right except pos:hr:compensation:read', () => {
    const missing = [...rows].filter(
      (k) => !(actual.get(k) ?? []).includes('Manager') && !NOT_ROLE_RIGHTS.includes(k),
    );
    expect(missing).toEqual(['pos:hr:compensation:read']);
  });

  it('R14 line 2: waiter, cashier and supervisor hold no accounting, finance, procurement or payroll right', () => {
    const banned =
      /^(accounting:|pos:accounting:|finance:|procurement:|pos:payroll:|pos:cost:|franchise:)/;
    // And every key that guards a route in a finance module.
    const financeModules = [
      'accounting',
      'accounts-payable',
      'accounts-receivable',
      'bank-rec',
      'budget',
      'ledger',
      'payroll',
    ];
    const financeKeys = new Set<string>();
    for (const m of financeModules) {
      const dir = path.join(ROOT, 'apps/api/src/modules', m);
      for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.controller.ts'))) {
        const src = fs.readFileSync(path.join(dir, f), 'utf8');
        for (const hit of src.matchAll(/@Permissions\(([^)]*)\)/g)) {
          for (const k of hit[1].matchAll(/'([^']+)'/g)) financeKeys.add(k[1]);
        }
      }
    }
    expect(financeKeys.size).toBeGreaterThan(40);
    const hits: string[] = [];
    for (const role of ['Waiter', 'Cashier', 'Supervisor']) {
      for (const [k, holders] of actual) {
        if (holders.includes(role) && (banned.test(k) || financeKeys.has(k)))
          hits.push(`${role} ${k}`);
      }
    }
    expect(hits).toEqual([]);
  });
});

interface Route {
  method: string;
  path: string;
  keys: string[];
}

function nestRoutes(): Route[] {
  const discovery = new DiscoveryService(w.app.get(ModulesContainer));
  const scanner = new MetadataScanner();
  const out: Route[] = [];
  for (const wrapper of discovery.getControllers()) {
    const { instance, metatype } = wrapper as any;
    if (!instance || !metatype) continue;
    const base = [].concat(Reflect.getMetadata(PATH_METADATA, metatype) ?? '')[0] as string;
    const classKeys: string[] = Reflect.getMetadata(PERMISSIONS_KEY, metatype) ?? [];
    for (const name of scanner.getAllMethodNames(Object.getPrototypeOf(instance))) {
      const fn = instance[name];
      const m = Reflect.getMetadata(METHOD_METADATA, fn);
      if (m === undefined) continue;
      const sub = [].concat(Reflect.getMetadata(PATH_METADATA, fn) ?? '')[0] as string;
      const keys: string[] = Reflect.getMetadata(PERMISSIONS_KEY, fn) ?? classKeys;
      const full = ('/api/' + [base, sub].filter(Boolean).join('/'))
        .replace(/\/+/g, '/')
        .replace(/\/$/, '');
      out.push({ method: RequestMethod[m], path: full, keys });
    }
  }
  return out;
}

/** Every `/api/...` path written in the web app's source, with `${…}` as a parameter. */
function screenPaths(): string[] {
  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e.name)) {
        const src = fs.readFileSync(p, 'utf8');
        for (const m of src.matchAll(/[`'"](\/api\/[^`'"\s]*)[`'"]/g)) {
          const clean = m[1]
            .replace(/\$\{[^}]*\}/g, ':p')
            .split('?')[0]
            .replace(/\/$/, '');
          found.add(clean);
        }
      }
    }
  };
  walk(path.join(ROOT, 'apps/web/src'));
  return [...found].sort();
}

function matches(route: string, screen: string) {
  const a = route.split('/');
  const b = screen.split('/');
  if (a.length !== b.length) return false;
  return a.every(
    (seg, i) => seg === b[i] || seg.startsWith(':') || b[i].startsWith(':') || b[i].includes(':p'),
  );
}

describe('Every endpoint a screen calls, as every role (T6 phase 2)', () => {
  it('the permission guard refuses exactly the roles the matrix says lack the keys', async () => {
    const routes = nestRoutes();
    const screens = screenPaths();
    expect(routes.length).toBeGreaterThan(500);
    expect(screens.length).toBeGreaterThan(50);

    const walked: Route[] = [];
    const unmatched: string[] = [];
    for (const s of screens) {
      const hits = routes.filter((r) => matches(r.path, s));
      if (hits.length === 0) unmatched.push(s);
      for (const h of hits)
        if (!walked.some((x) => x.method === h.method && x.path === h.path)) walked.push(h);
    }
    // Requests that would end the test's own sessions are not walked.
    const skip = /^\/api\/auth\/(logout|logout-all|refresh)$/;
    const toWalk = walked.filter((r) => !skip.test(r.path) && r.keys.length > 0);
    expect(toWalk.length).toBeGreaterThan(60);

    const tokens: Record<string, string> = {};
    for (const role of ROLES)
      tokens[role] = (await makeEmployee(w, role, `Matrix${role.replace(' ', '')}`)).token;

    const holds = (role: string, keys: string[]) =>
      keys.every((k) => (expected.get(k) ?? []).includes(role));
    const wrong: string[] = [];
    let calls = 0;
    for (const r of toWalk) {
      const url = r.path.replace(/:[^/]+/g, 'x-t6-no-such-id');
      for (const role of ROLES) {
        const req = (w.http() as any)[r.method.toLowerCase()](url).set(w.as(tokens[role]));
        const res = await (['POST', 'PUT', 'PATCH'].includes(r.method)
          ? req.send({ __t6_probe: true })
          : req);
        calls++;
        const refusedByGuard =
          res.status === 403 && /Insufficient permissions/.test(JSON.stringify(res.body));
        if (holds(role, r.keys) === refusedByGuard) {
          wrong.push(`${r.method} ${r.path} as ${role}: ${res.status} (keys ${r.keys.join('+')})`);
        }
        if (res.status === 401) wrong.push(`${r.method} ${r.path} as ${role}: 401 (session lost)`);
      }
    }
    // Written out for the report: what was walked and what could not be matched.
    const out = path.join(ROOT, 'reports/proof/T6/phase2_rights_walk.txt');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(
      out,
      [
        `# T6 rights walk — ${new Date().toISOString()}`,
        `screen paths found in apps/web/src: ${screens.length}`,
        `API routes registered: ${routes.length}`,
        `routes walked (have a permission key, matched to a screen path): ${toWalk.length}`,
        `requests made (routes × ${ROLES.length} roles): ${calls}`,
        `mismatches: ${wrong.length}`,
        ...wrong.map((x) => `  ${x}`),
        `screen paths with no matching route (${unmatched.length}):`,
        ...unmatched.map((x) => `  ${x}`),
        'walked:',
        ...toWalk.map((r) => `  ${r.method} ${r.path}  [${r.keys.join(' + ')}]`),
      ].join('\n') + '\n',
    );
    expect(wrong).toEqual([]);
  });
});
