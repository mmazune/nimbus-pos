import {
    Injectable,
    ConflictException,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import {
    CreateAccountDto,
    ListAccountsQueryDto,
    CreateCostCenterDto,
    CreateFiscalPeriodDto,
    UpdatePostingSourceMapDto,
    UpdateTaxLedgerConfigDto,
} from './dto';

interface BranchContext {
    organizationId: string;
    branchId: string;
}

interface AuditMeta {
    ipAddress?: string;
    userAgent?: string;
}

@Injectable()
export class AccountingService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    // ── Accounts ──

    async listAccounts(ctx: BranchContext, query: ListAccountsQueryDto) {
        const where: any = { orgId: ctx.organizationId };
        if (query.accountType) where.accountType = query.accountType;
        if (query.status) where.status = query.status;
        if (query.parentAccountId) where.parentAccountId = query.parentAccountId;

        const [data, total] = await Promise.all([
            this.prisma.account.findMany({
                where,
                skip: query.skip ? Number(query.skip) : 0,
                take: query.take ? Number(query.take) : 50,
                orderBy: { code: 'asc' },
                include: { parentAccount: { select: { id: true, code: true, name: true } } },
            }),
            this.prisma.account.count({ where }),
        ]);

        return { data, total };
    }

    async createAccount(userId: string, ctx: BranchContext, dto: CreateAccountDto, meta: AuditMeta) {
        // Check unique code per org
        const existing = await this.prisma.account.findUnique({
            where: { orgId_code: { orgId: ctx.organizationId, code: dto.code } },
        });
        if (existing) {
            throw new ConflictException(`Account code "${dto.code}" already exists in this organization`);
        }

        // Validate parent account if provided
        if (dto.parentAccountId) {
            const parent = await this.prisma.account.findFirst({
                where: { id: dto.parentAccountId, orgId: ctx.organizationId },
            });
            if (!parent) {
                throw new BadRequestException('Parent account not found in this organization');
            }
        }

        const account = await this.prisma.account.create({
            data: {
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
                code: dto.code,
                name: dto.name,
                accountType: dto.accountType,
                parentAccountId: dto.parentAccountId,
                systemManaged: dto.systemManaged ?? false,
                allowManualPosting: dto.allowManualPosting ?? true,
                taxRelevant: dto.taxRelevant ?? false,
                notes: dto.notes,
            },
        });

        await this.audit.log({
            action: 'ACCOUNT_CREATED',
            actorUserId: userId,
            entityType: 'Account',
            entityId: account.id,
            metadata: { code: dto.code, name: dto.name, accountType: dto.accountType },
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
        });

        return account;
    }

    // ── Cost Centers ──

    async listCostCenters(ctx: BranchContext) {
        return this.prisma.costCenter.findMany({
            where: { orgId: ctx.organizationId, active: true },
            orderBy: { code: 'asc' },
        });
    }

    async createCostCenter(
        userId: string,
        ctx: BranchContext,
        dto: CreateCostCenterDto,
        meta: AuditMeta,
    ) {
        const existing = await this.prisma.costCenter.findUnique({
            where: { orgId_code: { orgId: ctx.organizationId, code: dto.code } },
        });
        if (existing) {
            throw new ConflictException(
                `Cost center code "${dto.code}" already exists in this organization`,
            );
        }

        const costCenter = await this.prisma.costCenter.create({
            data: {
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
                code: dto.code,
                name: dto.name,
                description: dto.description,
            },
        });

        await this.audit.log({
            action: 'COST_CENTER_CREATED',
            actorUserId: userId,
            entityType: 'CostCenter',
            entityId: costCenter.id,
            metadata: { code: dto.code, name: dto.name },
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
        });

        return costCenter;
    }

    // ── Fiscal Periods ──

    async listFiscalPeriods(orgId: string) {
        return this.prisma.fiscalPeriod.findMany({
            where: { orgId },
            orderBy: { startsAt: 'desc' },
        });
    }

    async createFiscalPeriod(
        userId: string,
        orgId: string,
        dto: CreateFiscalPeriodDto,
        meta: AuditMeta,
    ) {
        const startsAt = new Date(dto.startsAt);
        const endsAt = new Date(dto.endsAt);

        if (endsAt <= startsAt) {
            throw new BadRequestException('endsAt must be after startsAt');
        }

        // Check for overlapping periods in the same org
        const overlapping = await this.prisma.fiscalPeriod.findFirst({
            where: {
                orgId,
                OR: [{ startsAt: { lte: endsAt }, endsAt: { gte: startsAt } }],
            },
        });
        if (overlapping) {
            throw new ConflictException(
                `Fiscal period overlaps with existing period "${overlapping.name}" (${overlapping.startsAt.toISOString()} — ${overlapping.endsAt.toISOString()})`,
            );
        }

        const period = await this.prisma.fiscalPeriod.create({
            data: {
                orgId,
                name: dto.name,
                startsAt,
                endsAt,
            },
        });

        await this.audit.log({
            action: 'FISCAL_PERIOD_CREATED',
            actorUserId: userId,
            entityType: 'FiscalPeriod',
            entityId: period.id,
            metadata: { name: dto.name, startsAt: dto.startsAt, endsAt: dto.endsAt },
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
        });

        return period;
    }

    async openFiscalPeriod(userId: string, orgId: string, periodId: string, meta: AuditMeta) {
        const period = await this.prisma.fiscalPeriod.findFirst({
            where: { id: periodId, orgId },
        });
        if (!period) {
            throw new NotFoundException('Fiscal period not found');
        }
        if (period.status !== 'DRAFT') {
            throw new ConflictException(
                `Cannot open period — current status is ${period.status} (must be DRAFT)`,
            );
        }

        const updated = await this.prisma.fiscalPeriod.update({
            where: { id: periodId },
            data: {
                status: 'OPEN',
                openedAt: new Date(),
                openedById: userId,
            },
        });

        await this.audit.log({
            action: 'FISCAL_PERIOD_OPENED',
            actorUserId: userId,
            entityType: 'FiscalPeriod',
            entityId: periodId,
            metadata: { oldStatus: 'DRAFT', newStatus: 'OPEN' },
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
        });

        return updated;
    }

    // ── Posting Source Maps ──

    async listPostingSourceMaps(orgId: string) {
        return this.prisma.postingSourceMap.findMany({
            where: { orgId },
            orderBy: { sourceKey: 'asc' },
            include: {
                debitAccount: { select: { id: true, code: true, name: true } },
                creditAccount: { select: { id: true, code: true, name: true } },
            },
        });
    }

    async updatePostingSourceMap(
        userId: string,
        orgId: string,
        mapId: string,
        dto: UpdatePostingSourceMapDto,
        meta: AuditMeta,
    ) {
        const existing = await this.prisma.postingSourceMap.findFirst({
            where: { id: mapId, orgId },
        });
        if (!existing) {
            throw new NotFoundException('Posting source map not found');
        }

        // Validate referenced accounts exist in same org
        if (dto.debitAccountId) {
            const acct = await this.prisma.account.findFirst({
                where: { id: dto.debitAccountId, orgId },
            });
            if (!acct) throw new BadRequestException('Debit account not found in this organization');
        }
        if (dto.creditAccountId) {
            const acct = await this.prisma.account.findFirst({
                where: { id: dto.creditAccountId, orgId },
            });
            if (!acct) throw new BadRequestException('Credit account not found in this organization');
        }

        const updated = await this.prisma.postingSourceMap.update({
            where: { id: mapId },
            data: {
                debitAccountId: dto.debitAccountId,
                creditAccountId: dto.creditAccountId,
                costCenterRequired: dto.costCenterRequired,
                active: dto.active,
                notes: dto.notes,
            },
            include: {
                debitAccount: { select: { id: true, code: true, name: true } },
                creditAccount: { select: { id: true, code: true, name: true } },
            },
        });

        await this.audit.log({
            action: 'POSTING_SOURCE_MAP_UPDATED',
            actorUserId: userId,
            entityType: 'PostingSourceMap',
            entityId: mapId,
            metadata: {
                sourceKey: existing.sourceKey,
                oldDebitAccountId: existing.debitAccountId,
                newDebitAccountId: dto.debitAccountId,
                oldCreditAccountId: existing.creditAccountId,
                newCreditAccountId: dto.creditAccountId,
            },
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
        });

        return updated;
    }

    // ── Tax Ledger Config ──

    async getTaxLedgerConfig(orgId: string) {
        const config = await this.prisma.taxLedgerConfig.findFirst({
            where: { orgId, active: true },
            include: {
                outputTaxAccount: { select: { id: true, code: true, name: true } },
                inputTaxAccount: { select: { id: true, code: true, name: true } },
                discountAccount: { select: { id: true, code: true, name: true } },
                depositLiabilityAccount: { select: { id: true, code: true, name: true } },
                payrollPayableAccount: { select: { id: true, code: true, name: true } },
            },
        });
        if (!config) {
            throw new NotFoundException('No active tax ledger configuration found');
        }
        return config;
    }

    async updateTaxLedgerConfig(
        userId: string,
        orgId: string,
        dto: UpdateTaxLedgerConfigDto,
        meta: AuditMeta,
    ) {
        // Find existing active config
        let config = await this.prisma.taxLedgerConfig.findFirst({
            where: { orgId, active: true },
        });

        // Validate all referenced accounts exist in org
        const accountIds = [
            dto.outputTaxAccountId,
            dto.inputTaxAccountId,
            dto.discountAccountId,
            dto.depositLiabilityAccountId,
            dto.payrollPayableAccountId,
        ].filter(Boolean) as string[];

        if (accountIds.length > 0) {
            const found = await this.prisma.account.findMany({
                where: { id: { in: accountIds }, orgId },
                select: { id: true },
            });
            const foundIds = new Set(found.map((a) => a.id));
            for (const id of accountIds) {
                if (!foundIds.has(id)) {
                    throw new BadRequestException(`Account "${id}" not found in this organization`);
                }
            }
        }

        if (config) {
            config = await this.prisma.taxLedgerConfig.update({
                where: { id: config.id },
                data: {
                    outputTaxAccountId: dto.outputTaxAccountId,
                    inputTaxAccountId: dto.inputTaxAccountId,
                    discountAccountId: dto.discountAccountId,
                    depositLiabilityAccountId: dto.depositLiabilityAccountId,
                    payrollPayableAccountId: dto.payrollPayableAccountId,
                    active: dto.active ?? true,
                },
            });
        } else {
            config = await this.prisma.taxLedgerConfig.create({
                data: {
                    orgId,
                    outputTaxAccountId: dto.outputTaxAccountId,
                    inputTaxAccountId: dto.inputTaxAccountId,
                    discountAccountId: dto.discountAccountId,
                    depositLiabilityAccountId: dto.depositLiabilityAccountId,
                    payrollPayableAccountId: dto.payrollPayableAccountId,
                    active: dto.active ?? true,
                },
            });
        }

        await this.audit.log({
            action: 'TAX_LEDGER_CONFIG_UPDATED',
            actorUserId: userId,
            entityType: 'TaxLedgerConfig',
            entityId: config.id,
            metadata: {
                outputTaxAccountId: dto.outputTaxAccountId,
                inputTaxAccountId: dto.inputTaxAccountId,
                discountAccountId: dto.discountAccountId,
            },
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
        });

        return this.getTaxLedgerConfig(orgId);
    }
}
