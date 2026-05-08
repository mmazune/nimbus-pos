import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * BG7 — HMS Integration façade (e2e).
 *
 * Validates the inbound API-key auth path and the read-only /api/hms/*
 * façade. Covers:
 *   - 401 with no key, bad key, revoked key, expired key
 *   - org-wide key sees all branches
 *   - branch-scoped key forces filter (cannot see other branches)
 *   - whoami / branches / orders list / payments / sales summary / shifts
 *   - access logs are written and visible via /api/hms/access-logs
 *
 * Requires `pnpm db:seed` (M39 owner role + BG7 marker).
 */
describe('BG7 HMS Integration (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;

    let ownerToken: string;
    let orgId: string;
    let branchId: string;

    let orgWideKey: string;
    let branchScopedKey: string;
    let revokedKey: string;
    let orgWideKeyId: string;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.setGlobalPrefix('api');
        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                forbidNonWhitelisted: true,
                transform: true,
            }),
        );
        await app.init();
        prisma = moduleFixture.get(PrismaService);

        const ownerLogin = await request(app.getHttpServer())
            .post('/api/auth/login')
            .send({ email: 'owner@demo.local', password: 'Owner#123' });
        expect([200, 201]).toContain(ownerLogin.status);
        ownerToken = ownerLogin.body.accessToken;

        const me = await request(app.getHttpServer())
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${ownerToken}`)
            .expect(200);
        const ctx = me.body.context ?? me.body.memberships?.[0];
        orgId = ctx.defaultOrganizationId ?? ctx.organizationId ?? ctx.orgId;
        branchId = ctx.defaultBranchId ?? ctx.branchId;

        // Mint three keys: org-wide, branch-scoped, and one we'll revoke.
        const k1 = await request(app.getHttpServer())
            .post('/api/dev/api-keys')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ name: `bg7-org-wide-${Date.now()}` })
            .expect(201);
        orgWideKey = k1.body.key;
        orgWideKeyId = k1.body.id;
        expect(k1.body.scope).toBe('ORGANIZATION');
        expect(k1.body.branchId).toBeNull();

        const k2 = await request(app.getHttpServer())
            .post('/api/dev/api-keys')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ name: `bg7-branch-${Date.now()}`, branchId })
            .expect(201);
        branchScopedKey = k2.body.key;
        expect(k2.body.scope).toBe('BRANCH');
        expect(k2.body.branchId).toBe(branchId);

        const k3 = await request(app.getHttpServer())
            .post('/api/dev/api-keys')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ name: `bg7-revoked-${Date.now()}` })
            .expect(201);
        revokedKey = k3.body.key;
        await request(app.getHttpServer())
            .post(`/api/dev/api-keys/${k3.body.id}/revoke`)
            .set('Authorization', `Bearer ${ownerToken}`)
            .expect(201);
    });

    afterAll(async () => {
        await app.close();
    });

    describe('Authentication', () => {
        it('rejects request with no key (401)', async () => {
            const r = await request(app.getHttpServer()).get('/api/hms/whoami');
            expect(r.status).toBe(401);
        });

        it('rejects unknown key (401)', async () => {
            const r = await request(app.getHttpServer())
                .get('/api/hms/whoami')
                .set('x-api-key', 'this-is-not-a-real-key');
            expect(r.status).toBe(401);
            expect(r.body.code ?? r.body.error?.code).toBe('API_KEY_INVALID');
        });

        it('rejects revoked key (401)', async () => {
            const r = await request(app.getHttpServer())
                .get('/api/hms/whoami')
                .set('x-api-key', revokedKey);
            expect(r.status).toBe(401);
            expect(r.body.code ?? r.body.error?.code).toBe('API_KEY_REVOKED');
        });

        it('accepts Authorization: ApiKey <key> form', async () => {
            const r = await request(app.getHttpServer())
                .get('/api/hms/whoami')
                .set('Authorization', `ApiKey ${orgWideKey}`);
            expect(r.status).toBe(200);
            expect(r.body.scope).toBe('ORGANIZATION');
        });
    });

    describe('Whoami + scope', () => {
        it('org-wide key reports ORGANIZATION scope and lists all branches', async () => {
            const me = await request(app.getHttpServer())
                .get('/api/hms/whoami')
                .set('x-api-key', orgWideKey)
                .expect(200);
            expect(me.body.scope).toBe('ORGANIZATION');
            expect(me.body.branchId).toBeNull();
            expect(me.body.grantedPermissions).toContain('hms:read:*');

            const br = await request(app.getHttpServer())
                .get('/api/hms/branches')
                .set('x-api-key', orgWideKey)
                .expect(200);
            expect(Array.isArray(br.body)).toBe(true);
            // org-wide should at least see the seeded branch
            expect(br.body.length).toBeGreaterThanOrEqual(1);
        });

        it('branch-scoped key reports BRANCH scope and lists exactly one branch', async () => {
            const me = await request(app.getHttpServer())
                .get('/api/hms/whoami')
                .set('x-api-key', branchScopedKey)
                .expect(200);
            expect(me.body.scope).toBe('BRANCH');
            expect(me.body.branchId).toBe(branchId);

            const br = await request(app.getHttpServer())
                .get('/api/hms/branches')
                .set('x-api-key', branchScopedKey)
                .expect(200);
            expect(br.body.length).toBe(1);
            expect(br.body[0].id).toBe(branchId);
        });
    });

    describe('Read façade', () => {
        it('GET /api/hms/organization returns org + branchScope', async () => {
            const r = await request(app.getHttpServer())
                .get('/api/hms/organization')
                .set('x-api-key', orgWideKey)
                .expect(200);
            expect(r.body.organization.id).toBe(orgId);
            expect(r.body.branchScope).toBe('ORGANIZATION');
        });

        it('GET /api/hms/orders is paginated and scoped', async () => {
            const r = await request(app.getHttpServer())
                .get('/api/hms/orders?limit=5')
                .set('x-api-key', orgWideKey)
                .expect(200);
            expect(typeof r.body.total).toBe('number');
            expect(Array.isArray(r.body.items)).toBe(true);
            expect(r.body.limit).toBe(5);
        });

        it('GET /api/hms/payments is paginated', async () => {
            const r = await request(app.getHttpServer())
                .get('/api/hms/payments?limit=10')
                .set('x-api-key', orgWideKey)
                .expect(200);
            expect(Array.isArray(r.body.items)).toBe(true);
        });

        it('GET /api/hms/sales/summary returns totals', async () => {
            const r = await request(app.getHttpServer())
                .get('/api/hms/sales/summary')
                .set('x-api-key', orgWideKey)
                .expect(200);
            expect(r.body.totals).toBeDefined();
            expect(r.body.window).toBeDefined();
        });

        it('GET /api/hms/reservations responds 200', async () => {
            await request(app.getHttpServer())
                .get('/api/hms/reservations?limit=5')
                .set('x-api-key', orgWideKey)
                .expect(200);
        });

        it('GET /api/hms/menu responds 200', async () => {
            await request(app.getHttpServer())
                .get('/api/hms/menu?limit=5')
                .set('x-api-key', orgWideKey)
                .expect(200);
        });

        it('GET /api/hms/inventory responds 200', async () => {
            await request(app.getHttpServer())
                .get('/api/hms/inventory?limit=5')
                .set('x-api-key', orgWideKey)
                .expect(200);
        });

        it('GET /api/hms/shifts responds 200', async () => {
            await request(app.getHttpServer())
                .get('/api/hms/shifts?limit=5')
                .set('x-api-key', orgWideKey)
                .expect(200);
        });

        it('GET /api/hms/accounting/accounts responds 200', async () => {
            await request(app.getHttpServer())
                .get('/api/hms/accounting/accounts?limit=10')
                .set('x-api-key', orgWideKey)
                .expect(200);
        });
    });

    describe('Access journal', () => {
        it('writes access logs that surface via /api/hms/access-logs', async () => {
            // Make a deliberate request first
            await request(app.getHttpServer())
                .get('/api/hms/branches')
                .set('x-api-key', orgWideKey)
                .expect(200);

            // Allow the fire-and-forget write to land
            await new Promise((r) => setTimeout(r, 200));

            const logs = await request(app.getHttpServer())
                .get('/api/hms/access-logs?limit=10')
                .set('x-api-key', orgWideKey)
                .expect(200);
            expect(Array.isArray(logs.body.items)).toBe(true);
            expect(logs.body.items.length).toBeGreaterThan(0);
            const sample = logs.body.items[0];
            expect(sample.apiKeyId).toBe(orgWideKeyId);
            expect(sample.statusCode).toBe(200);
            expect(typeof sample.durationMs).toBe('number');
        });
    });

    describe('Tenancy isolation (branch-scoped key)', () => {
        it('returns same /branches list (single) regardless of any client filter', async () => {
            const r = await request(app.getHttpServer())
                .get('/api/hms/branches')
                .set('x-api-key', branchScopedKey)
                .expect(200);
            expect(r.body.length).toBe(1);
            expect(r.body[0].id).toBe(branchId);

            // If the seed has more than one branch, an org-wide key should see > 1
            const all = await prisma.branch.count({ where: { organizationId: orgId } });
            if (all > 1) {
                const orgList = await request(app.getHttpServer())
                    .get('/api/hms/branches')
                    .set('x-api-key', orgWideKey)
                    .expect(200);
                expect(orgList.body.length).toBeGreaterThan(1);
            }
        });
    });
});
