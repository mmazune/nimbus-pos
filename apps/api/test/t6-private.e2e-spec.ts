// T6 phase 1 — private things stay private.
// Real cases: "The payslip stays private" and "A new waiter sets her own PIN".
// Fictional cast only; phones from +256 700 000 xxx; PINs typed here exist only in this run.
import { Prisma } from '@prisma/client';
import { bootWorld, T2World, DEMO } from './support/t2-helpers';
import { makeEmployee, Recorder, findSecrets } from './support/t6-helpers';

jest.setTimeout(120000);

let w: T2World;
let manager: string;

beforeAll(async () => {
  w = await bootWorld();
  manager = w.tokens.manager;
});
afterAll(async () => w?.app.close());

describe('The payslip stays private (T6 phase 1a)', () => {
  let waiter: Awaited<ReturnType<typeof makeEmployee>>;
  let cashier: Awaited<ReturnType<typeof makeEmployee>>;
  let supervisor: Awaited<ReturnType<typeof makeEmployee>>;
  let colleague: Awaited<ReturnType<typeof makeEmployee>>;
  const slipOf: Record<string, string> = {};

  beforeAll(async () => {
    waiter = await makeEmployee(w, 'Waiter', 'Amara');
    cashier = await makeEmployee(w, 'Cashier', 'Brian');
    supervisor = await makeEmployee(w, 'Supervisor', 'Cissy');
    colleague = await makeEmployee(w, 'Chef', 'Dembe');
    const ownerUser = await w.prisma.user.findUniqueOrThrow({ where: { email: DEMO.owner[0] } });
    const run = await w.prisma.payRun.create({
      data: {
        orgId: w.orgId,
        branchId: w.branchId,
        name: `November ${w.run}`,
        periodStart: new Date('2026-11-01'),
        periodEnd: new Date('2026-11-30'),
        status: 'PAID',
        builtById: ownerUser.id,
        employeeCount: 4,
      },
    });
    for (const [who, e, gross] of [
      ['waiter', waiter, '650000.00'],
      ['cashier', cashier, '700000.00'],
      ['supervisor', supervisor, '900000.00'],
      ['colleague', colleague, '1100000.00'],
    ] as const) {
      const slip = await w.prisma.paySlip.create({
        data: {
          orgId: w.orgId,
          branchId: w.branchId,
          payRunId: run.id,
          employeeId: e.employeeId,
          status: 'PAID',
          grossPay: new Prisma.Decimal(gross),
          totalDeductions: new Prisma.Decimal('0.00'),
          netPay: new Prisma.Decimal(gross),
          componentSnapshot: [],
        },
      });
      slipOf[who] = slip.id;
    }
  });

  it.each(['waiter', 'cashier', 'supervisor'] as const)(
    "a %s gets 403 on the branch payslip list and on another person's slip",
    async (who) => {
      const t = { waiter, cashier, supervisor }[who].token;
      for (const path of ['/api/payroll/slips', '/api/payroll/payslips']) {
        expect((await w.http().get(path).set(w.as(t))).status).toBe(403);
      }
      expect(
        (await w.http().get(`/api/payroll/slips/${slipOf.colleague}`).set(w.as(t))).status,
      ).toBe(403);
    },
  );

  it.each(['waiter', 'cashier', 'supervisor'] as const)(
    'a %s gets 200 on their own slips, and only their own',
    async (who) => {
      const me = { waiter, cashier, supervisor }[who];
      const r = await w.http().get('/api/payroll/my-slips').set(w.as(me.token));
      expect(r.status).toBe(200);
      expect(r.body.total).toBe(1);
      expect(r.body.data.map((s: any) => s.id)).toEqual([slipOf[who]]);
      expect(r.body.data[0].employee.id).toBe(me.employeeId);
      const one = await w.http().get(`/api/payroll/my-slips/${slipOf[who]}`).set(w.as(me.token));
      expect(one.status).toBe(200);
      expect(one.body.netPay).toBeDefined();
      // Someone else's slip id answers the same as a missing one.
      const other = await w
        .http()
        .get(`/api/payroll/my-slips/${slipOf.colleague}`)
        .set(w.as(me.token));
      expect(other.status).toBe(404);
    },
  );

  it('the manager still lists the branch, and no slip carries private employee fields', async () => {
    const r = await w.http().get('/api/payroll/slips?take=100').set(w.as(manager));
    expect(r.status).toBe(200);
    const ids = r.body.data.map((s: any) => s.id);
    for (const id of Object.values(slipOf)) expect(ids).toContain(id);
    for (const slip of r.body.data) {
      for (const k of [
        'dateOfBirth',
        'address',
        'emergencyContactName',
        'emergencyContactPhone',
        'notes',
        'compensationProfileId',
        'metadata',
      ]) {
        expect([k, k in slip.employee]).toEqual([k, false]);
      }
    }
    expect(JSON.stringify(r.body)).not.toContain(`private note ${w.run}`);
  });

  it('a supervisor holds no payroll right (runs, components, adjustments: 403)', async () => {
    for (const path of [
      '/api/payroll/runs',
      '/api/payroll/components',
      '/api/payroll/adjustments',
    ]) {
      expect([path, (await w.http().get(path).set(w.as(supervisor.token))).status]).toEqual([
        path,
        403,
      ]);
    }
    const adj = await w
      .http()
      .post('/api/payroll/adjustments')
      .set(w.as(supervisor.token))
      .send({ employeeId: colleague.employeeId, amount: '1000' });
    expect(adj.status).toBe(403);
  });

  it('leave, attendance and swap lists: a waiter reads only her own, with no hashes or private fields', async () => {
    // A colleague's leave request, written directly (the subject here is who can read it).
    await w.prisma.leaveRequest.create({
      data: {
        orgId: w.orgId,
        branchId: w.branchId,
        employeeId: colleague.employeeId,
        requestedById: colleague.userId,
        leaveType: 'ANNUAL',
        startsAt: new Date('2026-12-01'),
        endsAt: new Date('2026-12-03'),
        status: 'PENDING',
      } as any,
    });
    const mine = await w.http().post('/api/hr/leave').set(w.as(waiter.token)).send({
      employeeId: waiter.employeeId,
      leaveType: 'ANNUAL',
      startsAt: '2026-12-10T08:00:00.000Z',
      endsAt: '2026-12-11T17:00:00.000Z',
      reason: 'family',
    });
    expect(mine.status).toBe(201);

    const asWaiter = await w.http().get('/api/hr/leave?take=100').set(w.as(waiter.token));
    expect(asWaiter.status).toBe(200);
    expect(asWaiter.body.data.length).toBeGreaterThan(0);
    for (const row of asWaiter.body.data) expect(row.employeeId).toBe(waiter.employeeId);

    const asManager = await w.http().get('/api/hr/leave?take=100').set(w.as(manager));
    expect(asManager.body.data.some((r: any) => r.employeeId === colleague.employeeId)).toBe(true);

    for (const path of [
      '/api/hr/leave?take=100',
      '/api/hr/attendance?take=100',
      '/api/hr/shift-swaps?take=100',
    ]) {
      const r = await w.http().get(path).set(w.as(manager));
      expect([path, r.status]).toEqual([path, 200]);
      const text = JSON.stringify(r.body);
      expect(findSecrets(text, [])).toEqual([]);
      for (const k of ['dateOfBirth', 'emergencyContactPhone', `private note ${w.run}`]) {
        expect([path, text.includes(k)]).toEqual([path, false]);
      }
    }
  });

  it('a supervisor reading contracts sees no salary amount; the owner does', async () => {
    const ownerUser = await w.prisma.user.findUniqueOrThrow({ where: { email: DEMO.owner[0] } });
    await w.prisma.employmentContract.create({
      data: {
        orgId: w.orgId,
        branchId: w.branchId,
        employeeId: colleague.employeeId,
        contractNumber: `T6-C-${w.run}`,
        contractStatus: 'ACTIVE',
        startsAt: new Date('2026-01-05'),
        salaryBasis: 'MONTHLY',
        salaryAmount: new Prisma.Decimal('1100000.00'),
        createdById: ownerUser.id,
      },
    });
    const sup = await w
      .http()
      .get(`/api/hr/contracts?employeeId=${colleague.employeeId}`)
      .set(w.as(supervisor.token));
    expect(sup.status).toBe(200);
    expect(sup.body.data[0].salaryAmount).toBeNull();
    const own = await w
      .http()
      .get(`/api/hr/contracts?employeeId=${colleague.employeeId}`)
      .set(w.as(w.tokens.owner));
    expect(own.body.data[0].salaryAmount).toBe('1100000');
  });
});

