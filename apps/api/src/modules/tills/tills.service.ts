import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import {
    ShiftStatus,
    TillSessionStatus,
    CashMovementType,
    VarianceStatus,
    PaymentMethod,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { OpenTillDto, SafeDropDto, ReconcileTillDto } from './dto';

interface BranchContext {
    branchId: string;
    organizationId: string;
}

interface RequestMeta {
    ipAddress?: string;
    userAgent?: string;
}

@Injectable()
export class TillsService {
    private readonly logger = new Logger(TillsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    async openTill(userId: string, ctx: BranchContext, dto: OpenTillDto, meta: RequestMeta) {
        // Operator must have an active shift in this branch
        const activeShift = await this.prisma.shift.findFirst({
            where: {
                branchId: ctx.branchId,
                openedById: userId,
                status: ShiftStatus.OPEN,
            },
        });

        if (!activeShift) {
            throw new BadRequestException('No active shift found. Open a shift before opening a till.');
        }

        // Check for existing OPEN till session with same tillCode in same branch
        const existingTill = await this.prisma.tillSession.findFirst({
            where: {
                branchId: ctx.branchId,
                tillCode: dto.tillCode,
                status: TillSessionStatus.OPEN,
            },
        });

        if (existingTill) {
            throw new ConflictException(
                `Till "${dto.tillCode}" already has an active session in this branch`,
            );
        }

        const openingFloat = new Decimal(dto.openingFloat);

        const till = await this.prisma.tillSession.create({
            data: {
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
                shiftId: activeShift.id,
                tillCode: dto.tillCode,
                operatorUserId: userId,
                openedById: userId,
                openingFloat,
                expectedCash: openingFloat,
                status: TillSessionStatus.OPEN,
                notes: dto.notes || null,
            },
        });

        // Record OPENING_FLOAT cash movement
        await this.prisma.cashMovement.create({
            data: {
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
                tillSessionId: till.id,
                shiftId: activeShift.id,
                type: CashMovementType.OPENING_FLOAT,
                amount: openingFloat,
                reason: 'Opening float',
                createdById: userId,
            },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'TILL_OPENED',
            entityType: 'TillSession',
            entityId: till.id,
            metadata: {
                tillCode: dto.tillCode,
                openingFloat: openingFloat.toString(),
                shiftId: activeShift.id,
                branchId: ctx.branchId,
            },
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
        });

        return till;
    }

    async safeDrop(
        tillId: string,
        userId: string,
        ctx: BranchContext,
        dto: SafeDropDto,
        meta: RequestMeta,
    ) {
        const till = await this.prisma.tillSession.findFirst({
            where: {
                id: tillId,
                branchId: ctx.branchId,
                orgId: ctx.organizationId,
            },
        });

        if (!till) {
            throw new NotFoundException('Till session not found');
        }

        if (till.status !== TillSessionStatus.OPEN) {
            throw new ConflictException('Safe drop only allowed on an OPEN till session');
        }

        const amount = new Decimal(dto.amount);

        const movement = await this.prisma.cashMovement.create({
            data: {
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
                tillSessionId: till.id,
                shiftId: till.shiftId,
                type: CashMovementType.SAFE_DROP,
                amount,
                reason: dto.reason,
                createdById: userId,
            },
        });

        // Update expected cash on till
        await this.prisma.tillSession.update({
            where: { id: till.id },
            data: {
                expectedCash: { decrement: amount },
            },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'TILL_SAFE_DROP',
            entityType: 'CashMovement',
            entityId: movement.id,
            metadata: {
                tillSessionId: till.id,
                amount: amount.toString(),
                reason: dto.reason,
                branchId: ctx.branchId,
            },
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
        });

        return movement;
    }

    async reconcileTill(
        tillId: string,
        userId: string,
        ctx: BranchContext,
        dto: ReconcileTillDto,
        meta: RequestMeta,
    ) {
        const till = await this.prisma.tillSession.findFirst({
            where: {
                id: tillId,
                branchId: ctx.branchId,
                orgId: ctx.organizationId,
            },
        });

        if (!till) {
            throw new NotFoundException('Till session not found');
        }

        if (till.status !== TillSessionStatus.OPEN) {
            throw new ConflictException('Reconciliation only allowed on an OPEN till session');
        }

        const countedCash = new Decimal(dto.countedCash);

        // Compute expected cash from source data
        const expectedCash = await this.computeExpectedCash(till.id, till.openingFloat, ctx);

        const variance = countedCash.sub(expectedCash);
        const absVariance = variance.abs();

        let varianceStatus: VarianceStatus;
        // Tolerance: 0.01 to account for rounding
        if (absVariance.lte(new Decimal('0.01'))) {
            varianceStatus = VarianceStatus.MATCHED;
        } else if (variance.lt(0)) {
            varianceStatus = VarianceStatus.SHORT;
        } else {
            varianceStatus = VarianceStatus.OVER;
        }

        // Mismatch requires a reason
        if (varianceStatus !== VarianceStatus.MATCHED && !dto.varianceReason) {
            throw new BadRequestException(
                'Variance reason is required when counted cash does not match expected cash',
            );
        }

        const reconciledTill = await this.prisma.tillSession.update({
            where: { id: till.id },
            data: {
                countedCash,
                expectedCash,
                variance,
                varianceStatus,
                status: TillSessionStatus.RECONCILED,
                reconciledAt: new Date(),
                closedById: userId,
                closedAt: new Date(),
                notes: dto.varianceReason
                    ? `${till.notes || ''}\nVariance reason: ${dto.varianceReason}`.trim()
                    : dto.notes || till.notes,
            },
        });

        await this.audit.log({
            actorUserId: userId,
            action: 'TILL_RECONCILED',
            entityType: 'TillSession',
            entityId: till.id,
            metadata: {
                tillCode: till.tillCode,
                expectedCash: expectedCash.toString(),
                countedCash: countedCash.toString(),
                variance: variance.toString(),
                varianceStatus,
                branchId: ctx.branchId,
            },
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
        });

        if (varianceStatus !== VarianceStatus.MATCHED) {
            await this.audit.log({
                actorUserId: userId,
                action: 'TILL_RECONCILE_VARIANCE',
                entityType: 'TillSession',
                entityId: till.id,
                metadata: {
                    tillCode: till.tillCode,
                    varianceStatus,
                    variance: variance.toString(),
                    reason: dto.varianceReason,
                    branchId: ctx.branchId,
                },
                ipAddress: meta.ipAddress,
                userAgent: meta.userAgent,
            });
        }

        return reconciledTill;
    }

    async getActiveTill(userId: string, ctx: BranchContext) {
        const till = await this.prisma.tillSession.findFirst({
            where: {
                branchId: ctx.branchId,
                operatorUserId: userId,
                status: TillSessionStatus.OPEN,
            },
            include: {
                shift: { select: { id: true, shiftNumber: true, status: true } },
            },
        });

        return till;
    }

    async getTillById(tillId: string, ctx: BranchContext) {
        const till = await this.prisma.tillSession.findFirst({
            where: {
                id: tillId,
                branchId: ctx.branchId,
                orgId: ctx.organizationId,
            },
            include: {
                operatorUser: { select: { id: true, firstName: true, lastName: true, email: true } },
                openedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
                closedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
                cashMovements: { orderBy: { createdAt: 'asc' } },
                shift: { select: { id: true, shiftNumber: true, status: true } },
            },
        });

        if (!till) {
            throw new NotFoundException('Till session not found');
        }

        return till;
    }

    async getTillSummary(tillId: string, ctx: BranchContext) {
        const till = await this.getTillById(tillId, ctx);

        const expectedCash = await this.computeExpectedCash(till.id, till.openingFloat, ctx);

        return {
            ...till,
            computedExpectedCash: expectedCash.toString(),
        };
    }

    /**
     * Check if there is an active till session for a given branch.
     * Used as a policy hook for cash payment acceptance.
     */
    async hasActiveTillInBranch(ctx: BranchContext): Promise<boolean> {
        const till = await this.prisma.tillSession.findFirst({
            where: {
                branchId: ctx.branchId,
                orgId: ctx.organizationId,
                status: TillSessionStatus.OPEN,
            },
            select: { id: true },
        });
        return !!till;
    }

    /**
     * Compute expected cash for a till session.
     *
     * expectedCash = openingFloat + cashSales + paidIn - safeDrops - cashPickups - refundCashOut - paidOut
     *
     * Data sources:
     * - openingFloat: from TillSession record (immutable after open)
     * - cashSales: completed CASH payments in the branch during the till session's open period
     * - paidIn: CashMovement rows of type PAID_IN for this till session
     * - safeDrops: CashMovement rows of type SAFE_DROP for this till session
     * - cashPickups: CashMovement rows of type CASH_PICKUP for this till session
     * - refundCashOut: completed refunds in the branch during the till session's open period
     *   (assumes cash refunds — all refunds counted for simplicity since provider tracking is pending)
     * - paidOut: CashMovement rows of type PAID_OUT for this till session
     */
    async computeExpectedCash(
        tillSessionId: string,
        openingFloat: Decimal | number | string,
        ctx: BranchContext,
    ): Promise<Decimal> {
        const till = await this.prisma.tillSession.findUnique({
            where: { id: tillSessionId },
        });

        if (!till) {
            return new Decimal(openingFloat);
        }

        const timeStart = till.openedAt;
        const timeEnd = till.closedAt || new Date();

        // Cash payments in this branch during till window
        const cashPayments = await this.prisma.payment.findMany({
            where: {
                branchId: ctx.branchId,
                orgId: ctx.organizationId,
                method: PaymentMethod.CASH,
                status: 'COMPLETED',
                createdAt: { gte: timeStart, lte: timeEnd },
            },
        });

        let cashSales = new Decimal(0);
        for (const p of cashPayments) {
            cashSales = cashSales.add(p.amount);
        }

        // Cash movements for this till
        const movements = await this.prisma.cashMovement.findMany({
            where: { tillSessionId },
        });

        let paidIn = new Decimal(0);
        let safeDrops = new Decimal(0);
        let cashPickups = new Decimal(0);
        let paidOut = new Decimal(0);
        let refundPayout = new Decimal(0);

        for (const m of movements) {
            switch (m.type) {
                case CashMovementType.PAID_IN:
                    paidIn = paidIn.add(m.amount);
                    break;
                case CashMovementType.SAFE_DROP:
                    safeDrops = safeDrops.add(m.amount);
                    break;
                case CashMovementType.CASH_PICKUP:
                    cashPickups = cashPickups.add(m.amount);
                    break;
                case CashMovementType.PAID_OUT:
                    paidOut = paidOut.add(m.amount);
                    break;
                case CashMovementType.REFUND_PAYOUT:
                    refundPayout = refundPayout.add(m.amount);
                    break;
            }
        }

        // Completed refunds in this branch during the till period
        // Note: This counts all refund amounts. In a future milestone, filter by cash-method refunds only.
        const refunds = await this.prisma.refund.findMany({
            where: {
                branchId: ctx.branchId,
                orgId: ctx.organizationId,
                status: 'COMPLETED',
                createdAt: { gte: timeStart, lte: timeEnd },
            },
        });

        let refundCashOut = new Decimal(0);
        for (const r of refunds) {
            refundCashOut = refundCashOut.add(r.amount);
        }

        // expectedCash = openingFloat + cashSales + paidIn - safeDrops - cashPickups - refundCashOut - refundPayout - paidOut
        return new Decimal(openingFloat)
            .add(cashSales)
            .add(paidIn)
            .sub(safeDrops)
            .sub(cashPickups)
            .sub(refundCashOut)
            .sub(refundPayout)
            .sub(paidOut);
    }
}
