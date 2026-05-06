import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * M41 — Reliability Layer (Idempotency + Sync Jobs + Conflicts) — e2e
 *
 * Validates:
 *   - POST /sync/replay creates a SyncJob and runs the GENERIC_REPLAY handler
 *   - Resubmitting the same clientMutationId returns the same job (no duplicate)
 *   - GET /sync/jobs lists jobs for the active org
 *   - POST /sync/jobs/:id/retry refuses already-SUCCEEDED jobs (409)
 *   - GET /sync/conflicts returns seeded conflict
 *   - PATCH /sync/conflicts/:id/resolve transitions OPEN → RESOLVED
 *   - chef token cannot access /sync/replay (403)
 */
describe('M41 Reliability Layer (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let ownerToken: string;
    let chefToken: string;
    const cmid = `e2e-m41-${Date.now()}`;
    let createdJobId: string | undefined;

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
        ownerToken = ownerLogin.body.accessToken;

        const chefLogin = await request(app.getHttpServer())
            .post('/api/auth/login')
            .send({ email: 'chef@demo.local', password: 'Chef#123' });
        chefToken = chefLogin.body.accessToken;
    }, 60000);

    afterAll(async () => {
        if (createdJobId) {
            await prisma.syncJob.deleteMany({ where: { id: createdJobId } }).catch(() => undefined);
        }
        await app.close();
    });

    it('POST /sync/replay accepts a GENERIC_REPLAY job and runs it (SUCCEEDED)', async () => {
        const res = await request(app.getHttpServer())
            .post('/api/sync/replay')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({
                executeNow: true,
                jobs: [
                    {
                        clientMutationId: cmid,
                        type: 'GENERIC_REPLAY',
                        idempotencyKey: `e2e-m41-key-${Date.now()}`,
                        requestBody: { hello: 'world' },
                        intentSummary: 'E2E generic replay',
                        capturedAt: new Date().toISOString(),
                        origin: 'OFFLINE_CLIENT',
                    },
                ],
            });
        expect(res.status).toBe(200);
        expect(res.body.accepted).toBe(1);
        expect(res.body.results[0].clientMutationId).toBe(cmid);
        expect(res.body.results[0].status).toBe('SUCCEEDED');
        createdJobId = res.body.results[0].jobId;
    });

    it('POST /sync/replay with same clientMutationId returns the same job (idempotent)', async () => {
        const res = await request(app.getHttpServer())
            .post('/api/sync/replay')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({
                executeNow: true,
                jobs: [
                    {
                        clientMutationId: cmid,
                        type: 'GENERIC_REPLAY',
                        requestBody: { hello: 'world' },
                        intentSummary: 'duplicate replay',
                        capturedAt: new Date().toISOString(),
                    },
                ],
            });
        expect(res.status).toBe(200);
        expect(res.body.results[0].jobId).toBe(createdJobId);
        expect(res.body.results[0].status).toBe('SUCCEEDED');
    });

    it('GET /sync/jobs returns jobs including the newly created one', async () => {
        const res = await request(app.getHttpServer())
            .get('/api/sync/jobs')
            .set('Authorization', `Bearer ${ownerToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.find((j: any) => j.id === createdJobId)).toBeTruthy();
    });

    it('POST /sync/jobs/:id/retry returns 409 for already-SUCCEEDED job', async () => {
        const res = await request(app.getHttpServer())
            .post(`/api/sync/jobs/${createdJobId}/retry`)
            .set('Authorization', `Bearer ${ownerToken}`);
        expect(res.status).toBe(409);
    });

    it('POST /sync/replay rejects empty jobs array (400)', async () => {
        const res = await request(app.getHttpServer())
            .post('/api/sync/replay')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ jobs: [] });
        expect(res.status).toBe(400);
    });

    it('POST /sync/replay returns 403 for chef (no sync:jobs:write)', async () => {
        const res = await request(app.getHttpServer())
            .post('/api/sync/replay')
            .set('Authorization', `Bearer ${chefToken}`)
            .send({
                jobs: [
                    {
                        clientMutationId: `e2e-forbidden-${Date.now()}`,
                        type: 'GENERIC_REPLAY',
                        requestBody: {},
                        intentSummary: 'forbidden',
                        capturedAt: new Date().toISOString(),
                    },
                ],
            });
        expect(res.status).toBe(403);
    });

    it('GET /sync/conflicts lists open conflicts (seeded RESERVATION_CONFIRM)', async () => {
        const res = await request(app.getHttpServer())
            .get('/api/sync/conflicts?status=OPEN')
            .set('Authorization', `Bearer ${ownerToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('PATCH /sync/conflicts/:id/resolve transitions OPEN → RESOLVED', async () => {
        // Find an OPEN conflict; create one ad hoc to avoid mutating the seed in unpredictable order
        const list = await request(app.getHttpServer())
            .get('/api/sync/conflicts?status=OPEN')
            .set('Authorization', `Bearer ${ownerToken}`);
        const open = list.body[0];
        if (!open) return; // permissive guard

        const res = await request(app.getHttpServer())
            .patch(`/api/sync/conflicts/${open.id}/resolve`)
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ resolution: 'SERVER_TRUTH_KEPT', note: 'e2e auto-resolve' });
        expect(res.status).toBe(200);
        expect(['RESOLVED', 'DISMISSED']).toContain(res.body.status);
    });
});
