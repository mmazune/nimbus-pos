import {
    Controller,
    Get,
    Post,
    Patch,
    Body,
    Param,
    UseGuards,
    Req,
} from '@nestjs/common';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { Permissions, CurrentUser, RequireBranchContext } from '../../common/decorators';
import { PublicCommerceService } from './public-commerce.service';
import { Bg3ReliabilityService, BG3_CATEGORY } from '../bg3-reliability';
import {
    UpdatePublicProfileDto,
    CreatePublicEventDto,
    UpdatePublicEventDto,
    UpdateEventCapacityDto,
    UpdateEventPricingDto,
    UpdateBookingSettingsDto,
    HoldReservationDto,
    ConfirmReservationDto,
    HoldEventBookingDto,
    ConfirmEventBookingDto,
} from './dto';
import { Request } from 'express';

// ── Merchant-side controller (authenticated) ──

@Controller('merchant')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class MerchantCommerceController {
    constructor(private readonly service: PublicCommerceService) { }

    @Patch('public-profile')
    @Permissions('merchant:public-profile:write')
    async updatePublicProfile(
        @CurrentUser() user: { id: string },
        @Req() req: Request,
        @Body() dto: UpdatePublicProfileDto,
    ) {
        const ctx = (req as any).branchContext;
        return this.service.updatePublicProfile(ctx.organizationId, ctx.branchId, dto, user.id);
    }

    @Patch('public-profile/publish')
    @Permissions('merchant:public-profile:write')
    async publishProfile(
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = (req as any).branchContext;
        return this.service.publishProfile(ctx.organizationId, ctx.branchId, user.id);
    }

    @Patch('booking-settings')
    @Permissions('merchant:public-profile:write')
    async updateBookingSettings(
        @CurrentUser() user: { id: string },
        @Req() req: Request,
        @Body() dto: UpdateBookingSettingsDto,
    ) {
        const ctx = (req as any).branchContext;
        return this.service.updateBookingSettings(
            ctx.organizationId,
            ctx.branchId,
            (dto.settings ?? {}) as Record<string, unknown>,
            user.id,
        );
    }

    @Post('events')
    @Permissions('merchant:events:write')
    async createEvent(
        @CurrentUser() user: { id: string },
        @Req() req: Request,
        @Body() dto: CreatePublicEventDto,
    ) {
        const ctx = (req as any).branchContext;
        return this.service.createPublicEvent(ctx.organizationId, ctx.branchId, dto, user.id);
    }

    @Patch('events/:id')
    @Permissions('merchant:events:write')
    async updateEvent(
        @CurrentUser() user: { id: string },
        @Req() req: Request,
        @Param('id') id: string,
        @Body() dto: UpdatePublicEventDto,
    ) {
        const ctx = (req as any).branchContext;
        return this.service.updatePublicEvent(ctx.organizationId, id, dto, user.id);
    }

    @Patch('events/:id/publish')
    @Permissions('merchant:events:write')
    async publishEvent(
        @CurrentUser() user: { id: string },
        @Req() req: Request,
        @Param('id') id: string,
    ) {
        const ctx = (req as any).branchContext;
        return this.service.publishEvent(ctx.organizationId, id, user.id);
    }

    @Patch('events/:id/capacity')
    @Permissions('merchant:events:write')
    async updateEventCapacity(
        @CurrentUser() user: { id: string },
        @Req() req: Request,
        @Param('id') id: string,
        @Body() dto: UpdateEventCapacityDto,
    ) {
        const ctx = (req as any).branchContext;
        return this.service.updateEventCapacity(ctx.organizationId, id, dto, user.id);
    }

    @Patch('events/:id/pricing')
    @Permissions('merchant:events:write')
    async updateEventPricing(
        @CurrentUser() user: { id: string },
        @Req() req: Request,
        @Param('id') id: string,
        @Body() dto: UpdateEventPricingDto,
    ) {
        const ctx = (req as any).branchContext;
        return this.service.updateEventPricing(ctx.organizationId, id, dto, user.id);
    }
}

// ── Public-side controller (unauthenticated) ──

@Controller('public')
export class PublicCommerceController {
    constructor(
        private readonly service: PublicCommerceService,
        private readonly bg3: Bg3ReliabilityService,
    ) { }

