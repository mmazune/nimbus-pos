import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * M40 — Alerts + Digests + Real-Time Owner Views — e2e
 *
 * Requires seeded DB with M40 permissions, alert channels, alert rules,
 * and at least one DigestSchedule (see seed.ts seedAlertsData).
 */
describe('M40 Alerts + Digests + Owner Live (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let ownerToken: string;
    let chefToken: string;
    let createdRuleCode: string;

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
        if (createdRuleCode) {
            await prisma.alertRule
                .deleteMany({ where: { code: createdRuleCode } })
                .catch(() => undefined);
        }
        await app.close();
    });

    // ── Happy path: GET /alerts ──
    it('GET /alerts returns rules, channels, and recent deliveries', async () => {
        const res = await request(app.getHttpServer())
            .get('/api/alerts')
            .set('Authorization', `Bearer ${ownerToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.rules)).toBe(true);
        expect(Array.isArray(res.body.channels)).toBe(true);
        expect(Array.isArray(res.body.recentDeliveries)).toBe(true);
        expect(res.body.rules.length).toBeGreaterThan(0);
        expect(res.body.channels.length).toBeGreaterThan(0);
    });

    // ── Happy path: POST /alerts/rules ──
    it('POST /alerts/rules creates an alert rule with audit', async () => {
        createdRuleCode = `e2e-rule-${Date.now()}`;
        const res = await request(app.getHttpServer())
            .post('/api/alerts/rules')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({
                code: createdRuleCode,
                name: 'E2E low-stock rule',
                type: 'LOW_STOCK',
                severity: 'WARNING',
                channelCodes: ['email-owner'],
            });
        expect(res.status).toBe(201);
        expect(res.body.code).toBe(createdRuleCode);
        expect(res.body.type).toBe('LOW_STOCK');
        expect(res.body.status).toBe('ACTIVE');
    });

    // ── Validation failure: bad type ──
    it('POST /alerts/rules rejects an invalid type', async () => {
        const res = await request(app.getHttpServer())
            .post('/api/alerts/rules')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({
                code: `e2e-bad-${Date.now()}`,
                name: 'Bad',
                type: 'NOT_A_REAL_TYPE',
                channelCodes: ['email-owner'],
            });
        expect(res.status).toBe(400);
    });

    // ── Permission denial ──
    it('POST /alerts/rules returns 403 for chef (no alerts:rule:write)', async () => {
        const res = await request(app.getHttpServer())
            .post('/api/alerts/rules')
            .set('Authorization', `Bearer ${chefToken}`)
            .send({
                code: `e2e-forbidden-${Date.now()}`,
                name: 'Forbidden',
                type: 'LOW_STOCK',
                channelCodes: ['email-owner'],
            });
        expect(res.status).toBe(403);
    });

    // ── PATCH disable rule + state assertion ──
    it('PATCH /alerts/rules/:id disables a rule and disabled rules are still listed', async () => {
        const list = await request(app.getHttpServer())
            .get('/api/alerts/rules')
            .set('Authorization', `Bearer ${ownerToken}`);
        const rule = list.body.find((r: any) => r.code === createdRuleCode);
        expect(rule).toBeDefined();
        const res = await request(app.getHttpServer())
            .patch(`/api/alerts/rules/${rule.id}`)
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ status: 'DISABLED' });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('DISABLED');
    });

    let sentDeliveryId: string;

    // ── Test alert: happy path SENT ──
    it('POST /alerts/test dispatches a SENT delivery for a healthy channel', async () => {
        const res = await request(app.getHttpServer())
            .post('/api/alerts/test')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({
                channelCodes: ['email-owner'],
                severity: 'INFO',
                message: 'e2e probe',
            });
        expect(res.status).toBe(200);
        expect(res.body.count).toBeGreaterThanOrEqual(1);
        expect(res.body.deliveries[0].status).toBe('SENT');
        sentDeliveryId = res.body.deliveries[0].id;
    });

    // ── Critical fan-out to multiple channels ──
    it('POST /alerts/test fans out to multiple channels for a critical alert', async () => {
        const res = await request(app.getHttpServer())
            .post('/api/alerts/test')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({
                channelCodes: ['email-owner', 'sms-manager', 'slack-ops'],
                severity: 'CRITICAL',
                title: 'Fan-out probe',
            });
        expect(res.status).toBe(200);
        expect(res.body.count).toBe(3);
        const statuses = res.body.deliveries.map((d: any) => d.status);
        expect(statuses).toEqual(expect.arrayContaining(['SENT']));
    });

    // ── Forced failure path → RETRY_SCHEDULED ──
    it('POST /alerts/test with forceFailure persists a retryable failure', async () => {
        const res = await request(app.getHttpServer())
            .post('/api/alerts/test')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({
                channelCodes: ['slack-ops'],
                forceFailure: true,
            });
        expect(res.status).toBe(200);
        expect(res.body.deliveries[0].status).toBe('RETRY_SCHEDULED');
        expect(res.body.deliveries[0].failureReason).toBe('FORCED_TEST_FAILURE');
    });

    // ── Retry must not duplicate SENT ──
    it('POST /alerts/deliveries/:id/retry refuses to retry an already-SENT delivery', async () => {
        expect(sentDeliveryId).toBeTruthy();
        const res = await request(app.getHttpServer())
            .post(`/api/alerts/deliveries/${sentDeliveryId}/retry`)
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({});
        expect(res.status).toBe(409);
    });

    // ── Owner live feed ──
    it('GET /owner/live returns events, counts, and live aggregations', async () => {
        const res = await request(app.getHttpServer())
            .get('/api/owner/live')
            .set('Authorization', `Bearer ${ownerToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.events)).toBe(true);
        expect(res.body.counts).toBeDefined();
        expect(res.body.live).toBeDefined();
        // Locked rule: public diner payment execution alerts must NOT be advertised as live.
        expect(res.body.notes.publicDinerPaymentExecution).toMatch(/pending/i);
    });

    it('GET /owner/live denies chef without owner:live:read', async () => {
        const res = await request(app.getHttpServer())
            .get('/api/owner/live')
            .set('Authorization', `Bearer ${chefToken}`);
        expect(res.status).toBe(403);
    });

    // ── Digest schedule retrieval + run ──
    it('GET /alerts/digests returns at least the seeded daily-owner-summary', async () => {
        const res = await request(app.getHttpServer())
            .get('/api/alerts/digests')
            .set('Authorization', `Bearer ${ownerToken}`);
        expect(res.status).toBe(200);
        expect(res.body.find((d: any) => d.code === 'daily-owner-summary')).toBeTruthy();
    });

    it('POST /alerts/digests/:id/run runs an active digest and persists deliveries', async () => {
        const list = await request(app.getHttpServer())
            .get('/api/alerts/digests')
            .set('Authorization', `Bearer ${ownerToken}`);
        const digest = list.body.find((d: any) => d.code === 'daily-owner-summary');
        expect(digest).toBeTruthy();
        const res = await request(app.getHttpServer())
            .post(`/api/alerts/digests/${digest.id}/run`)
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({});
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.deliveries)).toBe(true);
        expect(res.body.deliveries.length).toBeGreaterThan(0);
    });
});
