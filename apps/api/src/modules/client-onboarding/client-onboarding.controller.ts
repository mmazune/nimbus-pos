import {
    Controller,
    Get,
    Post,
    Patch,
    Body,
    Param,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, PermissionGuard } from '../../common/guards';
import { Permissions, CurrentUser } from '../../common/decorators';
import { ClientOnboardingService } from './client-onboarding.service';
import {
    CreateOnboardingOrgDto,
    CreateOnboardingBranchDto,
    UpdateBusinessProfileDto,
    UpdateOnboardingSettingsDto,
    CreateOnboardingInvitationsDto,
    RevokeInvitationDto,
} from './dto';

@Controller('onboarding')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ClientOnboardingController {
    constructor(private readonly onboardingService: ClientOnboardingService) { }

    @Get('status')
    @Permissions('onboarding:read')
    async getStatus(@CurrentUser() user: { id: string }) {
        const ctx = await this.onboardingService.resolveOrgContext(user.id);
        return this.onboardingService.getOnboardingStatus(ctx.organizationId);
    }

    @Post('organization')
    @Permissions('onboarding:write')
    async createOrganization(
        @CurrentUser() user: { id: string },
        @Body() dto: CreateOnboardingOrgDto,
    ) {
        const ctx = await this.onboardingService.resolveOrgContext(user.id);
        return this.onboardingService.createOrganization(ctx.organizationId, dto, user.id);
    }

    @Post('branches')
    @Permissions('onboarding:write')
    async createBranch(
        @CurrentUser() user: { id: string },
        @Body() dto: CreateOnboardingBranchDto,
    ) {
        const ctx = await this.onboardingService.resolveOrgContext(user.id);
        return this.onboardingService.createBranch(ctx.organizationId, dto, user.id);
    }

    @Patch('business-profile')
    @Permissions('onboarding:write')
    async updateBusinessProfile(
        @CurrentUser() user: { id: string },
        @Body() dto: UpdateBusinessProfileDto,
    ) {
        const ctx = await this.onboardingService.resolveOrgContext(user.id);
        return this.onboardingService.updateBusinessProfile(ctx.organizationId, dto, user.id);
    }

    @Patch('settings')
    @Permissions('onboarding:write')
    async updateSettings(
        @CurrentUser() user: { id: string },
        @Body() dto: UpdateOnboardingSettingsDto,
    ) {
        const ctx = await this.onboardingService.resolveOrgContext(user.id);
        return this.onboardingService.updateSettings(ctx.organizationId, dto, user.id);
    }

    @Post('invitations')
    @Permissions('onboarding:write')
    async createInvitations(
        @CurrentUser() user: { id: string },
        @Body() dto: CreateOnboardingInvitationsDto,
    ) {
        const ctx = await this.onboardingService.resolveOrgContext(user.id);
        return this.onboardingService.createInvitations(ctx.organizationId, dto, user.id);
    }

    // ── BG1: Resend / Revoke ──

    @Post('invitations/:id/resend')
    @Permissions('onboarding:invitation:write')
    async resendInvitation(
        @Param('id') invitationId: string,
        @CurrentUser() user: { id: string },
    ) {
        const ctx = await this.onboardingService.resolveOrgContext(user.id);
        return this.onboardingService.resendInvitation(
            ctx.organizationId,
            invitationId,
            user.id,
        );
    }

    @Patch('invitations/:id/revoke')
    @Permissions('onboarding:invitation:write')
    async revokeInvitation(
        @Param('id') invitationId: string,
        @CurrentUser() user: { id: string },
        @Body() dto: RevokeInvitationDto,
    ) {
        const ctx = await this.onboardingService.resolveOrgContext(user.id);
        return this.onboardingService.revokeInvitation(
            ctx.organizationId,
            invitationId,
            user.id,
            dto.reason,
        );
    }
}
