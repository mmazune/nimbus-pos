import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { UnifiedApprovalsService } from './unified-approvals.service';
import { DecideApprovalDto, ListApprovalsDto } from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';

/**
 * BG2 — Unified Approvals Inbox.
 *
 * Aggregation + routing layer over discounts, refunds, leave requests,
 * shift swaps, vendor bills, and inter-branch transfers. Does NOT host
 * any approval business logic — it delegates to the source domain.
 */
@Controller('approvals')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class UnifiedApprovalsController {
    constructor(private readonly approvals: UnifiedApprovalsService) { }

    @Get()
    @Permissions('approvals:read')
    async list(
        @Query() query: ListApprovalsDto,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = (req as { branchContext?: { branchId: string; organizationId: string } })
            .branchContext!;
        return this.approvals.list(
            {
                userId: user.id,
                organizationId: ctx.organizationId,
                branchId: ctx.branchId,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            },
            query,
        );
    }

    @Get(':id')
    @Permissions('approvals:read')
    async detail(
        @Param('id') id: string,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = (req as { branchContext?: { branchId: string; organizationId: string } })
            .branchContext!;
        return this.approvals.detail(
            {
                userId: user.id,
                organizationId: ctx.organizationId,
                branchId: ctx.branchId,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            },
            id,
        );
    }

    @Post(':id/decide')
    @HttpCode(HttpStatus.OK)
    @Permissions('approvals:decide')
    async decide(
        @Param('id') id: string,
        @Body() dto: DecideApprovalDto,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = (req as { branchContext?: { branchId: string; organizationId: string } })
            .branchContext!;
        return this.approvals.decide(
            {
                userId: user.id,
                organizationId: ctx.organizationId,
                branchId: ctx.branchId,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            },
            id,
            dto,
        );
    }
}
