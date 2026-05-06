import {
    Controller,
    Post,
    Get,
    Query,
    Body,
    UseGuards,
    HttpCode,
    Req,
} from '@nestjs/common';
import { JwtAuthGuard, PermissionGuard } from '../../common/guards';
import { Permissions, CurrentUser } from '../../common/decorators';
import { BillingPesapalService } from './billing-pesapal.service';
import { CreateCheckoutSessionDto, ReconcileStatusDto } from './dto';

@Controller()
export class BillingPesapalController {
    constructor(private readonly pesapalService: BillingPesapalService) {}

    @Post('billing/pesapal/checkout-session')
    @UseGuards(JwtAuthGuard, PermissionGuard)
    @Permissions('billing:pesapal:checkout')
    async createCheckoutSession(
        @CurrentUser() user: { id: string },
        @Body() dto: CreateCheckoutSessionDto,
    ) {
        const ctx = await this.pesapalService.resolveOrgContext(user.id);
        return this.pesapalService.createCheckoutSession(ctx.organizationId, dto, user.id);
    }

    @Get('billing/pesapal/callback')
    async handleCallback(
        @Query('OrderTrackingId') orderTrackingId: string,
        @Query('OrderMerchantReference') _merchantRef: string,
        @Query('pesapal_transaction_tracking_id') pesapalTxnId: string,
    ) {
        return this.pesapalService.handleCallback(orderTrackingId, pesapalTxnId);
    }

    @Post('billing/pesapal/ipn')
    @HttpCode(200)
    async handleIpn(@Body() body: Record<string, unknown>) {
        return this.pesapalService.handleIpn(body);
    }

    @Post('billing/pesapal/reconcile-status')
    @HttpCode(200)
    @UseGuards(JwtAuthGuard, PermissionGuard)
    @Permissions('billing:pesapal:checkout')
    async reconcileStatus(
        @CurrentUser() user: { id: string },
        @Body() dto: ReconcileStatusDto,
    ) {
        return this.pesapalService.reconcileStatus(dto, user.id);
    }
}
