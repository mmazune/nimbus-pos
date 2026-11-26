import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * BG1.1 — Frontline PIN-first onboarding + manager Quick PIN admin (e2e).
 * Runs against the seeded Neon DB. Requires `pnpm db:seed` to have completed
 * (BG1.1 perms `auth:quick-pin:read|write` must be granted to Owner).
 */
// T6: issuing or resetting a PIN starts a one-time setup; nobody is shown a PIN. The person
// (here, the test) types their own PIN with the setup token, the way a new waiter would.
let t6PinSeq = 0;
async function setOwnPin(app: INestApplication, pinSetup: { setupToken: string }, len: number) {
  t6PinSeq++;
  const seed = String(Date.now() * 7 + t6PinSeq * 7919);
  let pin = seed.slice(-len).padStart(len, '3');
  if (/^(\d)\1+$/.test(pin)) pin = pin.slice(0, -1) + ((Number(pin.slice(-1)) + 1) % 10);
  const r = await request(app.getHttpServer())
    .post('/api/auth/pin-setup')
    .send({ setupToken: pinSetup.setupToken, pin, pinConfirm: pin });
  if (r.status !== 200) throw new Error(`pin-setup gave ${r.status} ${JSON.stringify(r.body)}`);
  return pin;
}

describe('BG1.1 Frontline PIN-first + Quick PIN admin (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerAccessToken: string;
  let ownerOrgId: string;
  let ownerBranchId: string;

  const uniq = `bg11-${Date.now()}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = moduleFixture.get(PrismaService);

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'owner@demo.local', password: 'Owner#123' })
      .expect(201);
    ownerAccessToken = loginRes.body.accessToken;

    const meRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200);

    const ctx = meRes.body.context ?? meRes.body.memberships?.[0];
    ownerOrgId = ctx.defaultOrganizationId ?? ctx.organizationId ?? ctx.orgId;
    ownerBranchId = ctx.defaultBranchId ?? ctx.branchId;
    expect(ownerOrgId).toBeDefined();
    expect(ownerBranchId).toBeDefined();
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  // ── A. PIN-only frontline onboarding (no email, phone-first) ──

  describe('PIN-only frontline onboarding', () => {
    const phone = `+256700000${Math.floor(100 + Math.random() * 899)}`;
    let employeeId: string;
    let userId: string;
    let initialPin: string;
    let pinLength: number;

    it('POST /api/hr/frontline-staff/onboard — PIN-first cashier (no email)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/hr/frontline-staff/onboard')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .set('x-branch-id', ownerBranchId)
        .send({
          firstName: 'Pin',
          lastName: `Cashier-${uniq}`,
          phone,
          roleName: 'Cashier',
          employee: {
            hireDate: new Date().toISOString().slice(0, 10),
            employmentType: 'PERMANENT',
          },
        })
        .expect(201);

      expect(res.body.ok).toBe(true);
      expect(res.body.authMode).toBe('PIN_ONLY');
      expect(res.body.mustChangePassword).toBe(false);
      expect(res.body.user.email).toBeNull();
      expect(res.body.user.hasSyntheticEmail).toBe(true);
      expect(res.body.user.phone).toBe(phone);
      expect(res.body.passwordLogin.enabled).toBe(false);
      // T6: no PIN in the answer; a one-time setup token instead.
      expect(res.body.quickPin.pin).toBeUndefined();
      expect(res.body.quickPin.setupPending).toBe(true);
      expect(res.body.quickPin.pinSetup.setupToken).toMatch(/^pst_/);
      expect(Array.isArray(res.body.onboardingInstructions)).toBe(true);

      employeeId = res.body.employee.id;
      userId = res.body.user.id;
      pinLength = res.body.quickPin.pinLength;
      initialPin = await setOwnPin(app, res.body.quickPin.pinSetup, pinLength);
    }, 30000);

    it('PIN-only user can log in via /api/auth/quick-pin-login', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/quick-pin-login')
        .send({
          branchId: ownerBranchId,
          pin: initialPin,
          platform: 'POS_DESKTOP',
        })
        .expect(201);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.id).toBe(userId);
    }, 30000);

    // ── B. Quick PIN status ──

    it('GET /api/hr/frontline-staff/:id/quick-pin-status returns rich status (no PIN value)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/hr/frontline-staff/${employeeId}/quick-pin-status`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .set('x-branch-id', ownerBranchId)
        .expect(200);

      expect(res.body.employeeId).toBe(employeeId);
      expect(res.body.userId).toBe(userId);
      expect(res.body.pinEnabled).toBe(true);
      expect(res.body.pinExists).toBe(true);
      expect(res.body.pinLength).toBe(pinLength);
      expect(res.body.pinTier).toBeDefined();
      expect(res.body.hasPasswordLogin).toBe(false);
      expect(res.body.authMode).toBe('PIN_ONLY');
      // Critical: status MUST NOT leak the stored PIN
      expect(res.body.pin).toBeUndefined();
      expect(res.body.quickPinHash).toBeUndefined();
      expect(res.body.pinLookupHash).toBeUndefined();
    });

    // ── C. Quick PIN reset ──

    let rotatedPin: string;
    let resetSetup: { setupToken: string };
    it('POST /api/hr/frontline-staff/:id/quick-pin/reset starts a setup; no PIN is returned', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/hr/frontline-staff/${employeeId}/quick-pin/reset`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .set('x-branch-id', ownerBranchId)
        .send({})
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.quickPin.pin).toBeUndefined();
      expect(res.body.quickPin.setupPending).toBe(true);
      resetSetup = res.body.quickPin.pinSetup;
    }, 30000);

    it('Old PIN is invalidated after reset (login fails)', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/quick-pin-login')
        .send({
          branchId: ownerBranchId,
          pin: initialPin,
          platform: 'POS_DESKTOP',
        })
        .expect(401);
    });

    it('Rotated PIN logs in successfully', async () => {
      rotatedPin = await setOwnPin(app, resetSetup, pinLength);
      await request(app.getHttpServer())
        .post('/api/auth/quick-pin-login')
        .send({
          branchId: ownerBranchId,
          pin: rotatedPin,
          platform: 'POS_DESKTOP',
        })
        .expect(201);
    }, 30000);

    it('Reset is duplicate-safe (a second call rotates again, both succeed)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/hr/frontline-staff/${employeeId}/quick-pin/reset`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .set('x-branch-id', ownerBranchId)
        .send({})
        .expect(200);
      expect(res.body.quickPin.pin).toBeUndefined();
      rotatedPin = await setOwnPin(app, res.body.quickPin.pinSetup, pinLength);
    }, 30000);

    // ── D. Quick PIN disable / enable ──

    it('PATCH /quick-pin/disable blocks PIN login', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/hr/frontline-staff/${employeeId}/quick-pin/disable`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .set('x-branch-id', ownerBranchId)
        .expect(200);
      expect(res.body.pinEnabled).toBe(false);
      expect(res.body.alreadyDisabled).toBe(false);

      await request(app.getHttpServer())
        .post('/api/auth/quick-pin-login')
        .send({
          branchId: ownerBranchId,
          pin: rotatedPin,
          platform: 'POS_DESKTOP',
        })
        .expect(401);
    }, 30000);

    it('PATCH /quick-pin/disable is idempotent', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/hr/frontline-staff/${employeeId}/quick-pin/disable`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .set('x-branch-id', ownerBranchId)
        .expect(200);
      expect(res.body.pinEnabled).toBe(false);
      expect(res.body.alreadyDisabled).toBe(true);
    });

    it('PATCH /quick-pin/enable restores PIN login (PIN already exists)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/hr/frontline-staff/${employeeId}/quick-pin/enable`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .set('x-branch-id', ownerBranchId)
        .expect(200);
      expect(res.body.pinEnabled).toBe(true);

      await request(app.getHttpServer())
        .post('/api/auth/quick-pin-login')
        .send({
          branchId: ownerBranchId,
          pin: rotatedPin,
          platform: 'POS_DESKTOP',
        })
        .expect(201);
    }, 30000);
  });

  // ── E. PIN_PLUS_PASSWORD (explicit opt-in) ──

  describe('Frontline onboarding with both PIN and password login', () => {
    const phone = `+256700000${Math.floor(100 + Math.random() * 899)}`;
    const email = `bg11-pinpwd-${uniq}@demo.local`;
    const password = `BG11-Pwd#${uniq}`;

    it('PIN_PLUS_PASSWORD when enablePasswordLogin=true and pin requested', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/hr/frontline-staff/onboard')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .set('x-branch-id', ownerBranchId)
        .send({
          firstName: 'Both',
          lastName: 'Modes',
          phone,
          email,
          roleName: 'Cashier',
          enablePasswordLogin: true,
          employee: {
            hireDate: new Date().toISOString().slice(0, 10),
            employmentType: 'PERMANENT',
          },
        })
        .expect(201);
      expect(res.body.authMode).toBe('PIN_PLUS_PASSWORD');
      // T6: the manager sets no password; the person sets it with the setup token.
      expect(res.body.mustChangePassword).toBe(false);
      expect(res.body.passwordLogin.enabled).toBe(true);
      expect(res.body.passwordLogin.passwordSetup.setupToken).toMatch(/^prt_/);
      expect(res.body.quickPin.setupPending).toBe(true);
      await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({
          resetToken: res.body.passwordLogin.passwordSetup.setupToken,
          newPassword: password,
        })
        .expect((r) => expect(r.status).toBeLessThan(300));
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password })
        .expect(201);
    }, 30000);
  });

  // ── F. Validation failures + permission/role guards ──

  describe('Validation + guards', () => {
    it('Missing phone returns 400', async () => {
      await request(app.getHttpServer())
        .post('/api/hr/frontline-staff/onboard')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .set('x-branch-id', ownerBranchId)
        .send({
          firstName: 'No',
          lastName: 'Phone',
          roleName: 'Cashier',
          employee: {
            hireDate: new Date().toISOString().slice(0, 10),
            employmentType: 'PERMANENT',
          },
        })
        .expect(400);
    });

    it("enablePasswordLogin=true WITH a manager-typed temporaryPassword returns 400 (T6: nobody sets another person's password)", async () => {
      await request(app.getHttpServer())
        .post('/api/hr/frontline-staff/onboard')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .set('x-branch-id', ownerBranchId)
        .send({
          firstName: 'Need',
          lastName: 'Pwd',
          phone: '+256700000123',
          email: `needpwd-${uniq}@demo.local`,
          roleName: 'Cashier',
          enablePasswordLogin: true,
          temporaryPassword: 'Manager#Knows2026',
          employee: {
            hireDate: new Date().toISOString().slice(0, 10),
            employmentType: 'PERMANENT',
          },
        })
        .expect(400);
    });

    it('Quick PIN admin endpoints return 404 for unknown employee id', async () => {
      await request(app.getHttpServer())
        .get('/api/hr/frontline-staff/clx-not-real/quick-pin-status')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .set('x-branch-id', ownerBranchId)
        .expect(404);
    });
  });

  // ── B3-F1 (permissions cutover, 2026-08-20): branch guard on Quick PIN admin ──
  //
  // Before the fix these four routes resolved the target employee by `{ id, orgId }`
  // only. BranchContextGuard proved the CALLER belongs to the X-Branch-Id they sent,
  // but nothing tied the TARGET to it, so an administrator of branch A could read and
  // rotate the Quick PIN of a frontline employee in branch B. Verified live before the
  // fix: 200 on status, disable and enable from a second branch.
  //
  // These tests are written against a purpose-created employee in a SECOND branch, so
  // they hold regardless of what the demo dataset contains.

  describe('B3-F1 Quick PIN admin branch guard', () => {
    let otherBranchId: string;
    let sameBranchEmployeeId: string;
    let otherBranchEmployeeId: string;

    // The fixture is CREATED, not discovered. An earlier version of this block looked
    // for pre-existing employees and silently self-skipped when the seeded dataset
    // happened not to have one in a second branch — a hollow pass that proved nothing.
    // Both targets are now onboarded through the public API, so the guard is always
    // exercised on any seeded database.
    beforeAll(async () => {
      // A second ACTIVE branch the OWNER actually holds a membership in — the
      // branch guard would otherwise reject the onboarding call with 403.
      const membership = await prisma.membership.findFirst({
        where: {
          user: { email: 'owner@demo.local' },
          status: 'ACTIVE',
          branchId: { not: ownerBranchId },
          branch: { organizationId: ownerOrgId, status: 'ACTIVE' },
        },
        select: { branchId: true },
      });
      otherBranchId = membership?.branchId ?? '';

      const onboard = async (branch: string, tag: string) => {
        const res = await request(app.getHttpServer())
          .post('/api/hr/frontline-staff/onboard')
          .set('Authorization', `Bearer ${ownerAccessToken}`)
          .set('x-branch-id', branch)
          .send({
            firstName: 'Guard',
            lastName: `${tag}-${uniq}`,
            phone: `+25078811${Math.floor(1000 + Math.random() * 8999)}`,
            roleName: 'Cashier',
            employee: {
              hireDate: new Date().toISOString().slice(0, 10),
              employmentType: 'PERMANENT',
            },
          });
        expect(res.status).toBe(201);
        return res.body.employee.id as string;
      };

      sameBranchEmployeeId = await onboard(ownerBranchId, 'SameBranch');
      expect(otherBranchId).toBeTruthy();
      otherBranchEmployeeId = await onboard(otherBranchId, 'OtherBranch');

      // Sanity: the two targets really do live in different branches.
      const rows = await prisma.employee.findMany({
        where: { id: { in: [sameBranchEmployeeId, otherBranchEmployeeId] } },
        select: { id: true, branchId: true },
      });
      const byId = Object.fromEntries(rows.map((r) => [r.id, r.branchId]));
      expect(byId[sameBranchEmployeeId]).toBe(ownerBranchId);
      expect(byId[otherBranchEmployeeId]).toBe(otherBranchId);
    }, 90000);

    it('same-branch employee is still reachable (the guard did not over-tighten)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/hr/frontline-staff/${sameBranchEmployeeId}/quick-pin-status`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .set('x-branch-id', ownerBranchId)
        .expect(200);

      expect(res.body.employeeId).toBe(sameBranchEmployeeId);
      expect(res.body.branchId).toBe(ownerBranchId);
    });

    it('cross-branch employee is 404 on quick-pin-status', async () => {
      await request(app.getHttpServer())
        .get(`/api/hr/frontline-staff/${otherBranchEmployeeId}/quick-pin-status`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .set('x-branch-id', ownerBranchId)
        .expect(404);
    });

    it('cross-branch employee is 404 on quick-pin/reset, /disable and /enable', async () => {
      await request(app.getHttpServer())
        .post(`/api/hr/frontline-staff/${otherBranchEmployeeId}/quick-pin/reset`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .set('x-branch-id', ownerBranchId)
        .send({})
        .expect(404);

      await request(app.getHttpServer())
        .patch(`/api/hr/frontline-staff/${otherBranchEmployeeId}/quick-pin/disable`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .set('x-branch-id', ownerBranchId)
        .expect(404);

      await request(app.getHttpServer())
        .patch(`/api/hr/frontline-staff/${otherBranchEmployeeId}/quick-pin/enable`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .set('x-branch-id', ownerBranchId)
        .expect(404);
    });

    it('the SAME employee is reachable when the caller switches to that branch', async () => {
      // Proves the 404 above is a branch-scope decision, not a broken lookup: the
      // identical id resolves fine once X-Branch-Id names the employee's own branch.
      const res = await request(app.getHttpServer())
        .get(`/api/hr/frontline-staff/${otherBranchEmployeeId}/quick-pin-status`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .set('x-branch-id', otherBranchId)
        .expect(200);

      expect(res.body.employeeId).toBe(otherBranchEmployeeId);
      expect(res.body.branchId).toBe(otherBranchId);
    });

    it('reset refuses a body.branchId that is not the active branch context', async () => {
      // The value feeds the Quick PIN lookup hash — honouring a foreign branch
      // would mint a PIN scoped to a branch the caller is not acting in.
      const res = await request(app.getHttpServer())
        .post(`/api/hr/frontline-staff/${sameBranchEmployeeId}/quick-pin/reset`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .set('x-branch-id', ownerBranchId)
        .send({ branchId: otherBranchId })
        .expect(400);

      expect(res.body.message).toContain('branchId must match the active X-Branch-Id');
    });
  });
});
