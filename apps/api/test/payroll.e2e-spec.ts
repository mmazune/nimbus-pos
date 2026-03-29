import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * M26 Payroll Engine + Pay Runs + Payslips e2e tests.
 * Requires seeded DB with M26 permissions + at least 1 employee with compensation.
 */
describe('Payroll Engine + Pay Runs + Payslips (e2e)', () => {
    let app: INestApplication;
    let moduleFixture: TestingModule;
    let prisma: PrismaService;
    let ownerToken: string;
    let chefToken: string;
    let branchId: string;

    // IDs captured during tests
    let employeeId: string;
    let payComponentId: string;
    let adjustmentId: string;
    let payRunId: string;
    let paySlipId: string;

    const uniqueCode = `E2E_${Date.now()}`;

    beforeAll(async () => {
        moduleFixture = await Test.createTestingModule({
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

        // Login as owner
        const ownerLogin = await request(app.getHttpServer())
            .post('/api/auth/login')
            .send({ email: 'owner@demo.local', password: 'Owner#123' });
        ownerToken = ownerLogin.body.accessToken;

        // Login as chef (limited permissions)
        const chefLogin = await request(app.getHttpServer())
            .post('/api/auth/login')
            .send({ email: 'chef@demo.local', password: 'Chef#123' });
        chefToken = chefLogin.body.accessToken;

        // Get branch ID
        const me = await request(app.getHttpServer())
            .get('/api/me')
            .set('Authorization', `Bearer ${ownerToken}`);
        branchId =
            me.body.defaultBranch?.id ||
            me.body.organizations?.[0]?.branches?.[0]?.id ||
            me.body.branches?.[0]?.id ||
            me.body.memberships?.[0]?.branchId;

        if (!branchId) {
            const branch = await prisma.branch.findFirst();
            branchId = branch!.id;
        }

        // Get employee from seed
        const employees = await prisma.employee.findMany({
            where: { status: 'ACTIVE' },
            include: { compensationProfile: true },
            take: 1,
        });
        if (employees.length >= 1) {
            employeeId = employees[0].id;
        }
    }, 60000);

    afterAll(async () => {
        // Cleanup e2e pay runs and related data
        if (payRunId) {
            await prisma.paySlip.deleteMany({ where: { payRunId } });
            await prisma.payRun.deleteMany({ where: { id: payRunId } });
        }
        if (adjustmentId) {
            await prisma.payrollAdjustment.deleteMany({ where: { id: adjustmentId } });
        }
        if (payComponentId) {
            await prisma.payComponent.deleteMany({ where: { id: payComponentId } });
        }
        await app.close();
    }, 30000);

    // ── Pay Components ──

    describe('POST /api/payroll/components', () => {
        it('should create a pay component', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/payroll/components')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('x-branch-id', branchId)
                .send({
                    code: `SAL-${uniqueCode}`,
                    name: 'Test Basic Salary',
                    componentType: 'EARNING',
                    taxable: true,
                    defaultAmount: 500000,
                });

            expect(res.status).toBe(201);
            expect(res.body.id).toBeDefined();
            expect(res.body.code).toBe(`SAL-${uniqueCode}`);
            payComponentId = res.body.id;
        });

        it('should reject duplicate component code', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/payroll/components')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('x-branch-id', branchId)
                .send({
                    code: `SAL-${uniqueCode}`,
                    name: 'Duplicate',
                    componentType: 'EARNING',
                });

            expect(res.status).toBe(409);
        });

        it('should reject unauthorized role (Chef)', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/payroll/components')
                .set('Authorization', `Bearer ${chefToken}`)
                .set('x-branch-id', branchId)
                .send({
                    code: 'CHEF-COMP',
                    name: 'Chef Component',
                    componentType: 'EARNING',
                });

            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/payroll/components', () => {
        it('should list pay components', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/payroll/components')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('x-branch-id', branchId);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    // ── Payroll Adjustments ──

    describe('POST /api/payroll/adjustments', () => {
        it('should create a payroll adjustment', async () => {
            if (!employeeId) return;

            const res = await request(app.getHttpServer())
                .post('/api/payroll/adjustments')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('x-branch-id', branchId)
                .send({
                    employeeId,
                    adjustmentType: 'BONUS',
                    amount: 50000,
                    effectiveDate: '2025-04-15',
                    notes: 'E2e test bonus',
                });

            expect(res.status).toBe(201);
            expect(res.body.id).toBeDefined();
            adjustmentId = res.body.id;
        });

        it('should reject unknown employee', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/payroll/adjustments')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('x-branch-id', branchId)
                .send({
                    employeeId: 'nonexistent',
                    adjustmentType: 'BONUS',
                    amount: 50000,
                    effectiveDate: '2025-04-15',
                });

            expect(res.status).toBe(404);
        });
    });

    describe('GET /api/payroll/adjustments', () => {
        it('should list adjustments', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/payroll/adjustments')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('x-branch-id', branchId);

            expect(res.status).toBe(200);
            expect(res.body.data).toBeDefined();
            expect(res.body.total).toBeGreaterThanOrEqual(0);
        });
    });

    // ── Pay Runs ──

    describe('POST /api/payroll/runs/build', () => {
        it('should build a pay run', async () => {
            if (!employeeId) return;

            const res = await request(app.getHttpServer())
                .post('/api/payroll/runs/build')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('x-branch-id', branchId)
                .send({
                    name: `E2E Pay Run ${uniqueCode}`,
                    periodStart: '2099-01-01',
                    periodEnd: '2099-01-31',
                });

            expect(res.status).toBe(201);
            expect(res.body.id).toBeDefined();
            expect(res.body.status).toBe('DRAFT');
            expect(res.body.paySlips).toBeDefined();
            payRunId = res.body.id;

            if (res.body.paySlips?.length > 0) {
                paySlipId = res.body.paySlips[0].id;
            }
        });

        it('should reject overlapping pay run', async () => {
            if (!payRunId) return;

            const res = await request(app.getHttpServer())
                .post('/api/payroll/runs/build')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('x-branch-id', branchId)
                .send({
                    name: 'Overlap Run',
                    periodStart: '2099-01-10',
                    periodEnd: '2099-01-20',
                });

            expect(res.status).toBe(409);
        });
    });

    describe('PATCH /api/payroll/runs/:id/approve', () => {
        it('should approve a DRAFT pay run', async () => {
            if (!payRunId) return;

            const res = await request(app.getHttpServer())
                .patch(`/api/payroll/runs/${payRunId}/approve`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('x-branch-id', branchId)
                .send({ notes: 'Approved in e2e' });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('APPROVED');
        });

        it('should reject re-approval of APPROVED run', async () => {
            if (!payRunId) return;

            const res = await request(app.getHttpServer())
                .patch(`/api/payroll/runs/${payRunId}/approve`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('x-branch-id', branchId)
                .send({});

            expect(res.status).toBe(400);
        });
    });

    describe('PATCH /api/payroll/runs/:id/pay', () => {
        it('should mark an APPROVED pay run as PAID', async () => {
            if (!payRunId) return;

            const res = await request(app.getHttpServer())
                .patch(`/api/payroll/runs/${payRunId}/pay`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('x-branch-id', branchId)
                .send({ notes: 'Paid in e2e' });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('PAID');
        });
    });

    describe('GET /api/payroll/runs', () => {
        it('should list pay runs', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/payroll/runs')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('x-branch-id', branchId);

            expect(res.status).toBe(200);
            expect(res.body.data).toBeDefined();
            expect(res.body.total).toBeGreaterThanOrEqual(0);
        });
    });

    describe('GET /api/payroll/runs/:id', () => {
        it('should get a pay run by ID', async () => {
            if (!payRunId) return;

            const res = await request(app.getHttpServer())
                .get(`/api/payroll/runs/${payRunId}`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('x-branch-id', branchId);

            expect(res.status).toBe(200);
            expect(res.body.id).toBe(payRunId);
            expect(res.body.paySlips).toBeDefined();
        });

        it('should return 404 for missing pay run', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/payroll/runs/nonexistent')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('x-branch-id', branchId);

            expect(res.status).toBe(404);
        });
    });

    // ── Pay Slips ──

    describe('GET /api/payroll/slips', () => {
        it('should list pay slips', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/payroll/slips')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('x-branch-id', branchId);

            expect(res.status).toBe(200);
            expect(res.body.data).toBeDefined();
        });

        it('should filter by payRunId', async () => {
            if (!payRunId) return;

            const res = await request(app.getHttpServer())
                .get(`/api/payroll/slips?payRunId=${payRunId}`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('x-branch-id', branchId);

            expect(res.status).toBe(200);
            expect(res.body.data).toBeDefined();
        });
    });

    describe('GET /api/payroll/slips/:id', () => {
        it('should get a pay slip by ID', async () => {
            if (!paySlipId) return;

            const res = await request(app.getHttpServer())
                .get(`/api/payroll/slips/${paySlipId}`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('x-branch-id', branchId);

            expect(res.status).toBe(200);
            expect(res.body.id).toBe(paySlipId);
            expect(res.body.componentSnapshot).toBeDefined();
        });

        it('should return 404 for missing slip', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/payroll/slips/nonexistent')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('x-branch-id', branchId);

            expect(res.status).toBe(404);
        });
    });
});
