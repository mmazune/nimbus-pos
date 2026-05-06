import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomBytes } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * BG5 — Device / Printer / Terminal Registry (e2e).
 *
 * Covers the ten endpoints under /api/devices/*:
 *   - POST   /activate
 *   - POST   /kds/register
 *   - POST   /printers/routes
 *   - GET    /printers/routes
 *   - POST   /terminals/pair
 *   - PATCH  /terminals/:id/unpair
 *   - GET    /
 *   - GET    /:id
 *   - GET    /:id/history
 *   - PATCH  /:id/status
 *
 * Plus permission denial (Chef → 403), validation failures, conflicts
 * (duplicate names, RETIRED transitions, wrong device types), and
 * idempotency replay against the BG3 reliability facade.
 *
 * Requires `pnpm db:seed` to have applied the BG5 grants to
 * Owner / Manager (full) and Cashier / Waiter (read only). Chef intentionally
 * denied.
 */
describe('BG5 Device / Printer / Terminal Registry (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;

    let ownerToken: string;
    let chefToken: string;
    let ownerUserId: string;
    let orgId: string;
    let branchId: string;

    const createdDeviceIds: string[] = [];
    const createdRouteIds: string[] = [];

    const idemKey = (label: string) =>
        `bg5-${label}-${randomBytes(8).toString('hex')}`;
    const tag = () => randomBytes(4).toString('hex').toUpperCase();

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
        if (createdRouteIds.length) {
            await prisma.printerRoute
                .deleteMany({ where: { id: { in: createdRouteIds } } })
                .catch(() => undefined);
        }
        if (createdDeviceIds.length) {
            // Also clean up routes referencing those devices.
            await prisma.printerRoute
                .deleteMany({ where: { printerId: { in: createdDeviceIds } } })
                .catch(() => undefined);
            await prisma.auditLog
                .deleteMany({
                    where: { entityType: 'device', entityId: { in: createdDeviceIds } },
                })
                .catch(() => undefined);
            // Unpair anything pairing into our devices first to avoid FK issues.
            await prisma.device
                .updateMany({
                    where: { pairedToDeviceId: { in: createdDeviceIds } },
                    data: { pairedToDeviceId: null },
                })
                .catch(() => undefined);
            await prisma.device
                .deleteMany({ where: { id: { in: createdDeviceIds } } })
                .catch(() => undefined);
        }
        await app.close();
    });

    // Helper: create a device via the API and track its id for cleanup.
    async function activateDevice(opts: {
        type: 'POS_TERMINAL' | 'KDS_SCREEN' | 'PRINTER' | 'PAYMENT_TERMINAL_STUB';
        name?: string;
        station?: string;
        token?: string;
        idem?: string;
    }) {
        const body: any = {
            type: opts.type,
            name: opts.name ?? `${opts.type}-${tag()}`,
        };
        if (opts.station) body.station = opts.station;
        const req = request(app.getHttpServer())
            .post('/api/devices/activate')
            .set('Authorization', `Bearer ${opts.token ?? ownerToken}`)
            .set('X-Branch-Id', branchId);
        if (opts.idem) req.set('Idempotency-Key', opts.idem);
        const res = await req.send(body);
        if (res.status === 200 && res.body?.device?.id) {
            createdDeviceIds.push(res.body.device.id);
        }
        return res;
    }

    // ──────────────────────────────────────────────────────────────────
    // A) Device Activation
    // ──────────────────────────────────────────────────────────────────
    describe('A. POST /api/devices/activate', () => {
        it('owner can activate a POS terminal (200) and returns ACTIVE device', async () => {
            const res = await activateDevice({ type: 'POS_TERMINAL' });
            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.device.type).toBe('POS_TERMINAL');
            expect(res.body.device.status).toBe('ACTIVE');
            expect(typeof res.body.device.activationCode).toBe('string');
        });

        it('chef is denied (403)', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/devices/activate')
                .set('Authorization', `Bearer ${chefToken}`)
                .set('X-Branch-Id', branchId)
                .send({ type: 'POS_TERMINAL', name: `forbidden-${tag()}` });
            expect(res.status).toBe(403);
        });

        it('rejects invalid payload (no type) with 400', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/devices/activate')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({ name: `bad-${tag()}` });
            expect(res.status).toBe(400);
        });

        it('duplicate name in same branch returns 409 DEVICE_NAME_CONFLICT', async () => {
            const name = `dupe-${tag()}`;
            const first = await activateDevice({ type: 'POS_TERMINAL', name });
            expect(first.status).toBe(200);
            const second = await activateDevice({ type: 'POS_TERMINAL', name });
            expect(second.status).toBe(409);
            expect(second.body?.message?.code ?? second.body?.code).toBe(
                'DEVICE_NAME_CONFLICT',
            );
        });

        it('idempotent on activationCode: re-activating returns DEVICE_ALREADY_ACTIVATED', async () => {
            const code = `ACT-${tag()}-${tag()}`;
            const first = await request(app.getHttpServer())
                .post('/api/devices/activate')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({
                    type: 'PRINTER',
                    name: `idemp-${tag()}`,
                    activationCode: code,
                });
            expect(first.status).toBe(200);
            createdDeviceIds.push(first.body.device.id);
            const second = await request(app.getHttpServer())
                .post('/api/devices/activate')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({
                    type: 'PRINTER',
                    name: `idemp-other-${tag()}`,
                    activationCode: code,
                });
            expect(second.status).toBe(200);
            expect(second.body.action).toBe('DEVICE_ALREADY_ACTIVATED');
            expect(second.body.device.id).toBe(first.body.device.id);
        });
    });

    // ──────────────────────────────────────────────────────────────────
    // B) KDS Registration
    // ──────────────────────────────────────────────────────────────────
    describe('B. POST /api/devices/kds/register', () => {
        it('owner registers a KDS device (200) → KDS_DEVICE_REGISTERED audit emitted', async () => {
            const name = `kds-${tag()}`;
            const res = await request(app.getHttpServer())
                .post('/api/devices/kds/register')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({ name, station: 'KITCHEN' });
            expect(res.status).toBe(200);
            expect(res.body.action).toBe('KDS_DEVICE_REGISTERED');
            expect(res.body.device.type).toBe('KDS_SCREEN');
            createdDeviceIds.push(res.body.device.id);

            const audit = await prisma.auditLog.findFirst({
                where: {
                    entityType: 'device',
                    entityId: res.body.device.id,
                    action: 'KDS_DEVICE_REGISTERED',
                },
            });
            expect(audit).toBeTruthy();
        });

        it('chef is denied (403)', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/devices/kds/register')
                .set('Authorization', `Bearer ${chefToken}`)
                .set('X-Branch-Id', branchId)
                .send({ name: `kds-forbidden-${tag()}`, station: 'KITCHEN' });
            expect(res.status).toBe(403);
        });
    });

    // ──────────────────────────────────────────────────────────────────
    // C) Printer Routes
    // ──────────────────────────────────────────────────────────────────
    describe('C. /api/devices/printers/routes', () => {
        let printerId: string;

        beforeAll(async () => {
            const res = await activateDevice({
                type: 'PRINTER',
                name: `printer-routes-${tag()}`,
                station: 'BAR',
            });
            expect(res.status).toBe(200);
            printerId = res.body.device.id;
        });

        it('rejects routing a non-PRINTER device with 400', async () => {
            const pos = await activateDevice({ type: 'POS_TERMINAL' });
            expect(pos.status).toBe(200);
            const res = await request(app.getHttpServer())
                .post('/api/devices/printers/routes')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({
                    printerId: pos.body.device.id,
                    routeType: 'RECEIPT',
                });
            expect(res.status).toBe(400);
            expect(res.body?.message?.code ?? res.body?.code).toBe('DEVICE_NOT_PRINTER');
        });

        it('owner upserts a BAR route (200, action=PRINTER_ROUTE_CONFIGURED)', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/devices/printers/routes')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({
                    printerId,
                    routeType: 'BAR',
                    station: 'BAR',
                    enabled: true,
                    priority: 50,
                });
            expect(res.status).toBe(200);
            expect(res.body.action).toBe('PRINTER_ROUTE_CONFIGURED');
            expect(res.body.route.routeType).toBe('BAR');
            createdRouteIds.push(res.body.route.id);
        });

        it('upsert again with enabled=false → action=PRINTER_ROUTE_DISABLED, same id', async () => {
            const first = await request(app.getHttpServer())
                .post('/api/devices/printers/routes')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({
                    printerId,
                    routeType: 'KITCHEN',
                    station: 'KITCHEN',
                    enabled: true,
                });
            expect(first.status).toBe(200);
            createdRouteIds.push(first.body.route.id);

            const second = await request(app.getHttpServer())
                .post('/api/devices/printers/routes')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({
                    printerId,
                    routeType: 'KITCHEN',
                    station: 'KITCHEN',
                    enabled: false,
                });
            expect(second.status).toBe(200);
            expect(second.body.action).toBe('PRINTER_ROUTE_DISABLED');
            expect(second.body.route.id).toBe(first.body.route.id);
            expect(second.body.route.enabled).toBe(false);
        });

        it('GET /printers/routes lists routes for branch', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/devices/printers/routes')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .query({ printerId });
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        });

        it('chef is denied on POST /printers/routes (403)', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/devices/printers/routes')
                .set('Authorization', `Bearer ${chefToken}`)
                .set('X-Branch-Id', branchId)
                .send({ printerId, routeType: 'RECEIPT' });
            expect(res.status).toBe(403);
        });
    });

    // ──────────────────────────────────────────────────────────────────
    // D) Terminal Pairing (STUB)
    // ──────────────────────────────────────────────────────────────────
    describe('D. /api/devices/terminals/...', () => {
        let terminalId: string;
        let posId: string;

        beforeAll(async () => {
            const term = await activateDevice({ type: 'PAYMENT_TERMINAL_STUB' });
            const pos = await activateDevice({ type: 'POS_TERMINAL' });
            expect(term.status).toBe(200);
            expect(pos.status).toBe(200);
            terminalId = term.body.device.id;
            posId = pos.body.device.id;
        });

        it('owner pairs terminal → POS (mode:STUB)', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/devices/terminals/pair')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({
                    terminalDeviceId: terminalId,
                    pairedToDeviceId: posId,
                    provider: 'mock-acquirer',
                });
            expect(res.status).toBe(200);
            expect(res.body.mode).toBe('STUB');
            expect(res.body.terminal.pairedToDeviceId).toBe(posId);
        });

        it('rejects pairing if terminal is wrong type (400)', async () => {
            const otherPos = await activateDevice({ type: 'POS_TERMINAL' });
            const res = await request(app.getHttpServer())
                .post('/api/devices/terminals/pair')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({
                    terminalDeviceId: otherPos.body.device.id,
                    pairedToDeviceId: posId,
                });
            expect(res.status).toBe(400);
            expect(res.body?.message?.code ?? res.body?.code).toBe(
                'DEVICE_NOT_PAYMENT_TERMINAL',
            );
        });

        it('PATCH unpair returns mode:STUB, sets pairedToDeviceId=null', async () => {
            const res = await request(app.getHttpServer())
                .patch(`/api/devices/terminals/${terminalId}/unpair`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({ reason: 'test cleanup' });
            expect(res.status).toBe(200);
            expect(res.body.mode).toBe('STUB');
            expect(res.body.terminal.pairedToDeviceId).toBeNull();
        });

        it('PATCH unpair on already-unpaired is idempotent (TERMINAL_NOT_PAIRED)', async () => {
            const res = await request(app.getHttpServer())
                .patch(`/api/devices/terminals/${terminalId}/unpair`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({});
            expect(res.status).toBe(200);
            expect(res.body.action).toBe('TERMINAL_NOT_PAIRED');
        });

        it('chef is denied on POST /terminals/pair (403)', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/devices/terminals/pair')
                .set('Authorization', `Bearer ${chefToken}`)
                .set('X-Branch-Id', branchId)
                .send({ terminalDeviceId: terminalId, pairedToDeviceId: posId });
            expect(res.status).toBe(403);
        });
    });

    // ──────────────────────────────────────────────────────────────────
    // E) List / Detail / History / Status
    // ──────────────────────────────────────────────────────────────────
    describe('E. List / Detail / History / Status', () => {
        let deviceId: string;

        beforeAll(async () => {
            const res = await activateDevice({
                type: 'POS_TERMINAL',
                name: `list-detail-${tag()}`,
            });
            expect(res.status).toBe(200);
            deviceId = res.body.device.id;
        });

        it('GET /api/devices returns paginated list', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/devices')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId);
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(typeof res.body.total).toBe('number');
        });

        it('GET /api/devices?type=POS_TERMINAL filters', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/devices')
                .query({ type: 'POS_TERMINAL' })
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId);
            expect(res.status).toBe(200);
            for (const d of res.body.data) {
                expect(d.type).toBe('POS_TERMINAL');
            }
        });

        it('GET /api/devices/:id returns detail (with empty routes for non-PRINTER)', async () => {
            const res = await request(app.getHttpServer())
                .get(`/api/devices/${deviceId}`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId);
            expect(res.status).toBe(200);
            expect(res.body.id).toBe(deviceId);
            expect(Array.isArray(res.body.routes)).toBe(true);
        });

        it('GET /api/devices/:id 404s for unknown id', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/devices/00000000-0000-0000-0000-000000000000')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId);
            expect(res.status).toBe(404);
        });

        it('PATCH /:id/status changes ACTIVE → INACTIVE and emits audit', async () => {
            const res = await request(app.getHttpServer())
                .patch(`/api/devices/${deviceId}/status`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({ status: 'INACTIVE', reason: 'unit test' });
            expect(res.status).toBe(200);
            expect(res.body.action).toBe('DEVICE_STATUS_CHANGED');
            expect(res.body.device.status).toBe('INACTIVE');
        });

        it('PATCH /:id/status with same status is a no-op (DEVICE_STATUS_UNCHANGED)', async () => {
            const res = await request(app.getHttpServer())
                .patch(`/api/devices/${deviceId}/status`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({ status: 'INACTIVE' });
            expect(res.status).toBe(200);
            expect(res.body.action).toBe('DEVICE_STATUS_UNCHANGED');
        });

        it('GET /:id/history returns at least the activation + status-change events', async () => {
            const res = await request(app.getHttpServer())
                .get(`/api/devices/${deviceId}/history`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId);
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.total).toBeGreaterThanOrEqual(2);
            const actions = res.body.data.map((r: any) => r.action);
            expect(actions).toEqual(expect.arrayContaining(['DEVICE_ACTIVATED']));
        });

        it('RETIRED → other status is rejected (400 DEVICE_STATUS_TRANSITION_INVALID)', async () => {
            const retire = await request(app.getHttpServer())
                .patch(`/api/devices/${deviceId}/status`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({ status: 'RETIRED' });
            expect(retire.status).toBe(200);
            expect(retire.body.device.status).toBe('RETIRED');

            const re = await request(app.getHttpServer())
                .patch(`/api/devices/${deviceId}/status`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .send({ status: 'ACTIVE' });
            expect(re.status).toBe(400);
            expect(re.body?.message?.code ?? re.body?.code).toBe(
                'DEVICE_STATUS_TRANSITION_INVALID',
            );
        });

        it('chef is denied on PATCH /:id/status (403)', async () => {
            const res = await request(app.getHttpServer())
                .patch(`/api/devices/${deviceId}/status`)
                .set('Authorization', `Bearer ${chefToken}`)
                .set('X-Branch-Id', branchId)
                .send({ status: 'INACTIVE' });
            expect(res.status).toBe(403);
        });
    });

    // ──────────────────────────────────────────────────────────────────
    // F) BG3 Reliability — idempotency replay on a registry write
    // ──────────────────────────────────────────────────────────────────
    describe('F. BG3 idempotency replay (Idempotency-Key)', () => {
        it('same Idempotency-Key returns same body for repeated /activate', async () => {
            const key = idemKey('activate');
            const name = `idem-${tag()}`;
            const first = await request(app.getHttpServer())
                .post('/api/devices/activate')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .set('Idempotency-Key', key)
                .send({ type: 'POS_TERMINAL', name });
            expect(first.status).toBe(200);
            createdDeviceIds.push(first.body.device.id);

            const second = await request(app.getHttpServer())
                .post('/api/devices/activate')
                .set('Authorization', `Bearer ${ownerToken}`)
                .set('X-Branch-Id', branchId)
                .set('Idempotency-Key', key)
                .send({ type: 'POS_TERMINAL', name });
            expect(second.status).toBe(200);
            expect(second.body.device.id).toBe(first.body.device.id);
        });
    });
});
