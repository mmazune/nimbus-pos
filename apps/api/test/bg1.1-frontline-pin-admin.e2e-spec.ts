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
        const phone = `+25078800${Math.floor(1000 + Math.random() * 8999)}`;
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
            expect(res.body.quickPin.issued).toBe(true);
            expect(res.body.quickPin.shownOnce).toBe(true);
            expect(res.body.quickPin.pin).toMatch(/^\d{6,8}$/);
            expect(Array.isArray(res.body.onboardingInstructions)).toBe(true);

            employeeId = res.body.employee.id;
            userId = res.body.user.id;
            initialPin = res.body.quickPin.pin;
            pinLength = res.body.quickPin.pinLength;
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
        it('POST /api/hr/frontline-staff/:id/quick-pin/reset returns new PIN once', async () => {
            const res = await request(app.getHttpServer())
                .post(`/api/hr/frontline-staff/${employeeId}/quick-pin/reset`)
                .set('Authorization', `Bearer ${ownerAccessToken}`)
                .set('x-branch-id', ownerBranchId)
                .send({})
                .expect(200);

            expect(res.body.ok).toBe(true);
            expect(res.body.quickPin.issued).toBe(true);
            expect(res.body.quickPin.shownOnce).toBe(true);
            expect(res.body.quickPin.pin).toMatch(/^\d{6,8}$/);
            expect(res.body.quickPin.pin).not.toBe(initialPin);
            rotatedPin = res.body.quickPin.pin;
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
            expect(res.body.quickPin.pin).not.toBe(rotatedPin);
            rotatedPin = res.body.quickPin.pin;
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
        const phone = `+25078800${Math.floor(1000 + Math.random() * 8999)}`;
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
                    temporaryPassword: password,
                    employee: {
                        hireDate: new Date().toISOString().slice(0, 10),
                        employmentType: 'PERMANENT',
                    },
                })
                .expect(201);
            expect(res.body.authMode).toBe('PIN_PLUS_PASSWORD');
            expect(res.body.mustChangePassword).toBe(true);
            expect(res.body.passwordLogin.enabled).toBe(true);
            expect(res.body.quickPin.issued).toBe(true);
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

        it('enablePasswordLogin=true without temporaryPassword returns 400', async () => {
            await request(app.getHttpServer())
                .post('/api/hr/frontline-staff/onboard')
                .set('Authorization', `Bearer ${ownerAccessToken}`)
                .set('x-branch-id', ownerBranchId)
                .send({
                    firstName: 'Need',
                    lastName: 'Pwd',
                    phone: '+250788000123',
                    email: `needpwd-${uniq}@demo.local`,
                    roleName: 'Cashier',
                    enablePasswordLogin: true,
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
});
