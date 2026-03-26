import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { ShiftStatus, TillSessionStatus, PaymentMethod, OrderStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { OpenShiftDto, CloseShiftDto } from './dto';

interface BranchContext {
  branchId: string;
  organizationId: string;
}

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class ShiftsService {
  private readonly logger = new Logger(ShiftsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async openShift(userId: string, ctx: BranchContext, dto: OpenShiftDto, meta: RequestMeta) {
    // Check for existing active shift for this user in this branch
    const existingShift = await this.prisma.shift.findFirst({
      where: {
        branchId: ctx.branchId,
        openedById: userId,
        status: ShiftStatus.OPEN,
      },
    });

    if (existingShift) {
      throw new ConflictException('User already has an active shift in this branch');
    }

    // Generate shift number: SHF-XXXXXX
    const lastShift = await this.prisma.shift.findFirst({
      where: { branchId: ctx.branchId },
      orderBy: { createdAt: 'desc' },
      select: { shiftNumber: true },
    });

    let nextNum = 1;
    if (lastShift?.shiftNumber) {
      const match = lastShift.shiftNumber.match(/SHF-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const shiftNumber = `SHF-${String(nextNum).padStart(6, '0')}`;

    const shift = await this.prisma.shift.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        shiftNumber,
        openedById: userId,
        status: ShiftStatus.OPEN,
        notes: dto.notes || null,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'SHIFT_OPENED',
      entityType: 'Shift',
      entityId: shift.id,
      metadata: { shiftNumber, branchId: ctx.branchId },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return shift;
  }

  async closeShift(
    shiftId: string,
    userId: string,
    ctx: BranchContext,
    dto: CloseShiftDto,
    meta: RequestMeta,
  ) {
    const shift = await this.prisma.shift.findFirst({
      where: {
        id: shiftId,
        branchId: ctx.branchId,
        orgId: ctx.organizationId,
      },
    });

    if (!shift) {
      throw new NotFoundException('Shift not found');
    }

    if (shift.status !== ShiftStatus.OPEN) {
      throw new ConflictException('Shift is not open');
    }

    // Check for unresolved (OPEN) till sessions on this shift
    const openTills = await this.prisma.tillSession.findMany({
      where: {
        shiftId: shift.id,
        status: TillSessionStatus.OPEN,
      },
    });

    if (openTills.length > 0) {
      throw new ConflictException(
        'Cannot close shift — there are unreconciled till sessions. Reconcile and close all tills first.',
      );
    }

    // Generate shift close summary
    const summary = await this.generateShiftCloseSummary(shift.id, userId, ctx);

    // Close the shift
    const closedShift = await this.prisma.shift.update({
      where: { id: shift.id },
      data: {
        status: ShiftStatus.CLOSED,
        closedById: userId,
        closedAt: new Date(),
        notes: dto.notes || shift.notes,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'SHIFT_CLOSED',
      entityType: 'Shift',
      entityId: shift.id,
      metadata: {
        shiftNumber: shift.shiftNumber,
        summaryId: summary.id,
        branchId: ctx.branchId,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { ...closedShift, summary };
  }

  async getActiveShift(userId: string, ctx: BranchContext) {
    const shift = await this.prisma.shift.findFirst({
      where: {
        branchId: ctx.branchId,
        openedById: userId,
        status: ShiftStatus.OPEN,
      },
      include: {
        openedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        tillSessions: {
          where: { status: TillSessionStatus.OPEN },
          select: { id: true, tillCode: true, status: true, openingFloat: true },
        },
      },
    });

    return shift;
  }

  async getShiftById(shiftId: string, ctx: BranchContext) {
    const shift = await this.prisma.shift.findFirst({
      where: {
        id: shiftId,
        branchId: ctx.branchId,
        orgId: ctx.organizationId,
      },
      include: {
        openedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        closedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        tillSessions: true,
        closeSummaries: true,
      },
    });

    if (!shift) {
      throw new NotFoundException('Shift not found');
    }

    return shift;
  }

  async getShiftSummary(shiftId: string, ctx: BranchContext) {
    const shift = await this.prisma.shift.findFirst({
      where: {
        id: shiftId,
        branchId: ctx.branchId,
        orgId: ctx.organizationId,
      },
    });

    if (!shift) {
      throw new NotFoundException('Shift not found');
    }

    const summary = await this.prisma.shiftCloseSummary.findFirst({
      where: { shiftId: shift.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!summary) {
      throw new NotFoundException('No close summary found for this shift');
    }

    return summary;
  }

  private async generateShiftCloseSummary(shiftId: string, userId: string, ctx: BranchContext) {
    // Get all till sessions for this shift
    const tillSessions = await this.prisma.tillSession.findMany({
      where: { shiftId },
    });

    // Get payments made during this shift's till sessions' time range
    // We use the shift's openedAt to now (or closedAt) as the time window
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
    });

    const timeStart = shift!.openedAt;
    const timeEnd = new Date();

    // Get completed payments in this branch during the shift window
    const payments = await this.prisma.payment.findMany({
      where: {
        branchId: ctx.branchId,
        orgId: ctx.organizationId,
        status: 'COMPLETED',
        createdAt: { gte: timeStart, lte: timeEnd },
      },
    });

    let grossSales = new Decimal(0);
    let cashSales = new Decimal(0);
    let momoSales = new Decimal(0);
    let cardSales = new Decimal(0);

    for (const p of payments) {
      grossSales = grossSales.add(p.amount);
      if (p.method === PaymentMethod.CASH) cashSales = cashSales.add(p.amount);
      if (p.method === PaymentMethod.MOMO) momoSales = momoSales.add(p.amount);
      if (p.method === PaymentMethod.CARD) cardSales = cardSales.add(p.amount);
    }

    // Get refunds during the shift window
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

    // Get cash movements from all till sessions in this shift
    const cashMovements = await this.prisma.cashMovement.findMany({
      where: {
        shiftId,
      },
    });

    let safeDropTotal = new Decimal(0);
    let pickupTotal = new Decimal(0);
    let paidInTotal = new Decimal(0);
    let paidOutTotal = new Decimal(0);

    for (const m of cashMovements) {
      if (m.type === 'SAFE_DROP') safeDropTotal = safeDropTotal.add(m.amount);
      if (m.type === 'CASH_PICKUP') pickupTotal = pickupTotal.add(m.amount);
      if (m.type === 'PAID_IN') paidInTotal = paidInTotal.add(m.amount);
      if (m.type === 'PAID_OUT') paidOutTotal = paidOutTotal.add(m.amount);
    }

    // Sum opening floats from tills
    let totalOpeningFloat = new Decimal(0);
    for (const t of tillSessions) {
      totalOpeningFloat = totalOpeningFloat.add(t.openingFloat);
    }

    // Expected cash = openingFloat + cashSales + paidIn - safeDrops - pickups - refundCashOut - paidOut
    const expectedCash = totalOpeningFloat
      .add(cashSales)
      .add(paidInTotal)
      .sub(safeDropTotal)
      .sub(pickupTotal)
      .sub(refundCashOut)
      .sub(paidOutTotal);

    // Sum counted cash from reconciled tills
    let countedCash: Decimal | null = null;
    const reconciledTills = tillSessions.filter((t) => t.countedCash !== null);
    if (reconciledTills.length > 0) {
      countedCash = new Decimal(0);
      for (const t of reconciledTills) {
        countedCash = countedCash.add(t.countedCash!);
      }
    }

    const variance = countedCash !== null ? countedCash.sub(expectedCash) : null;

    // Count closed orders during shift
    const ordersClosedCount = await this.prisma.order.count({
      where: {
        branchId: ctx.branchId,
        orgId: ctx.organizationId,
        status: OrderStatus.CLOSED,
        updatedAt: { gte: timeStart, lte: timeEnd },
      },
    });

    const summary = await this.prisma.shiftCloseSummary.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        shiftId,
        generatedById: userId,
        grossSales,
        cashSales,
        momoSales,
        cardSales,
        refundCashOut,
        safeDropTotal,
        pickupTotal,
        expectedCash,
        countedCash,
        variance,
        ordersClosedCount,
        refundsCount: refunds.length,
      },
    });

    return summary;
  }
}