    @Get('plans')
    async listPublicPlans() {
        // ── M39.1 Commercial Foundation ──
        // Plans are SOLO / GROWTH / FRANCHISE. All plans grant the full
        // Nimbus feature set. The only commercial cap is location count
        // (`maxLocations`). No feature-gating flags are returned.
        const plans = await this.service['prisma'].plan.findMany({
            where: { status: 'ACTIVE' },
            orderBy: { sortOrder: 'asc' },
            select: {
                code: true,
                name: true,
                description: true,
                priceMonthly: true,
                priceAnnual: true,
                maxBranches: true,
                supportTier: true,
            },
        });
        return {
            policy: {
                enforcedMetric: 'maxLocations',
                featureGating: false,
                note: 'All plans include the full Nimbus feature set. The only commercial cap is the number of allowed locations.',
            },
            plans: plans.map((p: any) => {
                const monthly = Number(p.priceMonthly.toString());
                const annual = Number(p.priceAnnual.toString());
                const annualDiscountPct =
                    monthly > 0 ? Math.round((1 - annual / (monthly * 12)) * 1000) / 10 : 0;
                return {
                    code: p.code,
                    name: p.name,
                    description: p.description,
                    priceMonthly: monthly,
                    priceAnnual: annual,
                    annualDiscountPct,
                    maxLocations: p.maxBranches,
                    supportTier: p.supportTier,
                };
            }),
        };
    }

    @Get('restaurants')
    async listRestaurants() {
        return this.service.listPublicRestaurants();
    }

    @Get('restaurants/:slug')
    async getRestaurant(@Param('slug') slug: string) {
        return this.service.getPublicRestaurant(slug);
    }

    @Get('restaurants/:slug/availability')
    async getAvailability(@Param('slug') slug: string) {
        return this.service.getRestaurantAvailability(slug);
    }

    @Get('restaurants/:slug/events')
    async getRestaurantEvents(@Param('slug') slug: string) {
        return this.service.getRestaurantEvents(slug);
    }

    @Get('events')
    async listEvents() {
        return this.service.listPublicEvents();
    }

    @Get('events/:slug')
    async getEvent(@Param('slug') slug: string) {
        return this.service.getPublicEvent(slug);
    }

    @Post('reservations/hold')
    async holdReservation(@Body() dto: HoldReservationDto, @Req() req: Request) {
        return this.bg3.guard(
            {
                req,
                scope: 'public.reservations.hold',
                routeMethod: 'POST',
                routePath: '/api/public/reservations/hold',
                category: BG3_CATEGORY.PUBLIC_BOOKING,
                idempotencyMode: 'optional',
                fingerprintSource: dto,
                orgId: null,
                actorUserId: null,
            },
            () => this.service.holdReservation(dto),
        );
    }

    @Post('reservations/confirm')
    async confirmReservation(@Body() dto: ConfirmReservationDto, @Req() req: Request) {
        return this.bg3.guard(
            {
                req,
                scope: 'public.reservations.confirm',
                routeMethod: 'POST',
                routePath: '/api/public/reservations/confirm',
                category: BG3_CATEGORY.PUBLIC_BOOKING,
                idempotencyMode: 'optional',
                fingerprintSource: dto,
                orgId: null,
                actorUserId: null,
            },
            () => this.service.confirmReservation(dto),
        );
    }

    @Post('event-bookings/hold')
    async holdEventBooking(@Body() dto: HoldEventBookingDto, @Req() req: Request) {
        return this.bg3.guard(
            {
                req,
                scope: 'public.event-bookings.hold',
                routeMethod: 'POST',
                routePath: '/api/public/event-bookings/hold',
                category: BG3_CATEGORY.PUBLIC_BOOKING,
                idempotencyMode: 'optional',
                fingerprintSource: dto,
                orgId: null,
                actorUserId: null,
            },
            () => this.service.holdEventBooking(dto),
        );
    }

    @Post('event-bookings/confirm')
    async confirmEventBooking(@Body() dto: ConfirmEventBookingDto, @Req() req: Request) {
        return this.bg3.guard(
            {
                req,
                scope: 'public.event-bookings.confirm',
                routeMethod: 'POST',
                routePath: '/api/public/event-bookings/confirm',
                category: BG3_CATEGORY.PUBLIC_BOOKING,
                idempotencyMode: 'optional',
                fingerprintSource: dto,
                orgId: null,
                actorUserId: null,
            },
            () => this.service.confirmEventBooking(dto),
        );
    }
}
