import { Test, TestingModule } from '@nestjs/testing';
import {
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { PublicCommerceService } from './public-commerce.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

const ORG = 'org-1';
const BRANCH = 'branch-1';
const USER = 'user-1';

function makePrisma() {
    return {
        publicProfile: {
            upsert: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
            findMany: jest.fn(),
        },
        publicEvent: {
            create: jest.fn(),
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
        },
        table: { findMany: jest.fn() },
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

const PROFILE = {
    id: 'prof-1',
    orgId: ORG,
    branchId: BRANCH,
    slug: 'test-restaurant',
    displayName: 'Test Restaurant',
    status: 'PUBLISHED',
};

const EVENT = {
    id: 'evt-1',
    orgId: ORG,
    branchId: BRANCH,
    slug: 'wine-night-abc123',
    title: 'Wine Night',
    status: 'PUBLISHED',
    capacity: 50,
    bookedCount: 10,
    isFree: true,
    priceAmount: null,
    priceCurrency: 'USD',
    startsAt: new Date('2025-06-01'),
};

describe('PublicCommerceService', () => {
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

    // ── Merchant: Profile ──
    describe('updatePublicProfile', () => {
        it('upserts profile and audits', async () => {
            prisma.publicProfile.upsert.mockResolvedValue(PROFILE);

            const result = await service.updatePublicProfile(
                ORG, BRANCH, { displayName: 'Test Restaurant' }, USER,
            );
            expect(result.displayName).toBe('Test Restaurant');
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'PUBLIC_PROFILE_UPDATED' }),
            );
        });
    });

    describe('publishProfile', () => {
        it('publishes profile', async () => {
            prisma.publicProfile.findUnique.mockResolvedValue(PROFILE);
            prisma.publicProfile.update.mockResolvedValue({
                ...PROFILE, status: 'PUBLISHED', publishedAt: new Date(),
            });

            const result = await service.publishProfile(ORG, BRANCH, USER);
            expect(result.status).toBe('PUBLISHED');
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'PUBLIC_PROFILE_PUBLISHED' }),
            );
        });

        it('throws NotFoundException if no profile', async () => {
            prisma.publicProfile.findUnique.mockResolvedValue(null);
            await expect(service.publishProfile(ORG, BRANCH, USER)).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    // ── Merchant: Events ──
    describe('createPublicEvent', () => {
        it('creates event with slug', async () => {
            prisma.publicEvent.create.mockResolvedValue(EVENT);
            const result = await service.createPublicEvent(ORG, BRANCH, {
                title: 'Wine Night',
                startsAt: '2025-06-01',
                capacity: 50,
            } as any, USER);
            expect(result.title).toBe('Wine Night');
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'PUBLIC_EVENT_CREATED' }),
            );
        });
    });

    describe('publishEvent', () => {
        it('publishes event', async () => {
            prisma.publicEvent.findFirst.mockResolvedValue(EVENT);
            prisma.publicEvent.update.mockResolvedValue({ ...EVENT, status: 'PUBLISHED' });

            const result = await service.publishEvent(ORG, 'evt-1', USER);
            expect(result.status).toBe('PUBLISHED');
        });

        it('throws NotFoundException for unknown event', async () => {
            prisma.publicEvent.findFirst.mockResolvedValue(null);
            await expect(service.publishEvent(ORG, 'bad-id', USER)).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    // ── Public: Browse ──
    describe('listPublicRestaurants', () => {
        it('returns published restaurants', async () => {
            prisma.publicProfile.findMany.mockResolvedValue([{ slug: 'test-restaurant', displayName: 'Test' }]);
            const result = await service.listPublicRestaurants();
            expect(result).toHaveLength(1);
        });
    });

    describe('getPublicRestaurant', () => {
        it('returns a published restaurant by slug', async () => {
            prisma.publicProfile.findUnique.mockResolvedValue(PROFILE);
            const result = await service.getPublicRestaurant('test-restaurant');
            expect(result.slug).toBe('test-restaurant');
        });

        it('throws NotFoundException for unpublished', async () => {
            prisma.publicProfile.findUnique.mockResolvedValue({ ...PROFILE, status: 'DRAFT' });
            await expect(service.getPublicRestaurant('test-restaurant')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('throws NotFoundException for unknown slug', async () => {
            prisma.publicProfile.findUnique.mockResolvedValue(null);
            await expect(service.getPublicRestaurant('unknown')).rejects.toThrow(NotFoundException);
        });
    });

    describe('getRestaurantAvailability', () => {
        it('returns table availability', async () => {
            prisma.publicProfile.findUnique.mockResolvedValue(PROFILE);
            prisma.table.findMany.mockResolvedValue([
                { id: 't1', label: 'T1', capacity: 4, status: 'AVAILABLE' },
                { id: 't2', label: 'T2', capacity: 2, status: 'OCCUPIED' },
            ]);

            const result = await service.getRestaurantAvailability('test-restaurant');
            expect(result.totalTables).toBe(2);
            expect(result.availableTables).toBe(1);
        });
    });

    describe('listPublicEvents', () => {
        it('returns future published events', async () => {
            prisma.publicEvent.findMany.mockResolvedValue([EVENT]);
            const result = await service.listPublicEvents();
            expect(result).toHaveLength(1);
        });
    });

    // ── Reservation Holds ──
    describe('holdReservation', () => {
        it('creates a 15-minute hold', async () => {
            prisma.publicProfile.findUnique.mockResolvedValue(PROFILE);
            const now = Date.now();
            prisma.reservationHold.create.mockResolvedValue({
                id: 'hold-1',
                status: 'HELD',
                expiresAt: new Date(now + 15 * 60 * 1000),
            });

            const result = await service.holdReservation({
                restaurantSlug: 'test-restaurant',
                guestName: 'John',
                guestEmail: 'john@example.com',
                partySize: 4,
                requestedDate: '2025-06-01',
                requestedTime: '19:00',
            } as any);

            expect(result.status).toBe('HELD');
            expect(result.holdId).toBe('hold-1');
        });

        it('throws NotFoundException for unknown restaurant', async () => {
            prisma.publicProfile.findUnique.mockResolvedValue(null);
            await expect(
                service.holdReservation({ restaurantSlug: 'unknown' } as any),
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('confirmReservation', () => {
        it('confirms a valid HELD reservation', async () => {
            prisma.reservationHold.findUnique.mockResolvedValue({
                id: 'hold-1',
                status: 'HELD',
                expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min left
            });
            prisma.reservationHold.update.mockResolvedValue({
                id: 'hold-1', status: 'CONFIRMED', confirmedAt: new Date(),
            });

            const result = await service.confirmReservation({ holdId: 'hold-1' });
            expect(result.status).toBe('CONFIRMED');
        });

        it('throws ConflictException for expired hold', async () => {
            prisma.reservationHold.findUnique.mockResolvedValue({
                id: 'hold-1',
                status: 'HELD',
                expiresAt: new Date(Date.now() - 1000), // expired
            });
            prisma.reservationHold.update.mockResolvedValue({});

            await expect(service.confirmReservation({ holdId: 'hold-1' })).rejects.toThrow(
                ConflictException,
            );
        });

        it('throws ConflictException for non-HELD status', async () => {
            prisma.reservationHold.findUnique.mockResolvedValue({
                id: 'hold-1', status: 'CONFIRMED',
                expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            });
            await expect(service.confirmReservation({ holdId: 'hold-1' })).rejects.toThrow(
                ConflictException,
            );
        });

        it('throws NotFoundException for unknown hold', async () => {
            prisma.reservationHold.findUnique.mockResolvedValue(null);
            await expect(service.confirmReservation({ holdId: 'bad' })).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    // ── Event Booking Holds ──
    describe('holdEventBooking', () => {
        it('creates a booking hold', async () => {
            prisma.publicEvent.findUnique.mockResolvedValue(EVENT);
            prisma.eventBookingHold.create.mockResolvedValue({
                id: 'bhold-1', status: 'HELD',
                expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            });

            const result = await service.holdEventBooking({
                eventSlug: 'wine-night-abc123',
                guestName: 'Alice',
                guestEmail: 'alice@example.com',
                ticketCount: 2,
            } as any);

            expect(result.status).toBe('HELD');
            expect(result.ticketCount).toBe(2);
        });

        it('throws ConflictException when over capacity', async () => {
            prisma.publicEvent.findUnique.mockResolvedValue({
                ...EVENT, bookedCount: 49, capacity: 50,
            });

            await expect(
                service.holdEventBooking({
                    eventSlug: 'wine-night-abc123',
                    guestName: 'Alice',
                    guestEmail: 'alice@example.com',
                    ticketCount: 5,
                } as any),
            ).rejects.toThrow(ConflictException);
        });
    });

    describe('confirmEventBooking', () => {
        it('confirms a free event booking', async () => {
            prisma.eventBookingHold.findUnique.mockResolvedValue({
                id: 'bhold-1',
                status: 'HELD',
                expiresAt: new Date(Date.now() + 10 * 60 * 1000),
                ticketCount: 2,
                publicEventId: 'evt-1',
                publicEvent: { ...EVENT, isFree: true },
            });
            prisma.$transaction.mockImplementation(async (fn: any) =>
                fn({
                    eventBookingHold: {
                        update: jest.fn().mockResolvedValue({
                            id: 'bhold-1', status: 'CONFIRMED', confirmedAt: new Date(),
                        }),
                    },
                    publicEvent: { update: jest.fn().mockResolvedValue({}) },
                }),
            );

            const result = await service.confirmEventBooking({ holdId: 'bhold-1' });
            expect(result.status).toBe('CONFIRMED');
        });

        it('rejects paid event booking with pending message', async () => {
            prisma.eventBookingHold.findUnique.mockResolvedValue({
                id: 'bhold-1',
                status: 'HELD',
                expiresAt: new Date(Date.now() + 10 * 60 * 1000),
                ticketCount: 1,
                publicEventId: 'evt-1',
                publicEvent: { ...EVENT, isFree: false },
            });

            await expect(service.confirmEventBooking({ holdId: 'bhold-1' })).rejects.toThrow(
                ConflictException,
            );
        });
    });

    // ── M39.2 — Booking settings persistence ──
    describe('updateBookingSettings (M39.2)', () => {
        it('persists settings into PublicProfile.metadata.bookingSettings and audits', async () => {
            prisma.publicProfile.upsert.mockResolvedValue({ id: 'prof-1' });
            const settings = { requireDeposit: true, maxPartySize: 12, holdMinutes: 15 };

            const result = await service.updateBookingSettings(ORG, BRANCH, settings, USER);

            expect(prisma.publicProfile.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { orgId_branchId: { orgId: ORG, branchId: BRANCH } },
                    update: { metadata: { bookingSettings: settings } },
                    create: expect.objectContaining({
                        orgId: ORG,
                        branchId: BRANCH,
                        metadata: { bookingSettings: settings },
                    }),
                }),
            );
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'MERCHANT_BOOKING_SETTINGS_UPDATED' }),
            );
            expect(result.bookingSettings).toEqual(settings);
        });
    });

    // ── M39.2 — Event capacity / pricing flows ──
    describe('updateEventCapacity (M39.2)', () => {
        it('refuses to drop capacity below bookedCount', async () => {
            prisma.publicEvent.findFirst.mockResolvedValue({ ...EVENT, capacity: 50, bookedCount: 30 });
            await expect(
                service.updateEventCapacity(ORG, EVENT.id, { capacity: 10 }, USER),
            ).rejects.toThrow(ConflictException);
        });

        it('updates capacity and emits audit when valid', async () => {
            prisma.publicEvent.findFirst.mockResolvedValue({ ...EVENT, capacity: 50, bookedCount: 10 });
            prisma.publicEvent.update.mockResolvedValue({ ...EVENT, capacity: 75 });

            const updated = await service.updateEventCapacity(ORG, EVENT.id, { capacity: 75 }, USER);
            expect(updated.capacity).toBe(75);
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'PUBLIC_EVENT_CAPACITY_UPDATED' }),
            );
        });
    });

    describe('updateEventPricing (M39.2)', () => {
        it('audits pricing change', async () => {
            prisma.publicEvent.findFirst.mockResolvedValue(EVENT);
            prisma.publicEvent.update.mockResolvedValue({ ...EVENT, isFree: false, priceAmount: 25 });

            await service.updateEventPricing(
                ORG, EVENT.id, { isFree: false, priceAmount: '25.00' }, USER,
            );
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'PUBLIC_EVENT_PRICING_UPDATED' }),
            );
        });
    });
});
