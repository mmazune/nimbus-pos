import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma';
import { DiscountsService } from '../discounts/discounts.service';
import { RefundsService } from '../refunds/refunds.service';
import { AttendanceService } from '../attendance/attendance.service';
import { AccountsPayableService } from '../accounts-payable/accounts-payable.service';
import { FranchiseService } from '../franchise/franchise.service';
import { DecideApprovalDto } from './dto';
import { ApprovalSourceMapping, ApprovalSourceType, findSource } from './approval-source.types';

interface DecideContext {
    userId: string;
    organizationId: string;
    branchId: string;
    ipAddress?: string;
    userAgent?: string;
}

export interface RoutedDecisionResult {
    source: ApprovalSourceType;
    entityId: string;
    finalStatus: string;
    decidedById: string;
    decidedAt: string;
    underlying: unknown;
}

/**
 * BG2 — Approval Routing Service.
 *
 * Sole responsibility: take a normalized DecideApprovalDto and dispatch to
 * the correct underlying domain service. Does NOT replicate validation,
 * threshold checks, or audit emission — those live in each source module.
 *
 * The inbox layer adds its own UNIFIED_APPROVAL_DECIDED audit event ON TOP
 * of the source's own audit event (so a routed decision produces TWO audit
 * rows: e.g. DISCOUNT_APPROVED + UNIFIED_APPROVAL_DECIDED).
 */
@Injectable()
export class ApprovalRoutingService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly discountsService: DiscountsService,
        private readonly refundsService: RefundsService,
        private readonly attendanceService: AttendanceService,
        private readonly accountsPayableService: AccountsPayableService,
        private readonly franchiseService: FranchiseService,
    ) { }

    async route(
        source: ApprovalSourceMapping,
        entityId: string,
        dto: DecideApprovalDto,
        ctx: DecideContext,
    ): Promise<RoutedDecisionResult> {
        if (dto.decision === 'REJECT' && !source.supportsReject) {
            throw new BadRequestException(
                `Reject is not supported for source "${source.type}". Use the underlying domain endpoint or only call approve.`,
            );
        }

        // Verify the entity still exists and is in a pending state.
        const current = await this.loadCurrent(source, entityId, ctx);
        if (!current) {
            throw new NotFoundException(
                `Approval source "${source.type}" with id "${entityId}" not found in your context`,
            );
        }
        if (!source.pendingStatuses.includes(current.status)) {
            throw new ConflictException(
                `Approval "${source.type}:${entityId}" is already ${current.status} and cannot be re-decided`,
            );
        }

        const meta = { ipAddress: ctx.ipAddress, userAgent: ctx.userAgent };
        const branchCtx = { branchId: ctx.branchId, organizationId: ctx.organizationId };
        let underlying: unknown;
        let finalStatus: string;

        switch (source.type) {
            case 'discount': {
                if (dto.decision === 'APPROVE') {
                    underlying = await this.discountsService.approveDiscount(
                        ctx.userId,
                        branchCtx,
                        entityId,
                        { managerPin: dto.managerPin } as never,
                        meta,
                    );
                    finalStatus = 'APPROVED';
                } else {
                    underlying = await this.discountsService.rejectDiscount(
                        ctx.userId,
                        branchCtx,
                        entityId,
                        { rejectionReason: dto.reason ?? 'Rejected via unified approvals inbox' } as never,
                        meta,
                    );
                    finalStatus = 'REJECTED';
                }
                break;
            }

            case 'refund': {
                // Refund only supports approve in M14.
                underlying = await this.refundsService.approveRefund(
                    ctx.userId,
                    branchCtx,
                    entityId,
                    { managerPin: dto.managerPin } as never,
                    meta,
                );
                finalStatus = 'COMPLETED';
                break;
            }

            case 'leave_request': {
                underlying = await this.attendanceService.reviewLeaveRequest(
                    ctx.userId,
                    branchCtx,
                    entityId,
                    {
                        status: dto.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
                        reviewNotes: dto.reason,
                    } as never,
                    meta,
                );
                finalStatus = dto.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
                break;
            }

            case 'shift_swap': {
                underlying = await this.attendanceService.approveShiftSwap(
                    ctx.userId,
                    branchCtx,
                    entityId,
                    {
                        status: dto.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
                        reviewNotes: dto.reason,
                    } as never,
                    meta,
                );
                finalStatus = dto.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
                break;
            }

            case 'vendor_bill': {
                underlying = await this.accountsPayableService.approveVendorBill({
                    orgId: ctx.organizationId,
                    billId: entityId,
                    userId: ctx.userId,
                });
                finalStatus = 'APPROVED';
                break;
            }

            case 'inter_branch_transfer': {
                underlying = await this.franchiseService.updateTransferStatus(
                    ctx.userId,
                    ctx.organizationId,
                    entityId,
                    {
                        status: dto.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
                        rejectionReason: dto.decision === 'REJECT' ? dto.reason : undefined,
                    } as never,
                    meta,
                );
                finalStatus = dto.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
                break;
            }

            default: {
                const _exhaustive: never = source.type;
                throw new BadRequestException(`Unknown approval source: ${String(_exhaustive)}`);
            }
        }

        return {
            source: source.type,
            entityId,
            finalStatus,
            decidedById: ctx.userId,
            decidedAt: new Date().toISOString(),
            underlying,
        };
    }

    /** Load the current row regardless of source type (read-only check). */
    private async loadCurrent(
        source: ApprovalSourceMapping,
        entityId: string,
        ctx: DecideContext,
    ): Promise<{ id: string; status: string } | null> {
        const where: Record<string, unknown> = { id: entityId };
        if (source.type === 'discount' || source.type === 'refund') {
            where.orgId = ctx.organizationId;
            where.branchId = ctx.branchId;
        } else if (source.type === 'shift_swap') {
            where.orgId = ctx.organizationId;
            where.branchId = ctx.branchId;
        } else {
            // org-scoped sources
            where.orgId = ctx.organizationId;
        }
        // Cast to any because each model has different filter shapes; we only
        // need id+status here.
        const model = (this.prisma as unknown as Record<string, { findFirst: Function }>)[
            source.prismaModel
        ];
        const row = (await model.findFirst({
            where,
            select: { id: true, status: true },
        })) as { id: string; status: string } | null;
        return row ?? null;
    }

    /** Look up a pending or already-decided approval by source+id (used by GET detail). */
    async loadDetail(
        source: ApprovalSourceMapping,
        entityId: string,
        ctx: { organizationId: string; branchId?: string },
    ): Promise<Record<string, unknown> | null> {
        const where: Record<string, unknown> = { id: entityId, orgId: ctx.organizationId };
        if (source.branchScoped && ctx.branchId) {
            where.branchId = ctx.branchId;
        }
        const model = (this.prisma as unknown as Record<string, { findFirst: Function }>)[
            source.prismaModel
        ];
        const row = (await model.findFirst({ where })) as Record<string, unknown> | null;
        return row;
    }
}

// Helper to verify we covered every source type at compile time.
const _allSourcesCovered: Record<ApprovalSourceType, true> = {
    discount: true,
    refund: true,
    leave_request: true,
    shift_swap: true,
    vendor_bill: true,
    inter_branch_transfer: true,
};
void _allSourcesCovered;
void findSource;
