import { Test, TestingModule } from '@nestjs/testing';
import {
    BadRequestException,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { MerchantPaymentsService } from './merchant-payments.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

const ORG = 'org-1';
const USER = 'user-1';

function makePrisma() {
    return {
        membership: { findFirst: jest.fn() },
        merchantPaymentConfig: {
            findUnique: jest.fn(),
            upsert: jest.fn(),
            update: jest.fn(),
        },
    };
}

describe('MerchantPaymentsService (readiness model — not live PesaPal)', () => {
    let service: MerchantPaymentsService;
    let prisma: ReturnType<typeof makePrisma>;
    let audit: { log: jest.Mock };

    beforeEach(async () => {
        prisma = makePrisma();
        audit = { log: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MerchantPaymentsService,
                { provide: PrismaService, useValue: prisma },
                { provide: AuditService, useValue: audit },
            ],
        }).compile();

        service = module.get(MerchantPaymentsService);
    });

    describe('resolveOrgContext', () => {
        it('returns organizationId', async () => {
            prisma.membership.findFirst.mockResolvedValue({ organizationId: ORG });
            const ctx = await service.resolveOrgContext(USER);
            expect(ctx.organizationId).toBe(ORG);
        });

        it('throws if no membership', async () => {
            prisma.membership.findFirst.mockResolvedValue(null);
            await expect(service.resolveOrgContext(USER)).rejects.toThrow(BadRequestException);
        });
    });

    describe('connect', () => {
        it('creates PENDING_MTN readiness with MOBILE_MONEY provider', async () => {
            prisma.merchantPaymentConfig.findUnique.mockResolvedValue(null);
            prisma.merchantPaymentConfig.upsert.mockResolvedValue({
                id: 'cfg-1',
                provider: 'MOBILE_MONEY',
                status: 'PENDING',
                notes: '[readiness=PENDING_MTN] Setup',
                connectedAt: null,
                lastCheckedAt: new Date(),
            });

            const result = await service.connect(ORG, { notes: 'Setup' }, USER);
            expect(result.readiness).toBe('PENDING_MTN');
            expect(result.provider).toBe('MOBILE_MONEY');
            expect(result.live).toBe(false);
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'MERCHANT_PAYMENT_CONNECT_INITIATED',
                    metadata: expect.objectContaining({
                        provider: 'MOBILE_MONEY',
                        readiness: 'PENDING_MTN',
                    }),
                }),
            );
        });

        it('respects an explicit readiness target', async () => {
            prisma.merchantPaymentConfig.findUnique.mockResolvedValue(null);
            prisma.merchantPaymentConfig.upsert.mockResolvedValue({
                id: 'cfg-1',
                provider: 'MOBILE_MONEY',
                status: 'PENDING',
                notes: '[readiness=PENDING_AIRTEL] ',
                connectedAt: null,
                lastCheckedAt: new Date(),
            });
            const result = await service.connect(ORG, { readiness: 'PENDING_AIRTEL' }, USER);
            expect(result.readiness).toBe('PENDING_AIRTEL');
        });

        it('throws ConflictException if already LIVE', async () => {
            prisma.merchantPaymentConfig.findUnique.mockResolvedValue({
                id: 'cfg-1',
                status: 'CONNECTED',
                notes: '[readiness=LIVE] active',
            });
            await expect(service.connect(ORG, { notes: '' }, USER)).rejects.toThrow(
                ConflictException,
            );
        });
    });

    describe('updateConfig', () => {
        it('moves readiness to READY_FOR_INTEGRATION', async () => {
            prisma.merchantPaymentConfig.findUnique.mockResolvedValue({
                id: 'cfg-1',
                provider: 'MOBILE_MONEY',
                status: 'PENDING',
                notes: '[readiness=PENDING_MTN] ',
                connectedAt: null,
                lastCheckedAt: null,
            });
            prisma.merchantPaymentConfig.update.mockResolvedValue({
                id: 'cfg-1',
                provider: 'MOBILE_MONEY',
                status: 'CONNECTED',
                notes: '[readiness=READY_FOR_INTEGRATION] ',
                connectedAt: null,
                lastCheckedAt: new Date(),
            });

            const result = await service.updateConfig(
                ORG,
                { readiness: 'READY_FOR_INTEGRATION' },
                USER,
            );
            expect(result.readiness).toBe('READY_FOR_INTEGRATION');
            expect(result.live).toBe(false);
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'MERCHANT_PAYMENT_CONFIG_UPDATED' }),
            );
        });

        it('throws NotFoundException if no config', async () => {
            prisma.merchantPaymentConfig.findUnique.mockResolvedValue(null);
            await expect(
                service.updateConfig(ORG, { readiness: 'PENDING_MTN' }, USER),
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('getStatus', () => {
        it('returns NOT_CONFIGURED when no row', async () => {
            prisma.merchantPaymentConfig.findUnique.mockResolvedValue(null);
            const result = await service.getStatus(ORG);
            expect(result.configured).toBe(false);
            expect(result.readiness).toBe('NOT_CONFIGURED');
            expect(result.live).toBe(false);
        });

        it('returns readiness + live=false for non-LIVE row', async () => {
            prisma.merchantPaymentConfig.findUnique.mockResolvedValue({
                id: 'cfg-1',
                provider: 'MOBILE_MONEY',
                status: 'PENDING',
                notes: '[readiness=PENDING_MTN] ',
                connectedAt: null,
                lastCheckedAt: new Date(),
            });
            const result = await service.getStatus(ORG);
            expect(result.configured).toBe(true);
            expect(result.readiness).toBe('PENDING_MTN');
            expect(result.live).toBe(false);
        });

        it('never advertises PesaPal in the response', async () => {
            prisma.merchantPaymentConfig.findUnique.mockResolvedValue({
                id: 'cfg-1',
                provider: 'MOBILE_MONEY',
                status: 'PENDING',
                notes: '[readiness=PENDING_MTN] ',
                connectedAt: null,
                lastCheckedAt: new Date(),
            });
            const result = await service.getStatus(ORG);
            expect(JSON.stringify(result).toLowerCase()).not.toContain('pesapal');
        });
    });
});
