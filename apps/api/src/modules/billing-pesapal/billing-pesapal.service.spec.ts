import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
    BadRequestException,
    NotFoundException,
    InternalServerErrorException,
} from '@nestjs/common';
import { BillingPesapalService } from './billing-pesapal.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

// ── Helpers ──
const ORG = 'org-1';
const USER = 'user-1';

const PLAN = {
    id: 'plan-solo',
    code: 'solo',
    name: 'Solo',
    status: 'ACTIVE',
    priceMonthly: { toNumber: () => 80 },
    priceAnnual: { toNumber: () => 864 },
};

function makePrisma() {
    return {
        membership: { findFirst: jest.fn() },
        plan: { findUnique: jest.fn() },
        pesapalTransaction: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            updateMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
        pesapalIpnLog: { create: jest.fn() },
        subscription: {
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
        onboardingProgress: {
            updateMany: jest.fn(),
        },
    };
}

function makeConfig(overrides: Record<string, string> = {}) {
    const defaults: Record<string, string> = {
        PESAPAL_CONSUMER_KEY: 'test-key',
        PESAPAL_CONSUMER_SECRET: 'test-secret',
        PESAPAL_BASE_URL: 'https://pay.pesapal.com/v3',
        PESAPAL_IPN_CALLBACK_URL: 'https://example.com/ipn',
        PESAPAL_REDIRECT_URL: 'https://example.com/callback',
    };
    const merged = { ...defaults, ...overrides };
    return { get: jest.fn((key: string, fallback = '') => merged[key] ?? fallback) };
}

// Mock global fetch
const mockFetch = jest.fn();
(globalThis as any).fetch = mockFetch;

describe('BillingPesapalService', () => {
    let service: BillingPesapalService;
    let prisma: ReturnType<typeof makePrisma>;
    let audit: { log: jest.Mock };

    beforeEach(async () => {
        prisma = makePrisma();
        audit = { log: jest.fn() };
        mockFetch.mockReset();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BillingPesapalService,
                { provide: PrismaService, useValue: prisma },
                { provide: AuditService, useValue: audit },
                { provide: ConfigService, useValue: makeConfig() },
            ],
        }).compile();

        service = module.get(BillingPesapalService);
    });

    // ── Org context ──
    describe('resolveOrgContext', () => {
        it('returns organizationId from active membership', async () => {
            prisma.membership.findFirst.mockResolvedValue({ organizationId: ORG });
            const ctx = await service.resolveOrgContext(USER);
            expect(ctx.organizationId).toBe(ORG);
        });

        it('throws BadRequestException if no membership', async () => {
            prisma.membership.findFirst.mockResolvedValue(null);
            await expect(service.resolveOrgContext(USER)).rejects.toThrow(BadRequestException);
        });
    });

    // ── Checkout session ──
    describe('createCheckoutSession', () => {
        const dto = { planCode: 'solo', billingCycle: 'MONTHLY' as const };

        beforeEach(() => {
            prisma.plan.findUnique.mockResolvedValue(PLAN);
            prisma.pesapalTransaction.findFirst.mockResolvedValue(null);
            prisma.subscription.findUnique.mockResolvedValue(null);
            prisma.pesapalTransaction.create.mockResolvedValue({ id: 'txn-1' });
            prisma.subscription.create.mockResolvedValue({ id: 'sub-1' });

            // PesaPal auth
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ token: 'tok-123', expiryDate: '2099-01-01' }),
            });
            // IPN registration
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ ipn_id: 'ipn-1' }),
            });
            // Submit order
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    order_tracking_id: 'ot-1',
                    merchant_reference: 'NIM-test',
                    redirect_url: 'https://pay.pesapal.com/checkout/ot-1',
                }),
            });
        });

        it('creates checkout session with MONTHLY pricing', async () => {
            const result = await service.createCheckoutSession(ORG, dto, USER);
            expect(result.redirectUrl).toBeDefined();
            expect(result.amount).toBe('80');
            expect(result.currency).toBe('USD');
            expect(result.plan.code).toBe('solo');
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'SAAS_CHECKOUT_SESSION_CREATED' }),
            );
        });

        it('creates checkout session with ANNUAL pricing (10% discount)', async () => {
            const result = await service.createCheckoutSession(
                ORG,
                { planCode: 'solo', billingCycle: 'ANNUAL' },
                USER,
            );
            expect(result.amount).toBe('864');
        });

        it('creates PENDING_PAYMENT subscription if none exists', async () => {
            await service.createCheckoutSession(ORG, dto, USER);
            expect(prisma.subscription.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ status: 'PENDING_PAYMENT', orgId: ORG }),
                }),
            );
        });

        it('throws BadRequestException for invalid plan', async () => {
            prisma.plan.findUnique.mockResolvedValue(null);
            await expect(service.createCheckoutSession(ORG, dto, USER)).rejects.toThrow(
                BadRequestException,
            );
        });

        it('throws BadRequestException for invalid billing cycle', async () => {
            await expect(
                service.createCheckoutSession(ORG, { planCode: 'solo', billingCycle: 'WEEKLY' as any }, USER),
            ).rejects.toThrow(BadRequestException);
        });

        it('auto-cancels prior INITIATED transaction and creates a new one', async () => {
            prisma.pesapalTransaction.findFirst.mockResolvedValue({
                orderTrackingId: 'existing-ot',
            });
            const result = await service.createCheckoutSession(ORG, dto, USER);
            expect(prisma.pesapalTransaction.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { orgId: ORG, status: 'INITIATED' },
                    data: { status: 'CANCELLED' },
                }),
            );
            expect(result.redirectUrl).toBeDefined();
        });
    });

    // ── Callback ──
    describe('handleCallback', () => {
        it('marks transaction as REDIRECTED', async () => {
            prisma.pesapalTransaction.findUnique.mockResolvedValue({ id: 'txn-1' });
            prisma.pesapalTransaction.update.mockResolvedValue({ id: 'txn-1', status: 'REDIRECTED' });

            const result = await service.handleCallback('ot-1', 'pp-txn-1');
            expect(result.status).toBe('REDIRECTED');
            expect(prisma.pesapalTransaction.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ pesapalTxnId: 'pp-txn-1', status: 'REDIRECTED' }),
                }),
            );
        });

        it('throws NotFoundException for unknown order', async () => {
            prisma.pesapalTransaction.findUnique.mockResolvedValue(null);
            await expect(service.handleCallback('bad-ot', 'pp-txn-1')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    // ── IPN ──
    describe('handleIpn', () => {
        it('logs IPN and reconciles status', async () => {
            const txn = { id: 'txn-1', orgId: ORG, status: 'INITIATED' };
            prisma.pesapalIpnLog.create.mockResolvedValue({});
            prisma.pesapalTransaction.findUnique.mockResolvedValue(txn);
            prisma.pesapalTransaction.update.mockResolvedValue({});
            prisma.subscription.findUnique.mockResolvedValue({
                id: 'sub-1', status: 'PENDING_PAYMENT', billingCycle: 'MONTHLY',
            });
            prisma.subscription.update.mockResolvedValue({});
            prisma.onboardingProgress.updateMany.mockResolvedValue({});

            // Auth token (cached)
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ token: 'tok-123', expiryDate: '2099-01-01' }),
            });
            // GetTransactionStatus
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    payment_status_description: 'Completed',
                    payment_method: 'MPESA',
                    payment_account: '+254...',
                    amount: 80,
                    created_date: '2025-01-01',
                    confirmation_code: 'CF123',
                    description: 'Test',
                }),
            });

            const result = await service.handleIpn({
                OrderTrackingId: 'ot-1',
                OrderNotificationType: 'PAYMENT',
                OrderMerchantReference: 'NIM-test',
            });

            expect(result.status).toBe('PROCESSED');
            expect(prisma.pesapalIpnLog.create).toHaveBeenCalled();
        });

        it('returns IGNORED for missing OrderTrackingId', async () => {
            prisma.pesapalIpnLog.create.mockResolvedValue({});
            const result = await service.handleIpn({});
            expect(result.status).toBe('IGNORED');
        });
    });

    // ── Reconcile ──
    describe('reconcileTransactionStatus', () => {
        const txn = { id: 'txn-1', orgId: ORG, status: 'INITIATED' };

        beforeEach(() => {
            prisma.pesapalTransaction.findUnique.mockResolvedValue(txn);
            // Auth
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ token: 'tok-abc', expiryDate: '2099-01-01' }),
            });
        });

        it('activates subscription on COMPLETED', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    payment_status_description: 'Completed',
                    payment_method: 'VISA',
                    payment_account: '****1234',
                    amount: 80,
                    created_date: '2025-01-01',
                    confirmation_code: 'CF456',
                    description: 'Test',
                }),
            });
            prisma.subscription.findUnique.mockResolvedValue({
                id: 'sub-1', status: 'PENDING_PAYMENT', billingCycle: 'MONTHLY',
            });
            prisma.subscription.update.mockResolvedValue({});
            prisma.pesapalTransaction.update.mockResolvedValue({});
            prisma.onboardingProgress.updateMany.mockResolvedValue({});

            const result = await service.reconcileTransactionStatus('ot-1');
            expect(result.status).toBe('COMPLETED');
            expect(prisma.subscription.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ status: 'ACTIVE' }),
                }),
            );
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'SAAS_PAYMENT_CONFIRMED' }),
            );
        });

        it('marks FAILED and audits', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    payment_status_description: 'Failed',
                    payment_method: null,
                    payment_account: null,
                    amount: 80,
                    created_date: '2025-01-01',
                    confirmation_code: '',
                    description: '',
                }),
            });
            prisma.pesapalTransaction.update.mockResolvedValue({});

            const result = await service.reconcileTransactionStatus('ot-1');
            expect(result.status).toBe('FAILED');
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'SAAS_PAYMENT_FAILED' }),
            );
        });

        it('does not activate subscription without COMPLETED', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    payment_status_description: 'Pending',
                    payment_method: null,
                    payment_account: null,
                    amount: 80,
                    created_date: '2025-01-01',
                    confirmation_code: '',
                    description: '',
                }),
            });
            prisma.pesapalTransaction.update.mockResolvedValue({});

            const result = await service.reconcileTransactionStatus('ot-1');
            expect(result.status).toBe('INITIATED');
            expect(prisma.subscription.update).not.toHaveBeenCalled();
        });

        it('throws NotFoundException for unknown transaction', async () => {
            prisma.pesapalTransaction.findUnique.mockResolvedValue(null);
            await expect(service.reconcileTransactionStatus('bad-ot')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    // ── Manual reconcile ──
    describe('reconcileStatus', () => {
        it('delegates to reconcileTransactionStatus and audits', async () => {
            const txn = { id: 'txn-1', orgId: ORG, status: 'INITIATED' };
            prisma.pesapalTransaction.findUnique.mockResolvedValue(txn);
            prisma.pesapalTransaction.update.mockResolvedValue({});

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ token: 'tok', expiryDate: '2099-01-01' }),
            });
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    payment_status_description: 'Completed',
                    payment_method: 'MPESA',
                    payment_account: '+254...',
                    amount: 80,
                    created_date: '2025-01-01',
                    confirmation_code: 'CF789',
                    description: '',
                }),
            });
            prisma.subscription.findUnique.mockResolvedValue({
                id: 'sub-1', status: 'PENDING_PAYMENT', billingCycle: 'MONTHLY',
            });
            prisma.subscription.update.mockResolvedValue({});
            prisma.onboardingProgress.updateMany.mockResolvedValue({});

            const result = await service.reconcileStatus({ orderTrackingId: 'ot-1' }, USER);
            expect(result.status).toBe('COMPLETED');
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'SAAS_PAYMENT_RECONCILED' }),
            );
        });
    });

    // ── Auth failure ──
    describe('authenticate', () => {
        it('throws InternalServerErrorException when credentials missing', async () => {
            const module = await Test.createTestingModule({
                providers: [
                    BillingPesapalService,
                    { provide: PrismaService, useValue: prisma },
                    { provide: AuditService, useValue: audit },
                    {
                        provide: ConfigService,
                        useValue: makeConfig({
                            PESAPAL_CONSUMER_KEY: '',
                            PESAPAL_CONSUMER_SECRET: '',
                        }),
                    },
                ],
            }).compile();

            const svc = module.get(BillingPesapalService);
            prisma.plan.findUnique.mockResolvedValue(PLAN);
            prisma.pesapalTransaction.findFirst.mockResolvedValue(null);

            await expect(
                svc.createCheckoutSession(ORG, { planCode: 'solo', billingCycle: 'MONTHLY' }, USER),
            ).rejects.toThrow(InternalServerErrorException);
        });
    });
});
