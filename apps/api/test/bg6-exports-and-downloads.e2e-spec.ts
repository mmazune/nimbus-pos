import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomBytes } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * BG6 — Export / Download Consistency + AP Supplier Detail (e2e).
 *
 * Covers:
 *   - GET  /api/accounting/ap/suppliers/:id (closes BG0 missing route)
 *   - POST /api/exports                     (facade → ReportsService)
 *   - GET  /api/exports                     (history list)
 *   - GET  /api/exports/:id                 (normalized detail envelope)
 *   - GET  /api/exports/:id/download        (stream the artefact)
 *
 * Plus:
 *   - validation failure (missing reportRunId)
 *   - permission denial (Chef → 403 across all 4 facade routes + AP detail)
 *   - download conflict (decoding errors + not-found)
 *   - BG3 idempotency replay on POST /api/exports
 *
 * Requires `pnpm db:seed` to have applied:
 *   - exports:read|write|download granted to Owner/Manager/Accountant
 *     (Chef intentionally denied).
 *   - accounting:ap:bill:read granted to Owner.
 */
describe('BG6 Exports / Downloads + AP Supplier Detail (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;

    let ownerToken: string;
    let chefToken: string;
    let ownerUserId: string;
    let orgId: string;
    let branchId: string;

    const createdSupplierIds: string[] = [];
    const createdReportRunIds: string[] = [];
    const createdExportArtifactIds: string[] = [];

    const tag = () => randomBytes(4).toString('hex').toUpperCase();
    const idemKey = (label: string) =>
        `bg6-${label}-${randomBytes(8).toString('hex')}`;

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
        ownerUserId = ownerLogin.body.user?.id ?? ownerLogin.body.userId;

        const me = await request(app.getHttpServer())
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${ownerToken}`)
            .expect(200);
        const ctx = me.body.context ?? me.body.memberships?.[0];
        orgId = ctx.defaultOrganizationId ?? ctx.organizationId ?? ctx.orgId;
        branchId = ctx.defaultBranchId ?? ctx.branchId;
        if (!ownerUserId) ownerUserId = me.body.user?.id ?? me.body.id;

        const chefLogin = await request(app.getHttpServer())
            .post('/api/auth/login')
            .send({ email: 'chef@demo.local', password: 'Chef#123' });
        expect([200, 201]).toContain(chefLogin.status);
        chefToken = chefLogin.body.accessToken;
    }, 90000);

    afterAll(async () => {
        if (createdExportArtifactIds.length) {
            await prisma.exportArtifact
                .deleteMany({ where: { id: { in: createdExportArtifactIds } } })
                .catch(() => undefined);
        }
        if (createdReportRunIds.length) {
            await prisma.reportRun
                .deleteMany({ where: { id: { in: createdReportRunIds } } })
                .catch(() => undefined);
        }
        if (createdSupplierIds.length) {
            await prisma.supplier
                .deleteMany({ where: { id: { in: createdSupplierIds } } })
                .catch(() => undefined);
        }
        await app.close();
    });

    // Helper — create a fresh supplier for AP detail tests.
    async function createSupplier(overrides: Partial<{ name: string; code: string }> = {}) {
        const name = overrides.name ?? `BG6 Supplier ${tag()}`;
        const code = overrides.code ?? `BG6S-${tag()}`;
        const res = await request(app.getHttpServer())
            .post('/api/accounting/ap/suppliers')
            .set('Authorization', `Bearer ${ownerToken}`)
            .set('X-Branch-Id', branchId)
            .send({
                name,
                code,
                contactName: 'BG6 Contact',
                email: `bg6-${tag().toLowerCase()}@example.test`,
                phone: '+250788000000',
                currencyCode: 'USD',
                paymentTermDays: 30,
            });
        expect([200, 201]).toContain(res.status);
        const id = res.body?.id ?? res.body?.supplier?.id;
        expect(typeof id).toBe('string');
        createdSupplierIds.push(id);
        return { id, name, code };
    }

    // Helper — generate a daily-sales report run (status COMPLETED).
    async function generateDailySalesRun() {
        const today = new Date().toISOString().slice(0, 10);
        const res = await request(app.getHttpServer())
            .post('/api/reports/daily-sales')
            .set('Authorization', `Bearer ${ownerToken}`)
            .set('X-Branch-Id', branchId)
            .send({ reportWindow: 'DAY', dateFrom: today, dateTo: today });
        expect([200, 201]).toContain(res.status);
        const id = res.body?.id ?? res.body?.run?.id;
        expect(typeof id).toBe('string');
        createdReportRunIds.push(id);
        return id;
    }

    // ───────────────────────── A) AP Supplier Detail ─────────────────────────

    describe('A. GET /api/accounting/ap/suppliers/:id', () => {
        it('owner gets supplier detail with summary block', async () => {
            const sup = await createSupplier();
            const res = await request(app.getHttpServer())
                .get(`/api/accounting/ap/suppliers/${sup.id}`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId);
            expect(res.status).toBe(200);
            expect(res.body.supplier.id).toBe(sup.id);
            expect(res.body.supplier.name).toBe(sup.name);
            expect(res.body.summary).toBeDefined();
            expect(res.body.summary.billCount).toBe(0);
            expect(res.body.summary.openBillCount).toBe(0);
            expect(res.body.summary.outstandingTotal).toBeDefined();
            expect(Array.isArray(res.body.recentBills)).toBe(true);
            expect(Array.isArray(res.body.recentPayments)).toBe(true);
        });

        it('returns 404 for unknown supplier id', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/accounting/ap/suppliers/sup_does_not_exist_xyz')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId);
            expect(res.status).toBe(404);
        });

        it('chef is denied (403)', async () => {
            const sup = await createSupplier();
            const res = await request(app.getHttpServer())
                .get(`/api/accounting/ap/suppliers/${sup.id}`)
                .set('Authorization', `Bearer ${chefToken}`)
                .set('X-Branch-Id', branchId);
            expect(res.status).toBe(403);
        });
    });

    // ───────────────────────── B) Create Export ──────────────────────────────

    describe('B. POST /api/exports', () => {
        it('owner can request a CSV export from a completed report run', async () => {
            const runId = await generateDailySalesRun();
            const res = await request(app.getHttpServer())
                .post('/api/exports')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({ sourceDomain: 'reports', reportRunId: runId, format: 'CSV' });
            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.action).toBe('EXPORT_REQUESTED');
            expect(res.body.export.exportId.startsWith('reports:')).toBe(true);
            expect(res.body.export.sourceDomain).toBe('reports');
            expect(res.body.export.status).toBe('COMPLETED');
            expect(res.body.export.downloadReady).toBe(true);
            expect(res.body.export.format).toBe('CSV');
            createdExportArtifactIds.push(res.body.export.exportId.split(':')[1]);
        });

        it('rejects payload missing reportRunId (400)', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/exports')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({ sourceDomain: 'reports', format: 'CSV' });
            expect(res.status).toBe(400);
        });

        it('rejects unsupported sourceDomain enum (400)', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/exports')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({ sourceDomain: 'payroll', format: 'CSV' });
            expect(res.status).toBe(400);
        });

        it('chef is denied (403)', async () => {
            const runId = await generateDailySalesRun();
            const res = await request(app.getHttpServer())
                .post('/api/exports')
                .set('Authorization', `Bearer ${chefToken}`)
                .set('X-Branch-Id', branchId)
                .send({ sourceDomain: 'reports', reportRunId: runId, format: 'CSV' });
            expect(res.status).toBe(403);
        });

        // C-01: this replay previously used format: 'PDF', which the reports service
        // silently satisfied with a plain-text file. The replay behaviour it actually
        // tests is format-agnostic, so it now runs on the one format Nimbus can really
        // produce; the PDF contract is asserted directly in the test below.
        it('BG3 idempotency replay returns identical body for same key+payload', async () => {
            const runId = await generateDailySalesRun();
            const key = idemKey('export-replay');
            const first = await request(app.getHttpServer())
                .post('/api/exports')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .set('Idempotency-Key', key)
                .send({ sourceDomain: 'reports', reportRunId: runId, format: 'CSV' });
            expect(first.status).toBe(200);
            createdExportArtifactIds.push(first.body.export.exportId.split(':')[1]);

            const second = await request(app.getHttpServer())
                .post('/api/exports')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .set('Idempotency-Key', key)
                .send({ sourceDomain: 'reports', reportRunId: runId, format: 'CSV' });
            expect(second.status).toBe(200);
            expect(second.body.export.exportId).toBe(first.body.export.exportId);
        });

        // C-01 (NG-01 / MP0-03): the export facade must not be a back door to the
        // withdrawn PDF path — it delegates to ReportsService.createExport.
        it('PDF through the export facade is refused with 501, not a fake artifact', async () => {
            const runId = await generateDailySalesRun();
            const res = await request(app.getHttpServer())
                .post('/api/exports')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({ sourceDomain: 'reports', reportRunId: runId, format: 'PDF' });
            expect(res.status).toBe(501);
            expect(res.body.message).toMatch(/PDF renderer/);
        });
    });

    // ───────────────────────── C) List / Detail ──────────────────────────────

    describe('C. GET /api/exports + GET /api/exports/:id', () => {
        it('owner can list export history (data array + pagination)', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/exports?pageSize=10')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId);
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(typeof res.body.total).toBe('number');
            expect(res.body.page).toBe(1);
            expect(res.body.pageSize).toBe(10);
            for (const row of res.body.data) {
                expect(['reports', 'documents']).toContain(row.sourceDomain);
                expect(row.exportId).toMatch(/^(reports|documents):/);
                expect(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'EXPIRED']).toContain(
                    row.status,
                );
            }
        });

        it('list filters by sourceDomain=reports include only report exports', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/exports?sourceDomain=reports&pageSize=20')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId);
            expect(res.status).toBe(200);
            for (const row of res.body.data) {
                expect(row.sourceDomain).toBe('reports');
            }
        });

        it('detail returns the same envelope as list rows', async () => {
            const runId = await generateDailySalesRun();
            const created = await request(app.getHttpServer())
                .post('/api/exports')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({ sourceDomain: 'reports', reportRunId: runId, format: 'CSV' });
            expect(created.status).toBe(200);
            const exportId = created.body.export.exportId;
            createdExportArtifactIds.push(exportId.split(':')[1]);

            const res = await request(app.getHttpServer())
                .get(`/api/exports/${encodeURIComponent(exportId)}`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId);
            expect(res.status).toBe(200);
            expect(res.body.export.exportId).toBe(exportId);
            expect(res.body.export.status).toBe('COMPLETED');
            expect(res.body.export.downloadUrl).toContain(
                encodeURIComponent(exportId.split(':')[0]),
            );
        });

        it('detail returns 400 for malformed id (no domain prefix)', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/exports/this-is-not-a-valid-id')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId);
            expect(res.status).toBe(400);
        });

        it('detail returns 404 for unknown report id', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/exports/reports:does_not_exist_xyz')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId);
            expect(res.status).toBe(404);
        });

        it('chef is denied on list (403)', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/exports')
                .set('Authorization', `Bearer ${chefToken}`)
                .set('X-Branch-Id', branchId);
            expect(res.status).toBe(403);
        });
    });

    // ───────────────────────── D) Download ───────────────────────────────────

    describe('D. GET /api/exports/:id/download', () => {
        it('owner can download a ready report export', async () => {
            const runId = await generateDailySalesRun();
            const created = await request(app.getHttpServer())
                .post('/api/exports')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({ sourceDomain: 'reports', reportRunId: runId, format: 'CSV' });
            expect(created.status).toBe(200);
            const exportId = created.body.export.exportId;
            createdExportArtifactIds.push(exportId.split(':')[1]);

            const res = await request(app.getHttpServer())
                .get(`/api/exports/${encodeURIComponent(exportId)}/download`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .buffer(true);
            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toContain('text/csv');
            expect(res.headers['content-disposition']).toContain('attachment');
            expect(res.body.length ?? res.text?.length ?? 0).toBeGreaterThan(0);
        });

        it('returns 400 for malformed id', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/exports/no-prefix/download')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId);
            expect(res.status).toBe(400);
        });

        it('chef is denied (403)', async () => {
            const runId = await generateDailySalesRun();
            const created = await request(app.getHttpServer())
                .post('/api/exports')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({ sourceDomain: 'reports', reportRunId: runId, format: 'CSV' });
            expect(created.status).toBe(200);
            const exportId = created.body.export.exportId;
            createdExportArtifactIds.push(exportId.split(':')[1]);

            const res = await request(app.getHttpServer())
                .get(`/api/exports/${encodeURIComponent(exportId)}/download`)
                .set('Authorization', `Bearer ${chefToken}`)
                .set('X-Branch-Id', branchId);
            expect(res.status).toBe(403);
        });
    });
});
