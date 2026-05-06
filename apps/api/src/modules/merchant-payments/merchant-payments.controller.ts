import {
    Controller,
    Post,
    Patch,
    Get,
    Body,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, PermissionGuard } from '../../common/guards';
import { Permissions, CurrentUser } from '../../common/decorators';
import { MerchantPaymentsService } from './merchant-payments.service';
import { ConnectMerchantPaymentDto, UpdateMerchantPaymentConfigDto } from './dto';

/**
 * Merchant Payment Connectivity controller.
 *
 * AUDIENCE: restaurant owners / managers configuring whether their venue
 *           plans to accept public-diner payments via mobile money.
 *
 * THIS IS NOT a live PesaPal integration. PesaPal is reserved for the
 * Nimbus SaaS subscription billing flow (see `billing-pesapal/`).
 *
 * The endpoints under `/merchant/payments/pesapal/...` are kept ONLY for
 * backward-compatibility with the previous M39 reconstruction collection.
 * They behave identically to the generic endpoints below and DO NOT
 * provision a real PesaPal merchant account.
 *
 * Generic endpoints (preferred going forward):
 *   POST  /merchant/payments/connect
 *   PATCH /merchant/payments/config
 *   GET   /merchant/payments/status
 */
@Controller('merchant/payments')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class MerchantPaymentsController {
    constructor(private readonly merchantPaymentsService: MerchantPaymentsService) { }

    // ── Generic (preferred) ──

    @Post('connect')
    @Permissions('merchant:payment:write')
    async connect(
        @CurrentUser() user: { id: string },
        @Body() dto: ConnectMerchantPaymentDto,
    ) {
        const ctx = await this.merchantPaymentsService.resolveOrgContext(user.id);
        return this.merchantPaymentsService.connect(ctx.organizationId, dto, user.id);
    }

    @Patch('config')
    @Permissions('merchant:payment:write')
    async updateConfigGeneric(
        @CurrentUser() user: { id: string },
        @Body() dto: UpdateMerchantPaymentConfigDto,
    ) {
        const ctx = await this.merchantPaymentsService.resolveOrgContext(user.id);
        return this.merchantPaymentsService.updateConfig(ctx.organizationId, dto, user.id);
    }

    @Get('status')
    @Permissions('merchant:payment:read')
    async getStatus(@CurrentUser() user: { id: string }) {
        const ctx = await this.merchantPaymentsService.resolveOrgContext(user.id);
        return this.merchantPaymentsService.getStatus(ctx.organizationId);
    }

    // ── Legacy aliases (kept for backward compatibility — DO NOT advertise as PesaPal) ──

    /**
     * @deprecated Use POST /merchant/payments/connect instead.
     * This route does NOT provision a real PesaPal merchant account.
     * It only records readiness; behaviour is identical to the generic endpoint.
     */
    @Post('pesapal/connect')
    @Permissions('merchant:payment:write')
    async legacyConnect(
        @CurrentUser() user: { id: string },
        @Body() dto: ConnectMerchantPaymentDto,
    ) {
        return this.connect(user, dto);
    }

    /**
     * @deprecated Use PATCH /merchant/payments/config instead.
     */
    @Patch('pesapal/config')
    @Permissions('merchant:payment:write')
    async legacyUpdateConfig(
        @CurrentUser() user: { id: string },
        @Body() dto: UpdateMerchantPaymentConfigDto,
    ) {
        return this.updateConfigGeneric(user, dto);
    }
}
