import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * M38 Franchise + Multi-Branch Suite e2e tests.
 * Requires seeded DB with M38 permissions and at least two branches.
 */
describe('Franchise + Multi-Branch Suite (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let ownerToken: string;
    let chefToken: string;
    let orgId: string;
    let mainBranchId: string;
    let downtownBranchId: string;

    // IDs captured during tests
    let transferId: string;
    let digestSubscriptionId: string;

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

        // Login as owner (full franchise permissions)
        const ownerLogin = await request(app.getHttpServer())
            .post('/api/auth/login')
            .send({ email: 'owner@demo.local', password: 'Owner#123' });
        ownerToken = ownerLogin.body.accessToken;

        // Login as chef (no franchise permissions)
        const chefLogin = await request(app.getHttpServer())
            .post('/api/auth/login')
            .send({ email: 'chef@demo.local', password: 'Chef#123' });
        chefToken = chefLogin.body.accessToken;

        // Resolve org + branches
        const branch = await prisma.branch.findFirst({ where: { code: 'MAIN' } });
        orgId = branch!.organizationId;
        mainBranchId = branch!.id;

        const downtown = await prisma.branch.findFirst({
            where: { organizationId: orgId, code: 'DOWNTOWN' },
        });
        downtownBranchId = downtown!.id;
    }, 60000);

    afterAll(async () => {
        // Clean up test-created resources in reverse dependency order
        if (digestSubscriptionId) {
            await prisma.hqDigestSubscription
                .deleteMany({ where: { id: digestSubscriptionId } })
                .catch(() => { });
        }
        if (transferId) {
            await prisma.interBranchTransfer.deleteMany({ where: { id: transferId } }).catch(() => { });
        }
        await app.close();
    }, 30000);

    // ── Overview ──

    describe('GET /api/franchise/overview', () => {
        it('should return 401 without token', async () => {
            await request(app.getHttpServer()).get('/api/franchise/overview').expect(401);
        });

        it('should return 403 for chef', async () => {
            await request(app.getHttpServer())
                .get('/api/franchise/overview')
                .set('Authorization', `Bearer ${chefToken}`)
                .expect(403);
        });

        it('should return overview for owner', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/franchise/overview')
                .set('Authorization', `Bearer ${ownerToken}`)
                .expect(200);

            expect(res.body.orgId).toBe(orgId);
            expect(res.body.branchCount).toBeGreaterThanOrEqual(2);
            expect(res.body.branches).toBeInstanceOf(Array);
            expect(res.body.branches[0]).toHaveProperty('budget');
            expect(res.body.branches[0]).toHaveProperty('procurement');
            expect(res.body.branches[0]).toHaveProperty('stockHealth');
        });
    });

    // ── Rankings ──

    describe('GET /api/franchise/rankings', () => {
        it('should return 401 without token', async () => {
            await request(app.getHttpServer()).get('/api/franchise/rankings').expect(401);
        });

        it('should return 403 for chef', async () => {
            await request(app.getHttpServer())
                .get('/api/franchise/rankings')
                .set('Authorization', `Bearer ${chefToken}`)
                .expect(403);
        });

        it('should return rankings for owner', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/franchise/rankings')
                .set('Authorization', `Bearer ${ownerToken}`)
                .expect(200);

            expect(res.body.orgId).toBe(orgId);
            expect(res.body.rankings).toBeDefined();
        });
    });

    describe('POST /api/franchise/rankings/generate', () => {
        it('should generate rankings', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/franchise/rankings/generate')
                .set('Authorization', `Bearer ${ownerToken}`)
                .expect(200);

            expect(res.body).toBeInstanceOf(Array);
        });
    });

    // ── Budget Rollups ──

    describe('GET /api/franchise/budgets', () => {
        it('should return 401 without token', async () => {
            await request(app.getHttpServer()).get('/api/franchise/budgets').expect(401);
        });

        it('should return 403 for chef', async () => {
            await request(app.getHttpServer())
                .get('/api/franchise/budgets')
                .set('Authorization', `Bearer ${chefToken}`)
                .expect(403);
        });

        it('should return budget rollups for owner', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/franchise/budgets')
                .set('Authorization', `Bearer ${ownerToken}`)
                .expect(200);

            expect(res.body.orgId).toBe(orgId);
            expect(res.body.portfolio).toBeDefined();
            expect(res.body.branches).toBeInstanceOf(Array);
        });

        it('should filter by branchId', async () => {
            const res = await request(app.getHttpServer())
                .get(`/api/franchise/budgets?branchId=${mainBranchId}`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .expect(200);

            expect(res.body.branches).toHaveLength(1);
            expect(res.body.branches[0].branchId).toBe(mainBranchId);
        });
    });

    // ── Transfers ──

    describe('POST /api/franchise/transfers', () => {
        it('should return 401 without token', async () => {
            await request(app.getHttpServer()).post('/api/franchise/transfers').send({}).expect(401);
        });

        it('should return 403 for chef', async () => {
            await request(app.getHttpServer())
                .post('/api/franchise/transfers')
                .set('Authorization', `Bearer ${chefToken}`)
                .send({
                    fromBranchId: mainBranchId,
                    toBranchId: downtownBranchId,
                    quantity: 5,
                    rationale: 'test',
                })
                .expect(403);
        });

        it('should create a transfer', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/franchise/transfers')
                .set('Authorization', `Bearer ${ownerToken}`)
                .send({
                    fromBranchId: mainBranchId,
                    toBranchId: downtownBranchId,
                    transferType: 'STOCK',
                    urgency: 'MEDIUM',
                    quantity: 5,
                    estimatedValue: 60000,
                    rationale: 'E2E test transfer',
                })
                .expect(201);

            expect(res.body.transferNumber).toMatch(/^TRF-/);
            expect(res.body.fromBranch).toBeDefined();
            expect(res.body.toBranch).toBeDefined();
            transferId = res.body.id;
        });

        it('should reject same-branch transfer', async () => {
            await request(app.getHttpServer())
                .post('/api/franchise/transfers')
                .set('Authorization', `Bearer ${ownerToken}`)
                .send({
                    fromBranchId: mainBranchId,
                    toBranchId: mainBranchId,
                    quantity: 5,
                    rationale: 'same branch',
                })
                .expect(400);
        });
    });

    describe('GET /api/franchise/transfers', () => {
        it('should list transfers', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/franchise/transfers')
                .set('Authorization', `Bearer ${ownerToken}`)
                .expect(200);

            expect(res.body).toBeInstanceOf(Array);
        });
    });

    describe('GET /api/franchise/transfers/:id', () => {
        it('should return transfer by id', async () => {
            if (!transferId) return;
            const res = await request(app.getHttpServer())
                .get(`/api/franchise/transfers/${transferId}`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .expect(200);

            expect(res.body.id).toBe(transferId);
        });

        it('should return 404 for nonexistent transfer', async () => {
            await request(app.getHttpServer())
                .get('/api/franchise/transfers/nonexistent-id')
                .set('Authorization', `Bearer ${ownerToken}`)
                .expect(404);
        });
    });

    describe('PATCH /api/franchise/transfers/:id/status', () => {
        it('should approve a REQUESTED transfer', async () => {
            if (!transferId) return;
            const res = await request(app.getHttpServer())
                .patch(`/api/franchise/transfers/${transferId}/status`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .send({ status: 'APPROVED' })
                .expect(200);

            expect(res.body.status).toBe('APPROVED');
        });

        it('should reject invalid transition', async () => {
            if (!transferId) return;
            await request(app.getHttpServer())
                .patch(`/api/franchise/transfers/${transferId}/status`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .send({ status: 'REQUESTED' })
                .expect(400);
        });
    });

    // ── Procurement Pressure ──

    describe('GET /api/franchise/procurement-pressure', () => {
        it('should return 401 without token', async () => {
            await request(app.getHttpServer()).get('/api/franchise/procurement-pressure').expect(401);
        });

        it('should return procurement pressure for owner', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/franchise/procurement-pressure')
                .set('Authorization', `Bearer ${ownerToken}`)
                .expect(200);

            expect(res.body.orgId).toBe(orgId);
            expect(res.body.branches).toBeInstanceOf(Array);
            expect(res.body.totalUrgentCount).toBeDefined();
        });
    });

    // ── Digest Subscriptions ──

    describe('POST /api/franchise/digests', () => {
        it('should return 401 without token', async () => {
            await request(app.getHttpServer()).post('/api/franchise/digests').send({}).expect(401);
        });

        it('should create a digest subscription', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/franchise/digests')
                .set('Authorization', `Bearer ${ownerToken}`)
                .send({
                    digestType: 'BRANCH_COMPARISON',
                    frequency: 'DAILY',
                    channel: 'IN_APP',
                })
                .expect(201);

            expect(res.body.digestType).toBe('BRANCH_COMPARISON');
            expect(res.body.frequency).toBe('DAILY');
            digestSubscriptionId = res.body.id;
        });
    });

    describe('GET /api/franchise/digests', () => {
        it('should list digest subscriptions', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/franchise/digests')
                .set('Authorization', `Bearer ${ownerToken}`)
                .expect(200);

            expect(res.body).toBeInstanceOf(Array);
        });
    });

    describe('PATCH /api/franchise/digests/:id', () => {
        it('should update a digest subscription', async () => {
            if (!digestSubscriptionId) return;
            const res = await request(app.getHttpServer())
                .patch(`/api/franchise/digests/${digestSubscriptionId}`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .send({ isActive: false })
                .expect(200);

            expect(res.body.isActive).toBe(false);
        });

        it('should return 404 for wrong subscription', async () => {
            await request(app.getHttpServer())
                .patch('/api/franchise/digests/nonexistent-id')
                .set('Authorization', `Bearer ${ownerToken}`)
                .send({ isActive: false })
                .expect(404);
        });
    });
});
