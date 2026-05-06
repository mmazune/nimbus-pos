import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PublicCommercePaymentsService } from './public-commerce-payments.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

const ORG = 'org-1';

function makePrisma() {
    return {
        reservationHold: { findUnique: jest.fn() },
        eventBookingHold: { findUnique: jest.fn() },
        pendingPaymentIntent: { create: jest.fn() },
    };
}

describe('PublicCommercePaymentsService (scaffold — pending mobile-money)', () => {
    let service: PublicCommercePaymentsService;
    let prisma: ReturnType<typeof makePrisma>;
    let audit: { log: jest.Mock };

    beforeEach(async () => {
        prisma = makePrisma();
        audit = { log: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PublicCommercePaymentsService,
                { provide: PrismaService, useValue: prisma },
                { provide: AuditService, useValue: audit },
            ],
        }).compile();

        service = module.get(PublicCommercePaymentsService);
    });

    describe('createReservationCheckout', () => {
        it('returns PENDING_INTEGRATION + MOBILE_MONEY response with intent', async () => {
            prisma.reservationHold.findUnique.mockResolvedValue({
                id: 'hold-1', orgId: ORG, status: 'HELD',
            });
            prisma.pendingPaymentIntent.create.mockResolvedValue({ id: 'pi-1' });

            const result = await service.createReservationCheckout({ holdId: 'hold-1' });
            expect(result.status).toBe('PENDING_INTEGRATION');
            expect(result.provider).toBe('MOBILE_MONEY');
            expect(result.intentId).toBe('pi-1');
            expect(result.message).toMatch(/MTN\/Airtel/);
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'PUBLIC_PAYMENT_CHECKOUT_ATTEMPTED' }),
            );
        });

        it('never references PesaPal in the response', async () => {
            prisma.reservationHold.findUnique.mockResolvedValue({
                id: 'hold-1', orgId: ORG, status: 'HELD',
            });
            prisma.pendingPaymentIntent.create.mockResolvedValue({ id: 'pi-1' });
            const result = await service.createReservationCheckout({ holdId: 'hold-1' });
            expect(JSON.stringify(result).toLowerCase()).not.toContain('pesapal');
        });

        it('throws NotFoundException for unknown hold', async () => {
            prisma.reservationHold.findUnique.mockResolvedValue(null);
            await expect(
                service.createReservationCheckout({ holdId: 'bad' }),
            ).rejects.toThrow(NotFoundException);
        });

        it('throws BadRequestException for non-HELD status', async () => {
            prisma.reservationHold.findUnique.mockResolvedValue({
                id: 'hold-1', orgId: ORG, status: 'CONFIRMED',
            });
            await expect(
                service.createReservationCheckout({ holdId: 'hold-1' }),
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('createEventBookingCheckout', () => {
        it('returns PENDING_INTEGRATION + MOBILE_MONEY response with intent', async () => {
            prisma.eventBookingHold.findUnique.mockResolvedValue({
                id: 'bhold-1', orgId: ORG, status: 'HELD',
            });
            prisma.pendingPaymentIntent.create.mockResolvedValue({ id: 'pi-2' });

            const result = await service.createEventBookingCheckout({ holdId: 'bhold-1' });
            expect(result.status).toBe('PENDING_INTEGRATION');
            expect(result.provider).toBe('MOBILE_MONEY');
            expect(result.intentId).toBe('pi-2');
        });

        it('throws NotFoundException for unknown booking hold', async () => {
            prisma.eventBookingHold.findUnique.mockResolvedValue(null);
            await expect(
                service.createEventBookingCheckout({ holdId: 'bad' }),
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('handleCallback', () => {
        it('returns PENDING_INTEGRATION (no provider execution)', async () => {
            const result = await service.handleCallback('ot-1');
            expect(result.status).toBe('PENDING_INTEGRATION');
            expect(result.provider).toBe('MOBILE_MONEY');
        });
    });

    describe('handleIpn', () => {
        it('returns PENDING_INTEGRATION (no provider execution)', async () => {
            const result = await service.handleIpn({ OrderTrackingId: 'ot-1' });
            expect(result.status).toBe('PENDING_INTEGRATION');
            expect(result.provider).toBe('MOBILE_MONEY');
        });
    });

    describe('reconcileStatus', () => {
        it('returns PENDING_INTEGRATION with tracking id echoed back', async () => {
            const result = await service.reconcileStatus({ orderTrackingId: 'ot-1' });
            expect(result.status).toBe('PENDING_INTEGRATION');
            expect(result.provider).toBe('MOBILE_MONEY');
            expect(result.orderTrackingId).toBe('ot-1');
        });
    });
});
