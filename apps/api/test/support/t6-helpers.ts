// T6 — helpers for the T6 e2e specs: staff with a linked employee, and a recorder that keeps
// every answer, every log line and the audit rows, so a test can search them all for a secret.
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import request from 'supertest';
import { T2World } from './t2-helpers';

let seq = 0;

/** Throwaway staff: user, role, membership, linked Employee, and a session token. */
export async function makeEmployee(w: T2World, roleName: string, firstName: string) {
  const password = `T6-${randomBytes(12).toString('base64url')}#1a`;
  const n = ++seq;
  const email = `t6.${roleName.replace(/\s+/g, '').toLowerCase()}.${w.run}.${n}@example.test`;
  const role = await w.prisma.role.findUniqueOrThrow({ where: { name: roleName } });
  const user = await w.prisma.user.create({
    data: { email, passwordHash: await bcrypt.hash(password, 4), firstName, lastName: `T6 ${n}` },
  });
  await w.prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  await w.prisma.membership.create({
    data: {
      userId: user.id,
      organizationId: w.orgId,
      branchId: w.branchId,
      roleId: role.id,
      isDefaultBranch: true,
    },
  });
  const employee = await w.prisma.employee.create({
    data: {
      orgId: w.orgId,
      branchId: w.branchId,
      userId: user.id,
      employeeCode: `T6-${w.run}-${n}`,
      firstName,
      lastName: `T6 ${n}`,
      phone: `+256 700 000 ${String(100 + n).slice(-3)}`,
      hireDate: new Date('2026-01-05'),
      employmentType: 'PERMANENT',
      dateOfBirth: new Date('1999-04-01'),
      address: { line1: 'Plot 1, Fiction Road' },
      emergencyContactName: 'Kin Fictional',
      emergencyContactPhone: '+256 700 000 999',
      notes: `private note ${w.run}`,
    },
  });
  const r = await w.http().post('/api/auth/login').send({ email, password });
  if (r.status !== 201) throw new Error(`login ${roleName} gave ${r.status}`);
  return {
    userId: user.id,
    employeeId: employee.id,
    token: r.body.accessToken as string,
    firstName,
  };
}

/** Every answer, every log line, captured while `start()` … `stop()`. */
export class Recorder {
  answers: { what: string; status: number; body: unknown }[] = [];
  logs: string[] = [];
  private undo: (() => void)[] = [];

  start() {
    for (const stream of [process.stdout, process.stderr] as const) {
      const orig = stream.write.bind(stream);
      (stream as any).write = (chunk: any, ...rest: any[]) => {
        this.logs.push(String(chunk));
        return orig(chunk, ...rest);
      };
      this.undo.push(() => ((stream as any).write = orig));
    }
    for (const k of ['log', 'warn', 'error', 'info', 'debug'] as const) {
      const orig = console[k];
      console[k] = (...args: unknown[]) => {
        this.logs.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
        return orig(...args);
      };
      this.undo.push(() => (console[k] = orig));
    }
  }

  stop() {
    this.undo.reverse().forEach((f) => f());
    this.undo = [];
  }

  async keep(what: string, req: request.Test): Promise<request.Response> {
    const res = await req;
    this.answers.push({ what, status: res.status, body: res.body });
    return res;
  }
}

export const SECRET_KEYS = [
  'passwordHash',
  'pinHash',
  'quickPinHash',
  'pinLookupHash',
  'tokenHash',
  'keyHash',
];

/** Lists where a secret was found; empty means clean. */
export function findSecrets(haystack: string, pins: string[]): string[] {
  const hits: string[] = [];
  for (const k of SECRET_KEYS) if (haystack.includes(`"${k}"`)) hits.push(`key ${k}`);
  if (/\$2[aby]\$\d\d\$/.test(haystack)) hits.push('a bcrypt hash');
  for (const p of pins) {
    // A PIN as a whole JSON value or a whole word, never as a fragment of an id.
    const re = new RegExp(`(^|[^0-9A-Za-z])${p}([^0-9A-Za-z]|$)`);
    if (re.test(haystack)) hits.push(`the PIN ${p.slice(0, 2)}…`);
  }
  return hits;
}
