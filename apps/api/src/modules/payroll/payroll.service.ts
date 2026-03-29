import {
    Injectable,
    BadRequestException,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import {
    CreatePayComponentDto,
    CreatePayrollAdjustmentDto,
    BuildPayRunDto,
    ApprovePayRunDto,
    PayPayRunDto,
    ListPayRunsQueryDto,
} from './dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class PayrollService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    // ── Pay Components ──

    async createPayComponent(
        userId: string,
        ctx: { branchId: string; organizationId: string },
        dto: CreatePayComponentDto,
        auditMeta?: { ipAddress?: string; userAgent?: string },
    ) {
        const { organizationId: orgId, branchId } = ctx;

        const existing = await this.prisma.payComponent.findUnique({
            where: { orgId_code: { orgId, code: dto.code } },
        });
        if (existing) {
            throw new ConflictException(`Pay component with code "${dto.code}" already exists`);
        }

        const record = await this.prisma.payComponent.create({
            data: {
                orgId,
                branchId,
                code: dto.code,
                name: dto.name,
                componentType: dto.componentType,
                calculationMethod: dto.calculationMethod,
                defaultAmount: dto.defaultAmount,
                taxable: dto.taxable ?? false,
                active: dto.active ?? true,
            },
        });

        await this.audit.log({
            action: 'PAY_COMPONENT_CREATED',
            actorUserId: userId,
            entityType: 'PayComponent',
            entityId: record.id,
            metadata: { code: dto.code, name: dto.name, orgId, branchId, ...auditMeta },
            ipAddress: auditMeta?.ipAddress,
            userAgent: auditMeta?.userAgent,
        });

        return record;
    }

    async listPayComponents(ctx: { branchId: string; organizationId: string }) {
        const { organizationId: orgId, branchId } = ctx;

        return this.prisma.payComponent.findMany({
            where: {
                orgId,
                OR: [{ branchId }, { branchId: null }],
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    // ── Payroll Adjustments ──

    async createPayrollAdjustment(
        userId: string,
        ctx: { branchId: string; organizationId: string },
        dto: CreatePayrollAdjustmentDto,
        auditMeta?: { ipAddress?: string; userAgent?: string },
    ) {
        const { organizationId: orgId, branchId } = ctx;

        // Validate employee
        const employee = await this.prisma.employee.findFirst({
            where: { id: dto.employeeId, orgId },
        });
        if (!employee) {
            throw new NotFoundException(`Employee "${dto.employeeId}" not found in this organization`);
        }

        // Validate pay component if provided
        if (dto.payComponentId) {
            const comp = await this.prisma.payComponent.findFirst({
                where: { id: dto.payComponentId, orgId },
            });
            if (!comp) {
                throw new NotFoundException(`Pay component "${dto.payComponentId}" not found`);
            }
        }

        const record = await this.prisma.payrollAdjustment.create({
            data: {
                orgId,
                branchId,
                employeeId: dto.employeeId,
                payComponentId: dto.payComponentId,
                adjustmentType: dto.adjustmentType,
                amount: dto.amount,
                effectiveDate: new Date(dto.effectiveDate),
                notes: dto.notes,
                createdById: userId,
            },
            include: { employee: true, payComponent: true },
        });

        await this.audit.log({
            action: 'PAYROLL_ADJUSTMENT_CREATED',
            actorUserId: userId,
            entityType: 'PayrollAdjustment',
            entityId: record.id,
            metadata: {
                employeeId: dto.employeeId,
                adjustmentType: dto.adjustmentType,
                amount: dto.amount,
                orgId,
                branchId,
                ...auditMeta,
            },
            ipAddress: auditMeta?.ipAddress,
            userAgent: auditMeta?.userAgent,
        });

        return record;
    }

    async listPayrollAdjustments(
        ctx: { branchId: string; organizationId: string },
        query: { employeeId?: string; skip?: number; take?: number },
    ) {
        const { organizationId: orgId, branchId } = ctx;
        const where: Prisma.PayrollAdjustmentWhereInput = {
            orgId,
            OR: [{ branchId }, { branchId: null }],
        };

        if (query.employeeId) where.employeeId = query.employeeId;

        const [data, total] = await Promise.all([
            this.prisma.payrollAdjustment.findMany({
                where,
                include: { employee: true, payComponent: true, createdBy: true },
                orderBy: { createdAt: 'desc' },
                skip: Number(query.skip) || 0,
                take: Number(query.take) || 50,
            }),
            this.prisma.payrollAdjustment.count({ where }),
        ]);

        return { data, total };
    }

    // ── Pay Runs ──

    async buildPayRun(
        userId: string,
        ctx: { branchId: string; organizationId: string },
        dto: BuildPayRunDto,
        auditMeta?: { ipAddress?: string; userAgent?: string },
    ) {
        const { organizationId: orgId, branchId } = ctx;

        const periodStart = new Date(dto.periodStart);
        const periodEnd = new Date(dto.periodEnd);
        if (periodEnd < periodStart) {
            throw new BadRequestException('periodEnd must be on or after periodStart');
        }

        // Check overlapping pay run
        const overlap = await this.prisma.payRun.findFirst({
            where: {
                orgId,
                branchId,
                status: { not: 'CANCELLED' },
                periodStart: { lte: periodEnd },
                periodEnd: { gte: periodStart },
            },
        });
        if (overlap) {
            throw new ConflictException(
                `Pay run "${overlap.name}" already covers an overlapping period (${overlap.periodStart.toISOString().split('T')[0]} to ${overlap.periodEnd.toISOString().split('T')[0]})`,
            );
        }

        // Find employees for this pay run
        const empWhere: Prisma.EmployeeWhereInput = {
            orgId,
            status: 'ACTIVE',
        };
        if (branchId) {
            empWhere.OR = [{ branchId }, { branchId: null }];
        }
        if (dto.employeeIds?.length) {
            empWhere.id = { in: dto.employeeIds };
        }

        const employees = await this.prisma.employee.findMany({
            where: empWhere,
            include: { compensationProfile: true },
        });

        if (!employees.length) {
            throw new BadRequestException('No active employees found for this pay run');
        }

        // Fetch active pay components for the org
        const components = await this.prisma.payComponent.findMany({
            where: {
                orgId,
                active: true,
                OR: [{ branchId }, { branchId: null }],
            },
        });

        // Fetch adjustments effective in this period
        const adjustments = await this.prisma.payrollAdjustment.findMany({
            where: {
                orgId,
                effectiveDate: { gte: periodStart, lte: periodEnd },
                OR: [{ branchId }, { branchId: null }],
            },
            include: { payComponent: true },
        });

        // Build payslips
        let runGrossTotal = new Prisma.Decimal(0);
        let runNetTotal = new Prisma.Decimal(0);
        const paySlipData: Array<{
            orgId: string;
            branchId: string | null;
            employeeId: string;
            grossPay: Prisma.Decimal;
            totalDeductions: Prisma.Decimal;
            netPay: Prisma.Decimal;
            componentSnapshot: any;
        }> = [];

        for (const emp of employees) {
            const empAdjustments = adjustments.filter((a) => a.employeeId === emp.id);

            // Calculate gross from compensation profile
            let basePay = new Prisma.Decimal(0);
            if (emp.compensationProfile?.baseAmount) {
                basePay = new Prisma.Decimal(emp.compensationProfile.baseAmount.toString());
            }

            // Add earnings from components (defaults)
            let earningsFromComponents = new Prisma.Decimal(0);
            const earningComponents = components.filter(
                (c) => c.componentType === 'EARNING' && c.defaultAmount,
            );
            for (const ec of earningComponents) {
                earningsFromComponents = earningsFromComponents.add(
                    new Prisma.Decimal(ec.defaultAmount!.toString()),
                );
            }

            // Add earnings from adjustments (BONUS, OVERTIME)
            let earningsFromAdj = new Prisma.Decimal(0);
            let deductionsFromAdj = new Prisma.Decimal(0);
            for (const adj of empAdjustments) {
                const amt = new Prisma.Decimal(adj.amount.toString());
                if (adj.adjustmentType === 'BONUS' || adj.adjustmentType === 'OVERTIME') {
                    earningsFromAdj = earningsFromAdj.add(amt);
                } else if (
                    adj.adjustmentType === 'DEDUCTION' ||
                    adj.adjustmentType === 'PENALTY' ||
                    adj.adjustmentType === 'ADVANCE'
                ) {
                    deductionsFromAdj = deductionsFromAdj.add(amt);
                }
            }

            // Deductions from components
            let deductionsFromComponents = new Prisma.Decimal(0);
            const deductionComponents = components.filter(
                (c) => c.componentType === 'DEDUCTION' && c.defaultAmount,
            );
            for (const dc of deductionComponents) {
                deductionsFromComponents = deductionsFromComponents.add(
                    new Prisma.Decimal(dc.defaultAmount!.toString()),
                );
            }

            const grossPay = basePay.add(earningsFromComponents).add(earningsFromAdj);
            const totalDeductions = deductionsFromComponents.add(deductionsFromAdj);
            const netPay = grossPay.sub(totalDeductions);

            const snapshot = {
                basePay: basePay.toString(),
                earningComponents: earningComponents.map((c) => ({
                    id: c.id,
                    code: c.code,
                    name: c.name,
                    amount: c.defaultAmount?.toString(),
                })),
                deductionComponents: deductionComponents.map((c) => ({
                    id: c.id,
                    code: c.code,
                    name: c.name,
                    amount: c.defaultAmount?.toString(),
                })),
                adjustments: empAdjustments.map((a) => ({
                    id: a.id,
                    type: a.adjustmentType,
                    amount: a.amount.toString(),
                    payComponentCode: a.payComponent?.code ?? null,
                })),
                grossPay: grossPay.toString(),
                totalDeductions: totalDeductions.toString(),
                netPay: netPay.toString(),
            };

            paySlipData.push({
                orgId,
                branchId,
                employeeId: emp.id,
                grossPay,
                totalDeductions,
                netPay,
                componentSnapshot: snapshot,
            });

            runGrossTotal = runGrossTotal.add(grossPay);
            runNetTotal = runNetTotal.add(netPay);
        }

        // Create pay run + payslips in a transaction
        const payRun = await this.prisma.$transaction(async (tx) => {
            const run = await tx.payRun.create({
                data: {
                    orgId,
                    branchId,
                    name: dto.name,
                    periodStart,
                    periodEnd,
                    status: 'DRAFT',
                    builtById: userId,
                    employeeCount: employees.length,
                    grossTotal: runGrossTotal,
                    netTotal: runNetTotal,
                    notes: dto.notes,
                },
            });

            if (paySlipData.length) {
                await tx.paySlip.createMany({
                    data: paySlipData.map((ps) => ({
                        ...ps,
                        payRunId: run.id,
                    })),
                });
            }

            return tx.payRun.findUnique({
                where: { id: run.id },
                include: { paySlips: { include: { employee: true } } },
            });
        });

        await this.audit.log({
            action: 'PAY_RUN_BUILT',
            actorUserId: userId,
            entityType: 'PayRun',
            entityId: payRun!.id,
            metadata: {
                name: dto.name,
                periodStart: dto.periodStart,
                periodEnd: dto.periodEnd,
                employeeCount: employees.length,
                grossTotal: runGrossTotal.toString(),
                netTotal: runNetTotal.toString(),
                orgId,
                branchId,
                ...auditMeta,
            },
            ipAddress: auditMeta?.ipAddress,
            userAgent: auditMeta?.userAgent,
        });

        return payRun;
    }

    async approvePayRun(
        userId: string,
        ctx: { branchId: string; organizationId: string },
        id: string,
        dto: ApprovePayRunDto,
        auditMeta?: { ipAddress?: string; userAgent?: string },
    ) {
        const { organizationId: orgId, branchId } = ctx;

        const existing = await this.prisma.payRun.findFirst({
            where: { id, orgId, branchId },
        });
        if (!existing) {
            throw new NotFoundException(`Pay run "${id}" not found`);
        }
        if (existing.status !== 'DRAFT') {
            throw new BadRequestException(
                `Only DRAFT pay runs can be approved (current: ${existing.status})`,
            );
        }

        const record = await this.prisma.$transaction(async (tx) => {
            const run = await tx.payRun.update({
                where: { id },
                data: {
                    status: 'APPROVED',
                    approvedById: userId,
                    approvedAt: new Date(),
                    notes: dto.notes ?? existing.notes,
                },
                include: { paySlips: { include: { employee: true } } },
            });

            // Freeze payslips to FINAL
            await tx.paySlip.updateMany({
                where: { payRunId: id },
                data: { status: 'FINAL' },
            });

            return run;
        });

        await this.audit.log({
            action: 'PAY_RUN_APPROVED',
            actorUserId: userId,
            entityType: 'PayRun',
            entityId: record.id,
            metadata: {
                name: record.name,
                orgId,
                branchId,
                ...auditMeta,
            },
            ipAddress: auditMeta?.ipAddress,
            userAgent: auditMeta?.userAgent,
        });

        return record;
    }

    async payPayRun(
        userId: string,
        ctx: { branchId: string; organizationId: string },
        id: string,
        dto: PayPayRunDto,
        auditMeta?: { ipAddress?: string; userAgent?: string },
    ) {
        const { organizationId: orgId, branchId } = ctx;

        const existing = await this.prisma.payRun.findFirst({
            where: { id, orgId, branchId },
        });
        if (!existing) {
            throw new NotFoundException(`Pay run "${id}" not found`);
        }
        if (existing.status !== 'APPROVED') {
            throw new BadRequestException(
                `Only APPROVED pay runs can be marked as paid (current: ${existing.status})`,
            );
        }

        const now = new Date();

        // Generate posting payload stub (no GL posting, no bank rec)
        const postingPayload = {
            paidAt: now.toISOString(),
            paidById: userId,
            grossTotal: existing.grossTotal.toString(),
            netTotal: existing.netTotal.toString(),
            employeeCount: existing.employeeCount,
            note: 'Payroll disbursement recorded. GL posting deferred.',
        };

        const record = await this.prisma.$transaction(async (tx) => {
            const run = await tx.payRun.update({
                where: { id },
                data: {
                    status: 'PAID',
                    paidById: userId,
                    paidAt: now,
                    postingPayload,
                    notes: dto.notes ?? existing.notes,
                },
                include: { paySlips: { include: { employee: true } } },
            });

            // Mark all payslips as PAID
            await tx.paySlip.updateMany({
                where: { payRunId: id },
                data: { status: 'PAID', paidAt: now },
            });

            return run;
        });

        await this.audit.log({
            action: 'PAY_RUN_PAID',
            actorUserId: userId,
            entityType: 'PayRun',
            entityId: record.id,
            metadata: {
                name: record.name,
                grossTotal: existing.grossTotal.toString(),
                netTotal: existing.netTotal.toString(),
                orgId,
                branchId,
                ...auditMeta,
            },
            ipAddress: auditMeta?.ipAddress,
            userAgent: auditMeta?.userAgent,
        });

        return record;
    }

    async getPayRun(ctx: { branchId: string; organizationId: string }, id: string) {
        const { organizationId: orgId, branchId } = ctx;

        const payRun = await this.prisma.payRun.findFirst({
            where: { id, orgId, branchId },
            include: {
                paySlips: { include: { employee: true }, orderBy: { createdAt: 'asc' } },
                builtBy: true,
                approvedBy: true,
                paidBy: true,
            },
        });
        if (!payRun) {
            throw new NotFoundException(`Pay run "${id}" not found`);
        }
        return payRun;
    }

    async listPayRuns(ctx: { branchId: string; organizationId: string }, query: ListPayRunsQueryDto) {
        const { organizationId: orgId, branchId } = ctx;
        const where: Prisma.PayRunWhereInput = { orgId, branchId };

        if (query.status) where.status = query.status as any;
        if (query.periodStart) where.periodStart = { gte: new Date(query.periodStart) };
        if (query.periodEnd) where.periodEnd = { lte: new Date(query.periodEnd) };

        const [data, total] = await Promise.all([
            this.prisma.payRun.findMany({
                where,
                include: {
                    builtBy: true,
                    approvedBy: true,
                    paidBy: true,
                    _count: { select: { paySlips: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip: Number(query.skip) || 0,
                take: Number(query.take) || 50,
            }),
            this.prisma.payRun.count({ where }),
        ]);

        return { data, total };
    }

    // ── Pay Slips ──

    async getPaySlip(ctx: { branchId: string; organizationId: string }, id: string) {
        const { organizationId: orgId, branchId } = ctx;

        const paySlip = await this.prisma.paySlip.findFirst({
            where: { id, orgId, branchId },
            include: { employee: true, payRun: true },
        });
        if (!paySlip) {
            throw new NotFoundException(`Pay slip "${id}" not found`);
        }
        return paySlip;
    }

    async listPaySlips(
        ctx: { branchId: string; organizationId: string },
        query: { payRunId?: string; employeeId?: string; skip?: number; take?: number },
    ) {
        const { organizationId: orgId, branchId } = ctx;
        const where: Prisma.PaySlipWhereInput = { orgId, branchId };

        if (query.payRunId) where.payRunId = query.payRunId;
        if (query.employeeId) where.employeeId = query.employeeId;

        const [data, total] = await Promise.all([
            this.prisma.paySlip.findMany({
                where,
                include: { employee: true, payRun: true },
                orderBy: { createdAt: 'desc' },
                skip: Number(query.skip) || 0,
                take: Number(query.take) || 50,
            }),
            this.prisma.paySlip.count({ where }),
        ]);

        return { data, total };
    }
}
