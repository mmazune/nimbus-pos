import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * BG1 — Invitation Acceptance + Password Lifecycle + Frontline Staff Onboarding e2e.
 * Runs against the seeded Neon DB. Requires `pnpm db:seed` to have completed.
 */
describe('BG1 Invitation + Password + Frontline Onboarding (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let ownerAccessToken: string;
    let ownerOrgId: string;
    let ownerBranchId: string;

    const uniq = `bg1-${Date.now()}`;

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

        const ownerMembership = meRes.body.memberships?.[0] ?? meRes.body.context;
        ownerOrgId = ownerMembership.organizationId ?? ownerMembership.orgId;
        ownerBranchId = ownerMembership.branchId;
        expect(ownerOrgId).toBeDefined();
        expect(ownerBranchId).toBeDefined();
    }, 60000);

    afterAll(async () => {
        await app.close();
    });

    // ── Invitation lifecycle ──

    describe('Invitation lifecycle', () => {
        let invitationId: string;
        let invitationToken: string;
        const inviteEmail = `manager-${uniq}@demo.local`;

        it('POST /api/onboarding/invitations — creates a tracked invitation row', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/onboarding/invitations')
                .set('Authorization', `Bearer ${ownerAccessToken}`)
                .send({
                    invitations: [
                        {
                            email: inviteEmail,
                            roleName: 'Manager',
                            firstName: 'BG1',
                            lastName: 'Manager',
                        },
                    ],
                })
                .expect(201);

            const inv = res.body.invitations[0];
            expect(inv.invitationId).toBeDefined();
            expect(inv.invitationToken).toMatch(/^inv_/);
            invitationId = inv.invitationId;
            invitationToken = inv.invitationToken;

            const dbRow = await prisma.invitation.findUnique({ where: { id: invitationId } });
            expect(dbRow?.status).toBe('PENDING');
            expect(dbRow?.organizationId).toBe(ownerOrgId);
        }, 30000);

        it('POST /api/onboarding/invitations/:id/resend — rotates token, increments resendCount', async () => {
            const res = await request(app.getHttpServer())
                .post(`/api/onboarding/invitations/${invitationId}/resend`)
                .set('Authorization', `Bearer ${ownerAccessToken}`)
                .send({})
                .expect(201);

            expect(res.body.invitationToken).toMatch(/^inv_/);
            expect(res.body.invitationToken).not.toBe(invitationToken);
            expect(res.body.resendCount).toBeGreaterThanOrEqual(1);
            invitationToken = res.body.invitationToken;
        }, 30000);

        it('POST /api/auth/invitations/accept — completes invitation + sets password', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/auth/invitations/accept')
                .send({
                    invitationToken,
                    newPassword: 'BG1-Manager#Strong2026',
                })
                .expect(200);

            expect(res.body.ok).toBe(true);
            expect(res.body.invitationId).toBe(invitationId);

            const dbRow = await prisma.invitation.findUnique({ where: { id: invitationId } });
            expect(dbRow?.status).toBe('ACCEPTED');
            expect(dbRow?.acceptedAt).not.toBeNull();
        }, 30000);

        it('POST /api/auth/invitations/accept — rejects already-accepted token (409)', async () => {
            await request(app.getHttpServer())
                .post('/api/auth/invitations/accept')
                .send({ invitationToken, newPassword: 'AnotherStrong#Pass99' })
                .expect(409);
        }, 30000);

        it('Accepted user can login with new password', async () => {
            await request(app.getHttpServer())
                .post('/api/auth/login')
                .send({ email: inviteEmail, password: 'BG1-Manager#Strong2026' })
                .expect(201);
        }, 30000);

        it('PATCH /api/onboarding/invitations/:id/revoke — rejects accepted invitation (409)', async () => {
            await request(app.getHttpServer())
                .patch(`/api/onboarding/invitations/${invitationId}/revoke`)
                .set('Authorization', `Bearer ${ownerAccessToken}`)
                .send({ reason: 'test' })
                .expect(409);
        });
    });

    // ── Password lifecycle ──

    describe('Password lifecycle', () => {
        const targetEmail = 'cashier@demo.local';
        let resetToken: string;

        it('POST /api/auth/forgot-password — generic 200 for unknown email', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/auth/forgot-password')
                .send({ email: `nobody-${uniq}@nope.test` })
                .expect(200);
            expect(res.body.ok).toBe(true);
        });

        it('POST /api/auth/forgot-password — issues reset token for known user (dev exposure)', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/auth/forgot-password')
                .send({ email: targetEmail })
                .expect(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.resetToken).toMatch(/^prt_/);
            resetToken = res.body.resetToken;
        });

        it('POST /api/auth/reset-password — consumes token + lets user log in with new password', async () => {
            const newPassword = `Cashier-${uniq}#Strong`;
            await request(app.getHttpServer())
                .post('/api/auth/reset-password')
                .send({ resetToken, newPassword })
                .expect(200);

            await request(app.getHttpServer())
                .post('/api/auth/login')
                .send({ email: targetEmail, password: newPassword })
                .expect(201);
        }, 30000);

        it('POST /api/auth/reset-password — rejects already-consumed token (409)', async () => {
            await request(app.getHttpServer())
                .post('/api/auth/reset-password')
                .send({ resetToken, newPassword: 'Anything#Strong2026' })
                .expect(409);
        });
    });

    // ── Frontline staff one-call onboarding ──

    describe('Frontline staff onboarding', () => {
        const staffEmail = `cashier-${uniq}@demo.local`;
        const staffPwd = 'Frontline#Cashier2026';

        it('POST /api/hr/frontline-staff/onboard — creates user+membership+employee+quick-pin', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/hr/frontline-staff/onboard')
                .set('Authorization', `Bearer ${ownerAccessToken}`)
                .set('x-branch-id', ownerBranchId)
                .send({
                    email: staffEmail,
                    firstName: 'BG1',
                    lastName: 'Cashier',
                    phone: '+250788000000',
                    roleName: 'Cashier',
                    enablePasswordLogin: true,
                    temporaryPassword: staffPwd,
                    issueQuickPin: true,
                    employee: {
                        hireDate: new Date().toISOString().slice(0, 10),
                        employmentType: 'PERMANENT',
                    },
                })
                .expect(201);

            expect(res.body.ok).toBe(true);
            expect(res.body.user.mustChangePassword).toBe(true);
            expect(res.body.employee.id).toBeDefined();
            expect(res.body.membership.id).toBeDefined();
            expect(res.body.quickPin.issued).toBe(true);
            expect(res.body.quickPin.pin).toMatch(/^\d{6}$/);
        }, 30000);

        it('Onboarded staff can login with temporary password', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/auth/login')
                .send({ email: staffEmail, password: staffPwd })
                .expect(201);
            expect(res.body.user.email).toBe(staffEmail);
        }, 30000);

        it('POST /api/auth/force-password-change — rotates password for must-change user', async () => {
            const loginRes = await request(app.getHttpServer())
                .post('/api/auth/login')
                .send({ email: staffEmail, password: staffPwd })
                .expect(201);
            const token = loginRes.body.accessToken;

            const res = await request(app.getHttpServer())
                .post('/api/auth/force-password-change')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    currentPassword: staffPwd,
                    newPassword: `${staffPwd}-Rotated`,
                })
                .expect(200);

            expect(res.body.ok).toBe(true);
            expect(res.body.mustChangePassword).toBe(false);
        }, 30000);

        it('POST /api/hr/frontline-staff/onboard — rejects when missing branch context (400)', async () => {
            await request(app.getHttpServer())
                .post('/api/hr/frontline-staff/onboard')
                .set('Authorization', `Bearer ${ownerAccessToken}`)
                .send({
                    email: `nobranch-${uniq}@demo.local`,
                    firstName: 'X',
                    lastName: 'Y',
                    phone: '+250788000099',
                    roleName: 'Cashier',
                    enablePasswordLogin: true,
                    temporaryPassword: 'Strong#Password2026',
                    employee: {
                        hireDate: new Date().toISOString().slice(0, 10),
                        employmentType: 'PERMANENT',
                    },
                })
                .expect(400);
        });
    });
});
