import {
    Controller,
    Post,
    Get,
    Body,
    Query,
    HttpCode,
} from '@nestjs/common';
import { PublicCommercePaymentsService } from './public-commerce-payments.service';
import {
    CreateReservationCheckoutDto,
    CreateEventBookingCheckoutDto,
    PublicPaymentReconcileDto,
} from './dto';

/**
 * Public commerce payment endpoints — SCAFFOLD ONLY (NOT LIVE).
 *
 * Audience: public diners booking reservations / event tickets.
 *
 * These endpoints define the contract for future MTN / Airtel mobile-money
 * integration. They are NOT PesaPal — PesaPal in this codebase is reserved
 * exclusively for owner SaaS subscription billing (see `billing-pesapal/`).
 *
 * Until mobile-money integration is finalised, every endpoint here returns
 * a uniform response of:
 *   { status: "PENDING_INTEGRATION", provider: "MOBILE_MONEY", message: "..." }
 *
 * Do NOT describe these endpoints as live PesaPal checkout in any docs,
 * Postman descriptions, or completion reports.
 */
@Controller('public/payments')
export class PublicCommercePaymentsController {
    constructor(private readonly service: PublicCommercePaymentsService) { }

    @Post('reservations/checkout-session')
    async createReservationCheckout(@Body() dto: CreateReservationCheckoutDto) {
        return this.service.createReservationCheckout(dto);
    }

    @Post('event-bookings/checkout-session')
    async createEventBookingCheckout(@Body() dto: CreateEventBookingCheckoutDto) {
        return this.service.createEventBookingCheckout(dto);
    }

    @Get('callback')
    async handleCallback(@Query('OrderTrackingId') orderTrackingId: string) {
        return this.service.handleCallback(orderTrackingId);
    }

    @Post('ipn')
    @HttpCode(200)
    async handleIpn(@Body() body: Record<string, unknown>) {
        return this.service.handleIpn(body);
    }

    @Post('reconcile-status')
    @HttpCode(200)
    async reconcileStatus(@Body() dto: PublicPaymentReconcileDto) {
        return this.service.reconcileStatus(dto);
    }
}
