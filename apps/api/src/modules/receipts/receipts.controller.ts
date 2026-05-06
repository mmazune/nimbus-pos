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
import { ReceiptsService } from './receipts.service';
import { ReprintReceiptDto, SendReceiptDto, ReceiptHistoryQueryDto } from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';
import { Bg3ReliabilityService } from '../bg3-reliability';

/**
 * BG4.A — Receipts surface.
 *
 * Receipt id == orderId (closed Orders are the receipt). All routes
 * are branch-scoped via BranchContextGuard so cross-branch leakage is
 * prevented. Reprint and Send are wrapped by the BG3 facade so
 * Idempotency-Key is duplicate-safe (optional header). No maintenance
 * category is attached because receipt operations are read/notify-only;
 * no real billing mutation occurs.
 */
@Controller('receipts')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class ReceiptsController {
    constructor(
        private readonly receipts: ReceiptsService,
        private readonly bg3: Bg3ReliabilityService,
    ) { }

    @Get(':id')
    @Permissions('pos:receipt:read')
    async getReceipt(
        @Param('id') id: string,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = (req as { branchContext?: { branchId: string; organizationId: string } })
            .branchContext!;
        return this.receipts.getReceipt(ctx, id, {
            userId: user.id,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });
    }

    @Get(':id/history')
    @Permissions('pos:receipt:read')
    async getHistory(
        @Param('id') id: string,
        @Query() query: ReceiptHistoryQueryDto,
        @Req() req: Request,
    ) {
        const ctx = (req as { branchContext?: { branchId: string; organizationId: string } })
            .branchContext!;
        return this.receipts.getReceiptHistory(ctx, id, query);
    }

    @Post(':id/reprint')
    @HttpCode(HttpStatus.OK)
    @Permissions('pos:receipt:reprint')
    async reprint(
        @Param('id') id: string,
        @Body() dto: ReprintReceiptDto,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = (req as { branchContext?: { branchId: string; organizationId: string } })
            .branchContext!;
        return this.bg3.guard(
            {
                req,
                scope: 'receipts.reprint',
                routeMethod: 'POST',
                routePath: `/api/receipts/${id}/reprint`,
                category: null,
                idempotencyMode: 'optional',
                fingerprintSource: { id, dto },
                actorUserId: user.id,
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
            },
            () =>
                this.receipts.reprintReceipt(ctx, id, dto, {
                    userId: user.id,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                }),
        );
    }

    @Post(':id/send')
    @HttpCode(HttpStatus.ACCEPTED)
    @Permissions('pos:receipt:send')
    async send(
        @Param('id') id: string,
        @Body() dto: SendReceiptDto,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = (req as { branchContext?: { branchId: string; organizationId: string } })
            .branchContext!;
        return this.bg3.guard(
            {
                req,
                scope: 'receipts.send',
                routeMethod: 'POST',
                routePath: `/api/receipts/${id}/send`,
                category: null,
                idempotencyMode: 'optional',
                fingerprintSource: { id, dto },
                actorUserId: user.id,
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
            },
            () =>
                this.receipts.sendReceipt(ctx, id, dto, {
                    userId: user.id,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                }),
        );
    }
}
