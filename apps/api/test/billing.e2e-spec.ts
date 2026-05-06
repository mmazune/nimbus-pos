import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

describe('Billing + Subscription + Dev Portal (M39) – E2E', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let ownerToken: string;
    let chefToken: string;
    let orgId: string;

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

        // Auth tokens
        const ownerRes = await request(app.getHttpServer())
            .post('/api/auth/login')
            .send({ email: 'owner@demo.local', password: 'Owner#123' });
        ownerToken = ownerRes.body.accessToken;

        const chefRes = await request(app.getHttpServer())
            .post('/api/auth/login')
            .send({ email: 'chef@demo.local', password: 'Chef#123' });
        chefToken = chefRes.body.accessToken;

        // Resolve org
        const owner = await prisma.user.findFirst({ where: { email: 'owner@demo.local' } });
        const membership = await prisma.membership.findFirst({
            where: { userId: owner!.id, status: 'ACTIVE' },
        });
        orgId = membership!.organizationId;
    }, 60000);

    afterAll(async () => {
        await app.close();
    }, 30000);

    // ═══════════════════════════════════════
    // Billing Overview
    // ═══════════════════════════════════════

    describe('GET /api/billing', () => {
        it('401 — no auth', async () => {
            await request(app.getHttpServer()).get('/api/billing').expect(401);
        });

        it('200 — owner sees billing overview', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/billing')
                .set('Authorization', `Bearer ${ownerToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('subscription');
            expect(res.body).toHaveProperty('plan');
        });
    });

    // ═══════════════════════════════════════
    // Plans Catalog
    // ═══════════════════════════════════════

    describe('GET /api/billing/plans', () => {
        it('200 — lists active plans', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/billing/plans')
                .set('Authorization', `Bearer ${ownerToken}`)
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThanOrEqual(1);
            expect(res.body[0]).toHaveProperty('code');
        });
    });

    // ═══════════════════════════════════════
    // Subscription Update
    // ═══════════════════════════════════════

    describe('PATCH /api/billing/subscription', () => {
        it('401 — no auth', async () => {
            await request(app.getHttpServer())
                .patch('/api/billing/subscription')
                .send({ billingCycle: 'ANNUAL' })
                .expect(401);
        });

        it('200 — update billing cycle', async () => {
            const res = await request(app.getHttpServer())
                .patch('/api/billing/subscription')
                .set('Authorization', `Bearer ${ownerToken}`)
                .send({ billingCycle: 'ANNUAL' })
                .expect(200);

            expect(res.body.billingCycle).toBe('ANNUAL');

            // Restore
            await request(app.getHttpServer())
                .patch('/api/billing/subscription')
                .set('Authorization', `Bearer ${ownerToken}`)
                .send({ billingCycle: 'MONTHLY' })
                .expect(200);
        });
    });

    // ═══════════════════════════════════════
    // API Keys
    // ═══════════════════════════════════════

    let testKeyId: string;

    describe('POST /api/dev/api-keys', () => {
        it('401 — no auth', async () => {
            await request(app.getHttpServer())
                .post('/api/dev/api-keys')
                .send({ name: 'Test Key' })
                .expect(401);
        });

        it('201 — creates API key and returns plaintext', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/dev/api-keys')
                .set('Authorization', `Bearer ${ownerToken}`)
                .send({ name: 'E2E Test Key', scopes: ['orders:read'] })
                .expect(201);

            expect(res.body).toHaveProperty('key');
            expect(res.body.key.length).toBe(64);
            expect(res.body.keyPrefix).toMatch(/^nk_/);
            expect(res.body.name).toBe('E2E Test Key');
            testKeyId = res.body.id;
        });
    });

    describe('GET /api/dev/api-keys', () => {
        it('200 — lists API keys', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/dev/api-keys')
                .set('Authorization', `Bearer ${ownerToken}`)
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThanOrEqual(1);
            // Should NOT include the raw key
            expect(res.body[0]).not.toHaveProperty('key');
            expect(res.body[0]).not.toHaveProperty('keyHash');
        });
    });

    describe('POST /api/dev/api-keys/:id/revoke', () => {
        it('200 — revokes API key', async () => {
            const res = await request(app.getHttpServer())
                .post(`/api/dev/api-keys/${testKeyId}/revoke`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .expect(200);

            expect(res.body.status).toBe('REVOKED');
            expect(res.body.revokedAt).toBeDefined();
        });

        it('409 — cannot revoke already-revoked key', async () => {
            await request(app.getHttpServer())
                .post(`/api/dev/api-keys/${testKeyId}/revoke`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .expect(409);
        });
    });

    // ═══════════════════════════════════════
    // Webhooks
    // ═══════════════════════════════════════

    let testWebhookId: string;

    describe('POST /api/dev/webhooks', () => {
        it('201 — creates webhook with signing secret', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/dev/webhooks')
                .set('Authorization', `Bearer ${ownerToken}`)
                .send({
                    url: 'https://e2e-test.example.com/hook',
                    description: 'E2E test webhook',
                    events: ['ORDER_CREATED'],
                })
                .expect(201);

            expect(res.body.signingSecret).toMatch(/^whsec_/);
            expect(res.body.events).toContain('ORDER_CREATED');
            testWebhookId = res.body.id;
        });

        it('400 — rejects non-HTTPS URL', async () => {
            await request(app.getHttpServer())
                .post('/api/dev/webhooks')
                .set('Authorization', `Bearer ${ownerToken}`)
                .send({
                    url: 'http://insecure.example.com/hook',
                    events: ['ORDER_CREATED'],
                })
                .expect(400);
        });
    });

    describe('GET /api/dev/webhooks', () => {
        it('200 — lists webhooks', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/dev/webhooks')
                .set('Authorization', `Bearer ${ownerToken}`)
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThanOrEqual(1);
            // Should NOT include signing secret in listing
            expect(res.body[0]).not.toHaveProperty('signingSecret');
        });
    });

    describe('PATCH /api/dev/webhooks/:id', () => {
        it('200 — updates webhook status', async () => {
            const res = await request(app.getHttpServer())
                .patch(`/api/dev/webhooks/${testWebhookId}`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .send({ status: 'INACTIVE' })
                .expect(200);

            expect(res.body.status).toBe('INACTIVE');
        });
    });

    // ═══════════════════════════════════════
    // Usage
    // ═══════════════════════════════════════

    describe('GET /api/dev/usage', () => {
        it('200 — returns usage with plan limits', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/dev/usage')
                .set('Authorization', `Bearer ${ownerToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('currentState');
            expect(res.body.currentState).toHaveProperty('branches');
            expect(res.body.currentState.branches).toHaveProperty('current');
            expect(res.body.currentState.branches).toHaveProperty('limit');
        });
    });

    // ═══════════════════════════════════════
    // Support Sessions
    // ═══════════════════════════════════════

    let testSessionId: string;

    describe('POST /api/support/sessions', () => {
        it('201 — opens support session', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/support/sessions')
                .set('Authorization', `Bearer ${ownerToken}`)
                .send({ reason: 'E2E test support request' })
                .expect(201);

            expect(res.body.status).toBe('OPEN');
            expect(res.body.reason).toBe('E2E test support request');
            testSessionId = res.body.id;
        });
    });

    describe('GET /api/support/sessions', () => {
        it('200 — lists support sessions', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/support/sessions')
                .set('Authorization', `Bearer ${ownerToken}`)
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('PATCH /api/support/sessions/:id/close', () => {
        it('200 — closes support session', async () => {
            const res = await request(app.getHttpServer())
                .patch(`/api/support/sessions/${testSessionId}/close`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .send({ closedReason: 'Resolved' })
                .expect(200);

            expect(res.body.status).toBe('CLOSED');
        });

        it('409 — cannot close already-closed session', async () => {
            await request(app.getHttpServer())
                .patch(`/api/support/sessions/${testSessionId}/close`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .send({ closedReason: 'Again' })
                .expect(409);
        });
    });

    // ═══════════════════════════════════════
    // Dev Admins
    // ═══════════════════════════════════════

    describe('GET /api/dev/admins', () => {
        it('200 — lists dev admins', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/dev/admins')
                .set('Authorization', `Bearer ${ownerToken}`)
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    // ═══════════════════════════════════════
    // Permission denial
    // ═══════════════════════════════════════

    describe('Permission checks', () => {
        it('403 — chef cannot access billing overview', async () => {
            await request(app.getHttpServer())
                .get('/api/billing')
                .set('Authorization', `Bearer ${chefToken}`)
                .expect(403);
        });

        it('403 — chef cannot create API keys', async () => {
            await request(app.getHttpServer())
                .post('/api/dev/api-keys')
                .set('Authorization', `Bearer ${chefToken}`)
                .send({ name: 'Unauthorized Key' })
                .expect(403);
        });
    });
});
