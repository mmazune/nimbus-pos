import {
    Injectable,
    BadRequestException,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import {
    UpdatePublicProfileDto,
    CreatePublicEventDto,
    UpdatePublicEventDto,
    UpdateEventCapacityDto,
    UpdateEventPricingDto,
    HoldReservationDto,
    ConfirmReservationDto,
    HoldEventBookingDto,
    ConfirmEventBookingDto,
} from './dto';

@Injectable()
export class PublicCommerceService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    // ── Merchant: Public Profile ──

    async updatePublicProfile(
        orgId: string,
        branchId: string,
        dto: UpdatePublicProfileDto,
        userId: string,
    ) {
        const slug = dto.displayName
            ? dto.displayName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
            : undefined;

        const profile = await this.prisma.publicProfile.upsert({
            where: { orgId_branchId: { orgId, branchId } },
            update: {
                ...(dto.displayName !== undefined && { displayName: dto.displayName }),
                ...(slug && { slug }),
                ...(dto.description !== undefined && { description: dto.description }),
                ...(dto.cuisineType !== undefined && { cuisineType: dto.cuisineType }),
                ...(dto.address !== undefined && { address: dto.address }),
                ...(dto.phone !== undefined && { phone: dto.phone }),
                ...(dto.email !== undefined && { email: dto.email }),
                ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
                ...(dto.coverImageUrl !== undefined && { coverImageUrl: dto.coverImageUrl }),
                ...(dto.openingHours !== undefined && { openingHours: dto.openingHours as object }),
            },
            create: {
                orgId,
                branchId,
                slug: slug || `restaurant-${orgId.substring(0, 8)}`,
                displayName: dto.displayName || 'Restaurant',
                description: dto.description,
                cuisineType: dto.cuisineType,
                address: dto.address,
                phone: dto.phone,
                email: dto.email,
                logoUrl: dto.logoUrl,
                coverImageUrl: dto.coverImageUrl,
                openingHours: dto.openingHours ? (dto.openingHours as object) : undefined,
            },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'PUBLIC_PROFILE_UPDATED',
            entityType: 'PublicProfile',
            entityId: profile.id,
        });

        return profile;
    }

    async publishProfile(orgId: string, branchId: string, userId: string) {
        const profile = await this.prisma.publicProfile.findUnique({
            where: { orgId_branchId: { orgId, branchId } },
        });

        if (!profile) {
            throw new NotFoundException('Public profile not found for this branch');
        }

        const updated = await this.prisma.publicProfile.update({
            where: { id: profile.id },
            data: { status: 'PUBLISHED', publishedAt: new Date() },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'PUBLIC_PROFILE_PUBLISHED',
            entityType: 'PublicProfile',
            entityId: profile.id,
        });

        return updated;
    }

    // ── Merchant: Events ──

    async createPublicEvent(orgId: string, branchId: string, dto: CreatePublicEventDto, userId: string) {
        const slug = dto.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') +
            '-' + Date.now().toString(36);

        const event = await this.prisma.publicEvent.create({
            data: {
                orgId,
                branchId,
                slug,
                title: dto.title,
                description: dto.description,
                startsAt: new Date(dto.startsAt),
                endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
                capacity: dto.capacity,
                priceAmount: dto.priceAmount ? parseFloat(dto.priceAmount) : undefined,
                priceCurrency: dto.priceCurrency || 'USD',
                isFree: dto.isFree ?? true,
                imageUrl: dto.imageUrl,
            },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'PUBLIC_EVENT_CREATED',
            entityType: 'PublicEvent',
            entityId: event.id,
            metadata: { title: dto.title },
        });

        return event;
    }

    async updatePublicEvent(orgId: string, eventId: string, dto: UpdatePublicEventDto, userId: string) {
        const event = await this.prisma.publicEvent.findFirst({
            where: { id: eventId, orgId },
        });
        if (!event) throw new NotFoundException('Public event not found');

        const data: Record<string, unknown> = {};
        if (dto.title !== undefined) data.title = dto.title;
        if (dto.description !== undefined) data.description = dto.description;
        if (dto.startsAt !== undefined) data.startsAt = new Date(dto.startsAt);
        if (dto.endsAt !== undefined) data.endsAt = new Date(dto.endsAt);
        if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;

        const updated = await this.prisma.publicEvent.update({
            where: { id: eventId },
            data,
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'PUBLIC_EVENT_UPDATED',
            entityType: 'PublicEvent',
            entityId: eventId,
        });

        return updated;
    }

    async publishEvent(orgId: string, eventId: string, userId: string) {
        const event = await this.prisma.publicEvent.findFirst({
            where: { id: eventId, orgId },
        });
        if (!event) throw new NotFoundException('Public event not found');

        const updated = await this.prisma.publicEvent.update({
            where: { id: eventId },
            data: { status: 'PUBLISHED', publishedAt: new Date() },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'PUBLIC_EVENT_PUBLISHED',
            entityType: 'PublicEvent',
            entityId: eventId,
        });

        return updated;
    }

    async updateEventCapacity(orgId: string, eventId: string, dto: UpdateEventCapacityDto, userId: string) {
        const event = await this.prisma.publicEvent.findFirst({
            where: { id: eventId, orgId },
        });
        if (!event) throw new NotFoundException('Public event not found');

        if (dto.capacity > 0 && dto.capacity < event.bookedCount) {
            throw new ConflictException(
                `Cannot set capacity (${dto.capacity}) below current bookedCount (${event.bookedCount})`,
            );
        }

        const updated = await this.prisma.publicEvent.update({
            where: { id: eventId },
            data: { capacity: dto.capacity },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'PUBLIC_EVENT_CAPACITY_UPDATED',
            entityType: 'PublicEvent',
            entityId: eventId,
            metadata: { from: event.capacity, to: dto.capacity },
        });

        return updated;
    }

    async updateEventPricing(orgId: string, eventId: string, dto: UpdateEventPricingDto, userId: string) {
        const event = await this.prisma.publicEvent.findFirst({
            where: { id: eventId, orgId },
        });
        if (!event) throw new NotFoundException('Public event not found');

        if (dto.isFree === false && (dto.priceAmount === undefined || parseFloat(dto.priceAmount) <= 0)) {
            // Allow keeping previously-set price; only validate when toggling to paid AND no priceAmount provided AND no existing price
            if (!event.priceAmount || Number(event.priceAmount.toString()) <= 0) {
                throw new BadRequestException('Paid events must have priceAmount > 0');
            }
        }

        const data: Record<string, unknown> = {};
        if (dto.priceAmount !== undefined) data.priceAmount = parseFloat(dto.priceAmount);
        if (dto.priceCurrency !== undefined) data.priceCurrency = dto.priceCurrency;
        if (dto.isFree !== undefined) data.isFree = dto.isFree;

        const updated = await this.prisma.publicEvent.update({
            where: { id: eventId },
            data,
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'PUBLIC_EVENT_PRICING_UPDATED',
            entityType: 'PublicEvent',
            entityId: eventId,
            metadata: dto as unknown as Record<string, unknown>,
        });

        return updated;
    }

    // ── Merchant: Booking Settings (M39.2) ──
    // Persisted on the branch's PublicProfile.metadata.bookingSettings JSON
    // blob. Auto-creates the profile in DRAFT if it doesn't exist yet so the
    // owner can configure booking rules before publishing.
    async updateBookingSettings(
        orgId: string,
        branchId: string,
        settings: Record<string, unknown>,
        userId: string,
    ) {
        const profile = await this.prisma.publicProfile.upsert({
            where: { orgId_branchId: { orgId, branchId } },
            update: {
                metadata: { bookingSettings: settings } as object,
            },
            create: {
                orgId,
                branchId,
                slug: `restaurant-${branchId.substring(0, 8)}`,
                displayName: 'Restaurant',
                metadata: { bookingSettings: settings } as object,
            },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'MERCHANT_BOOKING_SETTINGS_UPDATED',
            entityType: 'PublicProfile',
            entityId: profile.id,
            metadata: settings as Record<string, unknown>,
        });

        return {
            profileId: profile.id,
            branchId,
            bookingSettings: settings,
            note: 'Booking settings stored on PublicProfile.metadata. Profile remains in its current publish state.',
        };
    }

    // ── Public: Browse ──

    async listPublicRestaurants() {
        return this.prisma.publicProfile.findMany({
            where: { status: 'PUBLISHED' },
            orderBy: { displayName: 'asc' },
            select: {
                slug: true,
                displayName: true,
                description: true,
                cuisineType: true,
                address: true,
                logoUrl: true,
                coverImageUrl: true,
            },
        });
    }

    async getPublicRestaurant(slug: string) {
        const profile = await this.prisma.publicProfile.findUnique({
            where: { slug },
        });
        if (!profile || profile.status !== 'PUBLISHED') {
            throw new NotFoundException('Restaurant not found');
        }
        return profile;
    }

    async getRestaurantAvailability(slug: string) {
        const profile = await this.prisma.publicProfile.findUnique({
            where: { slug },
        });
        if (!profile || profile.status !== 'PUBLISHED') {
            throw new NotFoundException('Restaurant not found');
        }

        // Return availability based on existing tables for the branch
        const tables = await this.prisma.table.findMany({
            where: { branchId: profile.branchId, isActive: true },
            select: { id: true, label: true, capacity: true, status: true },
        });

        const available = tables.filter((t) => t.status === 'AVAILABLE');
        return {
            restaurantSlug: slug,
            totalTables: tables.length,
            availableTables: available.length,
            tables: available.map((t) => ({
                label: t.label,
                capacity: t.capacity,
            })),
        };
    }

    async getRestaurantEvents(slug: string) {
        const profile = await this.prisma.publicProfile.findUnique({
            where: { slug },
        });
        if (!profile || profile.status !== 'PUBLISHED') {
            throw new NotFoundException('Restaurant not found');
        }

        return this.prisma.publicEvent.findMany({
            where: { branchId: profile.branchId, status: 'PUBLISHED' },
            orderBy: { startsAt: 'asc' },
        });
    }

    async listPublicEvents() {
        return this.prisma.publicEvent.findMany({
            where: { status: 'PUBLISHED', startsAt: { gte: new Date() } },
            orderBy: { startsAt: 'asc' },
            select: {
                slug: true,
                title: true,
                description: true,
                startsAt: true,
                endsAt: true,
                capacity: true,
                bookedCount: true,
                priceAmount: true,
                priceCurrency: true,
                isFree: true,
                imageUrl: true,
            },
        });
    }

    async getPublicEvent(slug: string) {
        const event = await this.prisma.publicEvent.findUnique({ where: { slug } });
        if (!event || event.status !== 'PUBLISHED') {
            throw new NotFoundException('Event not found');
        }
        return event;
    }

    // ── Public: Reservation Holds ──

    async holdReservation(dto: HoldReservationDto) {
        const profile = await this.prisma.publicProfile.findUnique({
            where: { slug: dto.restaurantSlug },
        });
        if (!profile || profile.status !== 'PUBLISHED') {
            throw new NotFoundException('Restaurant not found');
        }

        const hold = await this.prisma.reservationHold.create({
            data: {
                orgId: profile.orgId,
                branchId: profile.branchId,
                guestName: dto.guestName,
                guestEmail: dto.guestEmail,
                guestPhone: dto.guestPhone,
                partySize: dto.partySize,
                requestedDate: new Date(dto.requestedDate),
                requestedTime: dto.requestedTime,
                notes: dto.notes,
                expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min hold
            },
        });

        // M39.3: audit public hold creation (no actor — public/anonymous)
        await this.audit.log({
            action: 'PUBLIC_RESERVATION_HOLD_CREATED',
            entityType: 'ReservationHold',
            entityId: hold.id,
            metadata: {
                restaurantSlug: dto.restaurantSlug,
                partySize: dto.partySize,
                expiresAt: hold.expiresAt,
            },
        });

        return {
            holdId: hold.id,
            status: hold.status,
            expiresAt: hold.expiresAt,
            restaurantSlug: dto.restaurantSlug,
        };
    }

    async confirmReservation(dto: ConfirmReservationDto) {
        const hold = await this.prisma.reservationHold.findUnique({
            where: { id: dto.holdId },
        });

        if (!hold) throw new NotFoundException('Reservation hold not found');
        if (hold.status !== 'HELD') {
            throw new ConflictException(`Cannot confirm hold in status ${hold.status}`);
        }
        if (hold.expiresAt < new Date()) {
            await this.prisma.reservationHold.update({
                where: { id: hold.id },
                data: { status: 'EXPIRED' },
            });
            await this.audit.log({
                action: 'PUBLIC_RESERVATION_HOLD_EXPIRED',
                entityType: 'ReservationHold',
                entityId: hold.id,
            });
            throw new ConflictException('Reservation hold has expired');
        }

        const updated = await this.prisma.reservationHold.update({
            where: { id: hold.id },
            data: { status: 'CONFIRMED', confirmedAt: new Date() },
        });

        await this.audit.log({
            action: 'PUBLIC_RESERVATION_CONFIRMED',
            entityType: 'ReservationHold',
            entityId: updated.id,
        });

        return { holdId: updated.id, status: 'CONFIRMED', confirmedAt: updated.confirmedAt };
    }

    // ── Public: Event Booking Holds ──

    async holdEventBooking(dto: HoldEventBookingDto) {
        const event = await this.prisma.publicEvent.findUnique({
            where: { slug: dto.eventSlug },
        });

        if (!event || event.status !== 'PUBLISHED') {
            throw new NotFoundException('Event not found');
        }

        const ticketCount = dto.ticketCount || 1;
        if (event.bookedCount + ticketCount > event.capacity && event.capacity > 0) {
            throw new ConflictException('Not enough capacity for this event');
        }

        const hold = await this.prisma.eventBookingHold.create({
            data: {
                orgId: event.orgId,
                branchId: event.branchId,
                publicEventId: event.id,
                guestName: dto.guestName,
                guestEmail: dto.guestEmail,
                guestPhone: dto.guestPhone,
                ticketCount,
                notes: dto.notes,
                expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min hold
            },
        });

        // M39.3: audit public event-booking hold creation
        await this.audit.log({
            action: 'PUBLIC_EVENT_BOOKING_HOLD_CREATED',
            entityType: 'EventBookingHold',
            entityId: hold.id,
            metadata: {
                eventSlug: dto.eventSlug,
                ticketCount,
                expiresAt: hold.expiresAt,
            },
        });

        return {
            holdId: hold.id,
            status: hold.status,
            expiresAt: hold.expiresAt,
            eventSlug: dto.eventSlug,
            ticketCount,
        };
    }

    async confirmEventBooking(dto: ConfirmEventBookingDto) {
        const hold = await this.prisma.eventBookingHold.findUnique({
            where: { id: dto.holdId },
            include: { publicEvent: true },
        });

        if (!hold) throw new NotFoundException('Event booking hold not found');
        if (hold.status !== 'HELD') {
            throw new ConflictException(`Cannot confirm booking in status ${hold.status}`);
        }
        if (hold.expiresAt < new Date()) {
            await this.prisma.eventBookingHold.update({
                where: { id: hold.id },
                data: { status: 'EXPIRED' },
            });
            await this.audit.log({
                action: 'PUBLIC_EVENT_BOOKING_HOLD_EXPIRED',
                entityType: 'EventBookingHold',
                entityId: hold.id,
            });
            throw new ConflictException('Event booking hold has expired');
        }

        // Only confirm free events or events with no payment requirement
        if (!hold.publicEvent.isFree) {
            throw new ConflictException(
                'Paid event bookings require payment. Public commerce payments are pending implementation.',
            );
        }

        const updated = await this.prisma.$transaction(async (tx) => {
            const booking = await tx.eventBookingHold.update({
                where: { id: hold.id },
                data: { status: 'CONFIRMED', confirmedAt: new Date() },
            });

            await tx.publicEvent.update({
                where: { id: hold.publicEventId },
                data: { bookedCount: { increment: hold.ticketCount } },
            });

            return booking;
        });

        await this.audit.log({
            action: 'PUBLIC_EVENT_BOOKING_CONFIRMED',
            entityType: 'EventBookingHold',
            entityId: updated.id,
            metadata: { ticketCount: hold.ticketCount, eventId: hold.publicEventId },
        });

        return { holdId: updated.id, status: 'CONFIRMED', confirmedAt: updated.confirmedAt };
    }
}