describe('A new waiter sets her own PIN (T6 phase 1b)', () => {
  const rec = new Recorder();
  const typed: string[] = [];
  const userIds: string[] = [];

  afterAll(() => rec.stop());

  it('onboarding, setting the PIN, signing in, a reset and a second PIN: nobody else sees anything', async () => {
    rec.start();
    const phone = `+256 700 000 ${String(Date.now()).slice(-3)}`;
    const onboard = await rec.keep(
      'onboard',
      w
        .http()
        .post('/api/hr/frontline-staff/onboard')
        .set(w.as(manager))
        .send({
          firstName: 'Esther',
          lastName: `T6 ${w.run}`,
          phone,
          roleName: 'Waiter',
          employee: { hireDate: '2026-11-26', employmentType: 'PERMANENT' },
        }),
    );
    expect(onboard.status).toBe(201);
    const userId = onboard.body.user.id;
    userIds.push(userId);
    expect(onboard.body.quickPin.pin).toBeUndefined();
    expect(onboard.body.quickPin.setupPending).toBe(true);
    const token1: string = onboard.body.quickPin.pinSetup.setupToken;
    expect(token1).toMatch(/^pst_/);

    // Before she sets it there is no PIN at all.
    const u0 = await w.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(u0.quickPinHash).toBeNull();
    expect(u0.pinLength).toBe(6);

    const check = await rec.keep(
      'check',
      w.http().post('/api/auth/pin-setup/check').send({ setupToken: token1 }),
    );
    expect(check.status).toBe(200);
    expect(check.body).toMatchObject({ firstName: 'Esther', pinLength: 6, purpose: 'ONBOARDING' });

    // Wrong ways in are refused.
    const pin1 = '482913';
    typed.push(pin1);
    expect(
      (
        await rec.keep(
          'mismatch',
          w
            .http()
            .post('/api/auth/pin-setup')
            .send({ setupToken: token1, pin: pin1, pinConfirm: '482914' }),
        )
      ).body.code,
    ).toBe('PIN_MISMATCH');
    expect(
      (
        await rec.keep(
          'short',
          w
            .http()
            .post('/api/auth/pin-setup')
            .send({ setupToken: token1, pin: '4829', pinConfirm: '4829' }),
        )
      ).body.code,
    ).toBe('PIN_FORMAT');
    typed.push('4829');

    // Two taps at once: exactly one sets the PIN.
    const both = await Promise.all(
      [1, 2].map(() =>
        rec.keep(
          'set (race)',
          w
            .http()
            .post('/api/auth/pin-setup')
            .send({ setupToken: token1, pin: pin1, pinConfirm: pin1 }),
        ),
      ),
    );
    expect(both.map((r) => r.status).sort()).toEqual([200, 409]);

    const login1 = await rec.keep(
      'login',
      w
        .http()
        .post('/api/auth/quick-pin-login')
        .send({ branchId: w.branchId, pin: pin1, platform: 'POS_DESKTOP' }),
    );
    expect(login1.status).toBe(201);
    expect(login1.body.user?.id ?? login1.body.userId).toBe(userId);

    // The token is spent.
    expect(
      (
        await rec.keep(
          'reuse',
          w
            .http()
            .post('/api/auth/pin-setup')
            .send({ setupToken: token1, pin: '739154', pinConfirm: '739154' }),
        )
      ).status,
    ).toBe(409);
    typed.push('739154');

    // Reset: the old PIN stops at once, and the manager is shown no PIN.
    const employeeId = onboard.body.employee.id;
    const reset = await rec.keep(
      'reset',
      w
        .http()
        .post(`/api/hr/frontline-staff/${employeeId}/quick-pin/reset`)
        .set(w.as(manager))
        .send({}),
    );
    expect(reset.status).toBe(200);
    expect(reset.body.quickPin.pin).toBeUndefined();
    const token2: string = reset.body.quickPin.pinSetup.setupToken;
    expect(
      (
        await rec.keep(
          'old pin after reset',
          w
            .http()
            .post('/api/auth/quick-pin-login')
            .send({ branchId: w.branchId, pin: pin1, platform: 'POS_DESKTOP' }),
        )
      ).status,
    ).toBe(401);
    // The first link stays dead.
    expect(
      (
        await rec.keep(
          'first link after reset',
          w.http().post('/api/auth/pin-setup/check').send({ setupToken: token1 }),
        )
      ).status,
    ).toBe(409);

    const pin2 = '615027';
    typed.push(pin2);
    expect(
      (
        await rec.keep(
          'set 2',
          w
            .http()
            .post('/api/auth/pin-setup')
            .send({ setupToken: token2, pin: pin2, pinConfirm: pin2 }),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await rec.keep(
          'login 2',
          w
            .http()
            .post('/api/auth/quick-pin-login')
            .send({ branchId: w.branchId, pin: pin2, platform: 'POS_DESKTOP' }),
        )
      ).status,
    ).toBe(201);

    // The identity route (users/:id/reset-quick-pin) answers the same way: a token, no PIN.
    const idReset = await rec.keep(
      'identity reset',
      w
        .http()
        .post(`/api/auth/users/${userId}/reset-quick-pin`)
        .set(w.as(w.tokens.owner))
        .send({ branchId: w.branchId }),
    );
    expect(idReset.status).toBe(201);
    expect(idReset.body.pin).toBeUndefined();
    expect(idReset.body.pinSetup.setupToken).toMatch(/^pst_/);
  });

  it('password login: the manager cannot set it; the person sets it with a one-time token', async () => {
    const email = `t6.esther.${w.run}@example.test`;
    const withPassword = await rec.keep(
      'onboard with a manager-typed password',
      w
        .http()
        .post('/api/hr/frontline-staff/onboard')
        .set(w.as(manager))
        .send({
          email,
          firstName: 'Faith',
          lastName: `T6 ${w.run}`,
          phone: '+256 700 000 451',
          roleName: 'Supervisor',
          enablePasswordLogin: true,
          temporaryPassword: 'Manager-Knows-1',
          employee: { hireDate: '2026-11-26', employmentType: 'PERMANENT' },
        }),
    );
    expect(withPassword.status).toBe(400);
    expect(withPassword.body.code ?? withPassword.body.message?.code).toBeDefined();

    const ok = await rec.keep(
      'onboard with password login',
      w
        .http()
        .post('/api/hr/frontline-staff/onboard')
        .set(w.as(manager))
        .send({
          email,
          firstName: 'Faith',
          lastName: `T6 ${w.run}`,
          phone: '+256 700 000 451',
          roleName: 'Supervisor',
          enablePasswordLogin: true,
          employee: { hireDate: '2026-11-26', employmentType: 'PERMANENT' },
        }),
    );
    expect(ok.status).toBe(201);
    userIds.push(ok.body.user.id);
    const prt: string = ok.body.passwordLogin.passwordSetup.setupToken;
    expect(prt).toMatch(/^prt_/);
    const own = 'Faith-Owns-This-7';
    typed.push(own);
    expect(
      (
        await rec.keep(
          'set password',
          w.http().post('/api/auth/reset-password').send({ resetToken: prt, newPassword: own }),
        )
      ).status,
    ).toBeLessThan(300);
    expect(
      (await rec.keep('login', w.http().post('/api/auth/login').send({ email, password: own })))
        .status,
    ).toBe(201);
  });

  it('an invitation hands the inviter no password', async () => {
    const email = `t6.grace.${w.run}@example.test`;
    const inv = await rec.keep(
      'invite',
      w
        .http()
        .post('/api/onboarding/invitations')
        .set(w.as(manager))
        .send({
          invitations: [{ email, roleName: 'Accountant', firstName: 'Grace', lastName: 'T6' }],
        }),
    );
    expect(inv.status).toBeLessThan(300);
    const row = inv.body.invitations[0];
    expect(row.tempPassword).toBeNull();
    userIds.push(row.userId);
    const own = 'Grace-Owns-This-9';
    typed.push(own);
    expect(
      (
        await rec.keep(
          'accept',
          w
            .http()
            .post('/api/auth/invitations/accept')
            .send({ invitationToken: row.invitationToken, newPassword: own }),
        )
      ).status,
    ).toBeLessThan(300);
    expect(
      (await rec.keep('login', w.http().post('/api/auth/login').send({ email, password: own })))
        .status,
    ).toBe(201);
  });

  it('no answer, log line or audit row of these flows carries a PIN, a password or a hash', async () => {
    rec.stop();
    expect(rec.answers.length).toBeGreaterThanOrEqual(20);
    // Every answer. (Setup tokens are single-use and appear only in the answer to the manager's
    // device that started them; they are not searched for, PINs and passwords are.)
    const answers = JSON.stringify(rec.answers.map((a) => a.body));
    expect(findSecrets(answers, typed)).toEqual([]);
    for (const pw of typed) expect(answers.includes(pw)).toBe(false);
    // Every log line written while the flows ran.
    const logs = rec.logs.join('\n');
    expect(findSecrets(logs, typed)).toEqual([]);
    // Every audit row about these people or written by them.
    const audit = await w.prisma.auditLog.findMany({
      where: { OR: [{ entityId: { in: userIds } }, { actorUserId: { in: userIds } }] },
    });
    expect(audit.length).toBeGreaterThan(5);
    const auditText = JSON.stringify(audit);
    expect(findSecrets(auditText, typed)).toEqual([]);
    for (const a of rec.answers) {
      const t = JSON.stringify(a.body);
      expect([
        a.what,
        t.includes('pst_') && !['onboard', 'reset', 'identity reset'].includes(a.what),
      ]).toEqual([a.what, false]);
    }
  });
});
