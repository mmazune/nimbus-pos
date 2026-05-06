import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { PublicCommerceService } from './public-commerce.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

/**
 * M39.3 — Public Booking + Public Commerce Payment Skeleton + Ops Portal
 *
 * This spec is the M39.3-owned audit-coverage contract for the public
 * diner flows. The broader behavioral coverage lives in
 * `public-commerce.service.spec.ts`. Here we lock down the M39.3
 * additions only:
 *  - PUBLIC_RESERVATION_HOLD_CREATED
 *  - PUBLIC_RESERVATION_HOLD_EXPIRED
 *  - PUBLIC_RESERVATION_CONFIRMED
 *  - PUBLIC_EVENT_BOOKING_HOLD_CREATED
 *  - PUBLIC_EVENT_BOOKING_HOLD_EXPIRED
 *  - PUBLIC_EVENT_BOOKING_CONFIRMED
 */

const PROFILE = {
    id: 'prof-1',
    orgId: 'org-1',
    branchId: 'branch-1',
    slug: 'test-restaurant',
    status: 'PUBLISHED',
};

const FREE_EVENT = {
    id: 'evt-1',
    orgId: 'org-1',
    branchId: 'branch-1',
    slug: 'wine-night',
    status: 'PUBLISHED',
    capacity: 50,
    bookedCount: 10,
    isFree: true,
    priceAmount: null,
};

function makePrisma() {
    return {
        publicProfile: { findUnique: jest.fn() },
        publicEvent: { findUnique: jest.fn(), update: jest.fn() },
        reservationHold: {
            create: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        eventBookingHold: {
            create: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        $transaction: jest.fn(),
    };
}

describe('PublicCommerceService — M39.3 audit contract', () => {
    let service: PublicCommerceService;
    let prisma: ReturnType<typeof makePrisma>;
    let audit: { log: jest.Mock };

    beforeEach(async () => {
        prisma = makePrisma();
        audit = { log: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PublicCommerceService,
                { provide: PrismaService, useValue: prisma },
                { provide: AuditService, useValue: audit },
            ],
        }).compile();

        service = module.get(PublicCommerceService);
    });

    describe('reservation flows', () => {
        it('emits PUBLIC_RESERVATION_HOLD_CREATED on hold', async () => {
            prisma.publicProfile.findUnique.mockResolvedValue(PROFILE);
            prisma.reservationHold.create.mockResolvedValue({
                id: 'hold-1',
                status: 'HELD',
                expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            });

            await service.holdReservation({
                restaurantSlug: 'test-restaurant',
                guestName: 'John',
                guestEmail: 'john@example.com',
                partySize: 2,
                requestedDate: '2025-06-01',
                requestedTime: '19:00',
            } as any);

            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'PUBLIC_RESERVATION_HOLD_CREATED' }),
            );
        });

        it('emits PUBLIC_RESERVATION_HOLD_EXPIRED + throws on expired confirm', async () => {
            prisma.reservationHold.findUnique.mockResolvedValue({
                id: 'hold-1',
                status: 'HELD',
                expiresAt: new Date(Date.now() - 1000),
            });
            prisma.reservationHold.update.mockResolvedValue({});

            await expect(
                service.confirmReservation({ holdId: 'hold-1' }),
            ).rejects.toThrow(ConflictException);

            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'PUBLIC_RESERVATION_HOLD_EXPIRED' }),
            );
        });

        it('emits PUBLIC_RESERVATION_CONFIRMED on success', async () => {
            prisma.reservationHold.findUnique.mockResolvedValue({
                id: 'hold-1',
                status: 'HELD',
                expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            });
            prisma.reservationHold.update.mockResolvedValue({
                id: 'hold-1',
                status: 'CONFIRMED',
                confirmedAt: new Date(),
            });

            const result = await service.confirmReservation({ holdId: 'hold-1' });
            expect(result.status).toBe('CONFIRMED');
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'PUBLIC_RESERVATION_CONFIRMED' }),
            );
        });
    });

    describe('event booking flows', () => {
        it('emits PUBLIC_EVENT_BOOKING_HOLD_CREATED on hold', async () => {
            prisma.publicEvent.findUnique.mockResolvedValue(FREE_EVENT);
            prisma.eventBookingHold.create.mockResolvedValue({
                id: 'bhold-1',
                status: 'HELD',
                expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            });

            await service.holdEventBooking({
                eventSlug: 'wine-night',
                guestName: 'Alice',
                guestEmail: 'alice@example.com',
                ticketCount: 2,
            } as any);

            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'PUBLIC_EVENT_BOOKING_HOLD_CREATED' }),
            );
        });

        it('emits PUBLIC_EVENT_BOOKING_HOLD_EXPIRED + throws on expired confirm', async () => {
            prisma.eventBookingHold.findUnique.mockResolvedValue({
                id: 'bhold-1',
                status: 'HELD',
                expiresAt: new Date(Date.now() - 1000),
                publicEvent: FREE_EVENT,
                publicEventId: FREE_EVENT.id,
                ticketCount: 1,
            });
            prisma.eventBookingHold.update.mockResolvedValue({});

            await expect(
                service.confirmEventBooking({ holdId: 'bhold-1' }),
            ).rejects.toThrow(ConflictException);

            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'PUBLIC_EVENT_BOOKING_HOLD_EXPIRED' }),
            );
        });

        it('emits PUBLIC_EVENT_BOOKING_CONFIRMED on success (free event)', async () => {
            prisma.eventBookingHold.findUnique.mockResolvedValue({
                id: 'bhold-1',
                status: 'HELD',
                expiresAt: new Date(Date.now() + 10 * 60 * 1000),
                publicEvent: FREE_EVENT,
                publicEventId: FREE_EVENT.id,
                ticketCount: 2,
            });
            prisma.$transaction.mockImplementation(async (fn: any) =>
                fn({
                    eventBookingHold: {
                        update: jest.fn().mockResolvedValue({
                            id: 'bhold-1',
                            status: 'CONFIRMED',
                            confirmedAt: new Date(),
                        }),
                    },
                    publicEvent: { update: jest.fn() },
                }),
            );

            const result = await service.confirmEventBooking({ holdId: 'bhold-1' });
            expect(result.status).toBe('CONFIRMED');
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'PUBLIC_EVENT_BOOKING_CONFIRMED' }),
            );
        });

        it('refuses paid-event confirm cleanly (M39.3 — public payments still pending)', async () => {
            prisma.eventBookingHold.findUnique.mockResolvedValue({
                id: 'bhold-2',
                status: 'HELD',
                expiresAt: new Date(Date.now() + 10 * 60 * 1000),
                publicEvent: { ...FREE_EVENT, isFree: false, priceAmount: 25 },
                publicEventId: FREE_EVENT.id,
                ticketCount: 1,
            });

            await expect(
                service.confirmEventBooking({ holdId: 'bhold-2' }),
            ).rejects.toThrow(/Public commerce payments are pending/);
        });
    });
});
