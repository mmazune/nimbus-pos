import {
    Controller,
    Get,
    Post,
    Patch,
    Body,
    Param,
    UseGuards,
    HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard, PermissionGuard } from '../../common/guards';
import { Permissions, CurrentUser } from '../../common/decorators';
import { OpsPortalService } from './ops-portal.service';
import {
    CreateOpsSupportSessionDto,
    CloseOpsSupportSessionDto,
    CreateOpsPlanDto,
    UpdateOpsPlanDto,
    UpdateOpsPlanStatusDto,
} from './dto';

@Controller('ops')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class OpsPortalController {
    constructor(private readonly opsService: OpsPortalService) { }

    @Get('customers')
    @Permissions('ops:customers:read')
    async listCustomers() {
        return this.opsService.listCustomers();
    }

    @Get('customers/:orgId')
    @Permissions('ops:customers:read')
    async getCustomerDetail(@Param('orgId') orgId: string) {
        return this.opsService.getCustomerDetail(orgId);
    }

    @Get('subscriptions/due')
    @Permissions('ops:subscriptions:read')
    async getSubscriptionsDue() {
        return this.opsService.getSubscriptionsDue();
    }

    @Get('subscriptions/grace-period')
    @Permissions('ops:subscriptions:read')
    async getSubscriptionsGracePeriod() {
        return this.opsService.getSubscriptionsGracePeriod();
    }

    @Get('onboarding/pipeline')
    @Permissions('ops:onboarding:read')
    async getOnboardingPipeline() {
        return this.opsService.getOnboardingPipeline();
    }

    @Get('merchant-payments/status')
    @Permissions('ops:merchant-payments:read')
    async getMerchantPaymentsStatus() {
        return this.opsService.getMerchantPaymentsStatus();
    }

    @Get('support/sessions')
    @Permissions('ops:support:read')
    async listSupportSessions() {
        return this.opsService.listSupportSessions();
    }

    @Post('support/sessions')
    @Permissions('ops:support:write')
    async createSupportSession(
        @CurrentUser() user: { id: string },
        @Body() dto: CreateOpsSupportSessionDto,
    ) {
        return this.opsService.createSupportSession(dto, user.id);
    }

    @Patch('support/sessions/:id/close')
    @Permissions('ops:support:write')
    async closeSupportSession(
        @CurrentUser() user: { id: string },
        @Param('id') id: string,
        @Body() dto: CloseOpsSupportSessionDto,
    ) {
        return this.opsService.closeSupportSession(id, dto, user.id);
    }

    // ──────────────────────────────────────────────────────────────────
    // M39 Plan-Catalog Correction — Internal plan administration
    // ──────────────────────────────────────────────────────────────────
    // Reserved for Nimbus internal admins. Lets ops staff edit plan
    // names, prices, location caps, status, and commercial wording
    // without a deploy. All endpoints are guarded by `ops:plans:read`
    // (read) or `ops:plans:write` (write).

    @Get('plans')
    @Permissions('ops:plans:read')
    async listPlans() {
        return this.opsService.listPlans();
    }

    @Post('plans')
    @Permissions('ops:plans:write')
    async createPlan(
        @CurrentUser() user: { id: string },
        @Body() dto: CreateOpsPlanDto,
    ) {
        return this.opsService.createPlan(dto, user.id);
    }

    @Patch('plans/:id')
    @Permissions('ops:plans:write')
    async updatePlan(
        @CurrentUser() user: { id: string },
        @Param('id') id: string,
        @Body() dto: UpdateOpsPlanDto,
    ) {
        return this.opsService.updatePlan(id, dto, user.id);
    }

    @Patch('plans/:id/status')
    @Permissions('ops:plans:write')
    async updatePlanStatus(
        @CurrentUser() user: { id: string },
        @Param('id') id: string,
        @Body() dto: UpdateOpsPlanStatusDto,
    ) {
        return this.opsService.updatePlanStatus(id, dto, user.id);
    }

    @Get('plans/:id/subscribers')
    @Permissions('ops:plans:read')
    async listPlanSubscribers(@Param('id') id: string) {
        return this.opsService.listPlanSubscribers(id);
    }
}
