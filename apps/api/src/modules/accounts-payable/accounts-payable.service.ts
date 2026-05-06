import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { LedgerService } from '../ledger/ledger.service';
import { Prisma } from '@prisma/client';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreateVendorBillDto } from './dto/create-vendor-bill.dto';
import { CreateApPaymentDto } from './dto/create-ap-payment.dto';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';
import { ListBillsQueryDto } from './dto/list-bills-query.dto';
import {
  CreateRecurringProfileDto,
  UpdateRecurringProfileDto,
} from './dto/create-recurring-profile.dto';
import { ListRecurringProfilesQueryDto } from './dto/list-recurring-profiles-query.dto';
import { ListRemindersQueryDto } from './dto/list-reminders-query.dto';

@Injectable()
export class AccountsPayableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
  ) {}

  // ── Number Generators ──

  private async nextBillNumber(orgId: string): Promise<string> {
    const last = await this.prisma.vendorBill.findFirst({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      select: { billNumber: true },
    });
    let seq = 1;
    if (last?.billNumber) {
      const parts = last.billNumber.split('-');
      const parsed = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(parsed)) seq = parsed + 1;
    }
    return `BILL-${String(seq).padStart(6, '0')}`;
  }

  private async nextPaymentNumber(orgId: string): Promise<string> {
    const last = await this.prisma.vendorPayment.findFirst({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      select: { paymentNumber: true },
    });
    let seq = 1;
    if (last?.paymentNumber) {
      const parts = last.paymentNumber.split('-');
      const parsed = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(parsed)) seq = parsed + 1;
    }
    return `AP-PAY-${String(seq).padStart(6, '0')}`;
  }

  private async nextCreditNoteNumber(orgId: string): Promise<string> {
    const last = await this.prisma.creditNote.findFirst({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      select: { creditNoteNumber: true },
    });
    let seq = 1;
    if (last?.creditNoteNumber) {
      const parts = last.creditNoteNumber.split('-');
      const parsed = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(parsed)) seq = parsed + 1;
    }
    return `CN-${String(seq).padStart(6, '0')}`;
  }

  // ── Bill Math ──

  /**
   * Compute subtotal, taxAmount, and totalAmount from raw line inputs.
   * Returns Decimal-safe results.
   */
  computeBillTotals(
    lines: Array<{
      quantity: number;
      unitPrice: string;
      taxRate?: number;
    }>,
  ): { subtotal: Prisma.Decimal; taxAmount: Prisma.Decimal; totalAmount: Prisma.Decimal } {
    let subtotal = new Prisma.Decimal(0);
    let taxAmount = new Prisma.Decimal(0);

    for (const line of lines) {
      const qty = new Prisma.Decimal(line.quantity);
      const price = new Prisma.Decimal(line.unitPrice);
      const rate = new Prisma.Decimal(line.taxRate ?? 0);

      const lineCost = qty.mul(price);
      const lineTax = lineCost.mul(rate).div(100);

      subtotal = subtotal.add(lineCost);
      taxAmount = taxAmount.add(lineTax);
    }

    return {
      subtotal,
      taxAmount,
      totalAmount: subtotal.add(taxAmount),
    };
  }

  // ── Supplier CRUD ──

  async createSupplier(params: {
    orgId: string;
    branchId?: string;
    userId: string;
    dto: CreateSupplierDto;
  }) {
    const { orgId, branchId, userId, dto } = params;

    if (dto.code) {
      const existing = await this.prisma.supplier.findFirst({
        where: { orgId, code: dto.code },
      });
      if (existing) {
        throw new ConflictException(`Supplier with code "${dto.code}" already exists`);
      }
    }

    const supplier = await this.prisma.supplier.create({
      data: {
        orgId,
        branchId: branchId || null,
        name: dto.name,
        code: dto.code || null,
        contactName: dto.contactName || null,
        email: dto.email || null,
        phone: dto.phone || null,
        address: dto.address || null,
        taxId: dto.taxId || null,
        currencyCode: dto.currencyCode || 'USD',
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        notes: dto.notes || null,
        ...(dto.counterpartyType ? { counterpartyType: dto.counterpartyType as any } : {}),
        paymentTermDays: dto.paymentTermDays ?? null,
        bankName: dto.bankName || null,
        bankAccountNo: dto.bankAccountNo || null,
      },
    });

    await this.audit.log({
      action: 'SUPPLIER_CREATED',
      actorUserId: userId,
      entityType: 'Supplier',
      entityId: supplier.id,
      metadata: { orgId, name: supplier.name, code: supplier.code },
    });

    return supplier;
  }

  async listSuppliers(params: {
    orgId: string;
    activeOnly?: boolean;
    counterpartyType?: string;
    skip?: number;
    take?: number;
  }) {
    const { orgId, activeOnly, counterpartyType, skip = 0, take = 50 } = params;
    const where: Prisma.SupplierWhereInput = { orgId };
    if (activeOnly) where.isActive = true;
    if (counterpartyType) where.counterpartyType = counterpartyType as any;

    const [data, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  /**
   * BG6 — AP Supplier Detail (closes the BG0 missing route
   * `GET /api/accounting/ap/suppliers/:id`).
   *
   * Returns normalized supplier detail enough to power a supplier
   * drawer/page on the frontend: identity + contact + tax/billing
   * metadata, branch/org scope, payable totals derived from existing
   * VendorBill / VendorPayment / CreditNote rows, and short recent
   * bills/payments lists. No analytics, no aggregation across other
   * orgs/branches — strictly org-scoped to match list/read ACLs.
   */
  async getSupplierDetail(params: { orgId: string; supplierId: string }) {
    const { orgId, supplierId } = params;

    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, orgId },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    // Serialised (not Promise.all) to keep Prisma's connection pool
    // healthy on Neon's free-tier 25-connection limit when this endpoint
    // is hit concurrently from supplier list pages.
    const billCount = await this.prisma.vendorBill.count({ where: { orgId, supplierId } });
    const openBillCount = await this.prisma.vendorBill.count({
      where: {
        orgId,
        supplierId,
        status: { in: ['APPROVED', 'PARTIALLY_PAID'] as any },
      },
    });
    const paymentCount = await this.prisma.vendorPayment.count({
      where: { orgId, supplierId },
    });
    const outstandingAgg = await this.prisma.vendorBill.aggregate({
      where: { orgId, supplierId },
      _sum: { outstandingAmount: true, totalAmount: true },
    });
    const paidAgg = await this.prisma.vendorPayment.aggregate({
      where: { orgId, supplierId, status: 'POSTED' as any },
      _sum: { amount: true },
    });
    const recentBills = await this.prisma.vendorBill.findMany({
      where: { orgId, supplierId },
      orderBy: { billDate: 'desc' },
      take: 5,
      select: {
        id: true,
        billNumber: true,
        status: true,
        billDate: true,
        dueDate: true,
        totalAmount: true,
        outstandingAmount: true,
        currencyCode: true,
      },
    });
    const recentPayments = await this.prisma.vendorPayment.findMany({
      where: { orgId, supplierId },
      orderBy: { paymentDate: 'desc' },
      take: 5,
      select: {
        id: true,
        paymentNumber: true,
        status: true,
        paymentDate: true,
        amount: true,
        remainingAmount: true,
        currencyCode: true,
        paymentMethod: true,
      },
    });
    const openCreditNotes = await this.prisma.creditNote.aggregate({
      where: { orgId, supplierId, status: 'OPEN' as any },
      _sum: { remainingAmount: true },
      _count: true,
    });

    return {
      supplier: {
        id: supplier.id,
        orgId: supplier.orgId,
        branchId: supplier.branchId,
        name: supplier.name,
        code: supplier.code,
        counterpartyType: supplier.counterpartyType,
        contactName: supplier.contactName,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        taxId: supplier.taxId,
        paymentTermDays: supplier.paymentTermDays,
        bankName: supplier.bankName,
        bankAccountNo: supplier.bankAccountNo,
        currencyCode: supplier.currencyCode,
        isActive: supplier.isActive,
        notes: supplier.notes,
        createdAt: supplier.createdAt,
        updatedAt: supplier.updatedAt,
      },
      summary: {
        billCount,
        openBillCount,
        paymentCount,
        outstandingTotal: (outstandingAgg._sum.outstandingAmount ?? '0').toString(),
        billedTotal: (outstandingAgg._sum.totalAmount ?? '0').toString(),
        paidTotal: (paidAgg._sum.amount ?? '0').toString(),
        openCreditNoteCount: openCreditNotes._count,
        openCreditNoteRemaining: (openCreditNotes._sum.remainingAmount ?? '0').toString(),
        currencyCode: supplier.currencyCode,
      },
      recentBills,
      recentPayments,
    };
  }

  // ── Vendor Bill ──

  async createVendorBill(params: {
    orgId: string;
    branchId?: string;
    userId: string;
    dto: CreateVendorBillDto;
  }) {
    const { orgId, branchId, userId, dto } = params;

    // Validate supplier
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, orgId, isActive: true },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found or inactive');
    }

    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException('Vendor bill must have at least one line');
    }

    // Compute bill totals
    const { subtotal, taxAmount, totalAmount } = this.computeBillTotals(dto.lines);

    const billNumber = await this.nextBillNumber(orgId);
    const currency = dto.currencyCode || supplier.currencyCode || 'USD';

    const bill = await this.prisma.vendorBill.create({
      data: {
        orgId,
        branchId: branchId || null,
        supplierId: dto.supplierId,
        billNumber,
        status: 'DRAFT',
        sourceType: dto.sourceType as any,
        sourceDocumentId: dto.sourceDocumentId || null,
        billDate: new Date(dto.billDate),
        issueDate: new Date(dto.issueDate),
        dueDate: new Date(dto.dueDate),
        currencyCode: currency,
        subtotal,
        taxAmount,
        totalAmount,
        outstandingAmount: totalAmount,
        notes: dto.notes || null,
        servicePeriodStart: dto.servicePeriodStart ? new Date(dto.servicePeriodStart) : null,
        servicePeriodEnd: dto.servicePeriodEnd ? new Date(dto.servicePeriodEnd) : null,
        recurringProfileId: dto.recurringProfileId || null,
        lines: {
          create: dto.lines.map((line) => {
            const qty = new Prisma.Decimal(line.quantity);
            const price = new Prisma.Decimal(line.unitPrice);
            const rate = new Prisma.Decimal(line.taxRate ?? 0);
            const lineCost = qty.mul(price);
            const lineTax = lineCost.mul(rate).div(100);
            return {
              orgId,
              description: line.description,
              quantity: qty,
              unitPrice: price,
              taxRate: rate,
              taxAmount: lineTax,
              lineTotal: lineCost.add(lineTax),
              accountId: line.accountId || null,
              costCenterId: line.costCenterId || null,
              itemId: line.itemId || null,
            };
          }),
        },
      },
      include: {
        lines: true,
        supplier: { select: { id: true, name: true, code: true } },
      },
    });

    await this.audit.log({
      action: 'VENDOR_BILL_CREATED',
      actorUserId: userId,
      entityType: 'VendorBill',
      entityId: bill.id,
      metadata: {
        orgId,
        billNumber,
        supplierId: dto.supplierId,
        supplierName: supplier.name,
        totalAmount: totalAmount.toString(),
        sourceType: dto.sourceType,
      },
    });

    return bill;
  }

  async listVendorBills(params: { orgId: string; branchId?: string; query: ListBillsQueryDto }) {
    const { orgId, branchId, query } = params;
    const {
      supplierId,
      status,
      sourceType,
      counterpartyType,
      from,
      to,
      overdueAsOf,
      dueSoonDays,
      openOnly,
      recurring,
      skip = 0,
      take = 50,
    } = query;

    const where: Prisma.VendorBillWhereInput = { orgId };
    if (branchId) where.branchId = branchId;
    if (supplierId) where.supplierId = supplierId;
    if (status) where.status = status as any;
    if (sourceType) where.sourceType = sourceType as any;
    if (counterpartyType) {
      where.supplier = { counterpartyType: counterpartyType as any };
    }
    if (from || to) {
      where.billDate = {};
      if (from) where.billDate.gte = new Date(from);
      if (to) where.billDate.lte = new Date(to);
    }
    if (overdueAsOf) {
      where.dueDate = { lt: new Date(overdueAsOf) };
      where.status = { in: ['APPROVED', 'PARTIALLY_PAID', 'OVERDUE'] };
    }
    if (dueSoonDays !== undefined && dueSoonDays >= 0) {
      const now = new Date();
      const cutoff = new Date(now.getTime() + dueSoonDays * 24 * 60 * 60 * 1000);
      where.dueDate = { ...(where.dueDate as any), gte: now, lte: cutoff };
      where.status = { in: ['APPROVED', 'PARTIALLY_PAID'] };
    }
    if (openOnly) {
      where.outstandingAmount = { gt: 0 };
    }
    if (recurring) {
      where.recurringProfileId = { not: null };
    }

    const [data, total] = await Promise.all([
      this.prisma.vendorBill.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true, code: true } },
          lines: true,
          _count: { select: { paymentAllocs: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.vendorBill.count({ where }),
    ]);

    return { data, total, skip: Number(skip), take: Number(take) };
  }

  async getVendorBill(params: { orgId: string; billId: string }) {
    const bill = await this.prisma.vendorBill.findFirst({
      where: { id: params.billId, orgId: params.orgId },
      include: {
        supplier: { select: { id: true, name: true, code: true, email: true, phone: true } },
        lines: true,
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        paymentAllocs: {
          include: {
            vendorPayment: {
              select: {
                id: true,
                paymentNumber: true,
                paymentDate: true,
                amount: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!bill) {
      throw new NotFoundException('Vendor bill not found');
    }
    return bill;
  }

  async approveVendorBill(params: { orgId: string; billId: string; userId: string }) {
    const { orgId, billId, userId } = params;

    const bill = await this.prisma.vendorBill.findFirst({
      where: { id: billId, orgId },
    });

    if (!bill) {
      throw new NotFoundException('Vendor bill not found');
    }

    if (bill.status !== 'DRAFT') {
      throw new ConflictException(
        `Cannot approve bill in status "${bill.status}". Only DRAFT bills can be approved.`,
      );
    }

    const approved = await this.prisma.vendorBill.update({
      where: { id: billId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedById: userId,
      },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        lines: true,
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await this.audit.log({
      action: 'VENDOR_BILL_APPROVED',
      actorUserId: userId,
      entityType: 'VendorBill',
      entityId: bill.id,
      metadata: {
        orgId,
        billNumber: bill.billNumber,
        totalAmount: bill.totalAmount.toString(),
        supplierId: bill.supplierId,
      },
    });

    return approved;
  }

  // ── AP Payment ──

  async createApPayment(params: {
    orgId: string;
    branchId?: string;
    userId: string;
    dto: CreateApPaymentDto;
  }) {
    const { orgId, branchId, userId, dto } = params;

    // Validate supplier
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, orgId },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    if (!dto.allocations || dto.allocations.length === 0) {
      throw new BadRequestException('Payment must allocate to at least one bill');
    }

    const totalPayment = new Prisma.Decimal(dto.amount);
    if (totalPayment.lte(0)) {
      throw new BadRequestException('Payment amount must be positive');
    }

    // Validate allocations sum matches payment amount
    let allocTotal = new Prisma.Decimal(0);
    for (const alloc of dto.allocations) {
      const allocAmt = new Prisma.Decimal(alloc.amount);
      if (allocAmt.lte(0)) {
        throw new BadRequestException(
          `Allocation amount for bill ${alloc.vendorBillId} must be positive`,
        );
      }
      allocTotal = allocTotal.add(allocAmt);
    }

    if (!allocTotal.equals(totalPayment)) {
      throw new BadRequestException(
        `Allocation total (${allocTotal}) must equal payment amount (${totalPayment})`,
      );
    }

    // Fetch all referenced bills and validate
    const billIds = dto.allocations.map((a) => a.vendorBillId);
    const bills = await this.prisma.vendorBill.findMany({
      where: { id: { in: billIds }, orgId },
    });

    const billMap = new Map(bills.map((b) => [b.id, b]));

    for (const alloc of dto.allocations) {
      const bill = billMap.get(alloc.vendorBillId);
      if (!bill) {
        throw new NotFoundException(`Vendor bill ${alloc.vendorBillId} not found`);
      }
      if (bill.supplierId !== dto.supplierId) {
        throw new BadRequestException(
          `Bill ${alloc.vendorBillId} does not belong to supplied supplierId`,
        );
      }
      if (bill.status !== 'APPROVED' && bill.status !== 'PARTIALLY_PAID') {
        throw new BadRequestException(
          `Bill ${alloc.vendorBillId} is in status "${bill.status}" — only APPROVED or PARTIALLY_PAID bills can be paid`,
        );
      }
      const allocAmt = new Prisma.Decimal(alloc.amount);
      if (allocAmt.gt(bill.outstandingAmount)) {
        throw new BadRequestException(
          `Allocation of ${allocAmt} exceeds outstanding balance of ${bill.outstandingAmount} for bill ${alloc.vendorBillId}`,
        );
      }
    }

    const paymentNumber = await this.nextPaymentNumber(orgId);
    const currency = dto.currencyCode || supplier.currencyCode || 'USD';

    // Execute in transaction: create payment + allocations + update bills
    const payment = await this.prisma.$transaction(async (tx) => {
      // Create payment record
      const vp = await tx.vendorPayment.create({
        data: {
          orgId,
          branchId: branchId || null,
          supplierId: dto.supplierId,
          paymentNumber,
          status: 'PENDING',
          paymentDate: new Date(dto.paymentDate),
          currencyCode: currency,
          amount: totalPayment,
          remainingAmount: new Prisma.Decimal(0), // fully allocated
          paymentMethod: dto.paymentMethod,
          reference: dto.reference || null,
          notes: dto.notes || null,
          paidById: userId,
        },
      });

      // Create allocations and update bill outstanding amounts
      for (const alloc of dto.allocations) {
        const bill = billMap.get(alloc.vendorBillId)!;
        const allocAmt = new Prisma.Decimal(alloc.amount);
        const newOutstanding = bill.outstandingAmount.sub(allocAmt);

        await tx.vendorPaymentAllocation.create({
          data: {
            vendorPaymentId: vp.id,
            vendorBillId: alloc.vendorBillId,
            orgId,
            amount: allocAmt,
          },
        });

        const newStatus = newOutstanding.lte(0) ? 'PAID' : ('PARTIALLY_PAID' as const);

        await tx.vendorBill.update({
          where: { id: alloc.vendorBillId },
          data: {
            outstandingAmount: newOutstanding.lte(0) ? new Prisma.Decimal(0) : newOutstanding,
            status: newStatus,
          },
        });
      }

      return vp;
    });

    // Post to GL through the posting engine
    let journalEntryId: string | null = null;
    try {
      journalEntryId = await this.postApPaymentToGL({
        orgId,
        branchId,
        userId,
        paymentId: payment.id,
        paymentNumber,
        amount: totalPayment,
        cashAccountId: dto.cashAccountId,
        apAccountId: dto.apAccountId,
      });

      // Update payment with journalEntryId and mark POSTED
      await this.prisma.vendorPayment.update({
        where: { id: payment.id },
        data: {
          status: 'POSTED',
          journalEntryId,
        },
      });
    } catch (glErr: any) {
      // GL posting failed — payment is still created, status stays PENDING
      // Error is surfaced in audit trail but not fatal for AP workflow
      await this.audit.log({
        action: 'AP_PAYMENT_GL_POSTING_FAILED',
        actorUserId: userId,
        entityType: 'VendorPayment',
        entityId: payment.id,
        metadata: {
          orgId,
          paymentNumber,
          error: glErr?.message || 'Unknown GL posting error',
        },
      });
    }

    const finalPayment = await this.prisma.vendorPayment.findFirst({
      where: { id: payment.id },
      include: {
        supplier: { select: { id: true, name: true } },
        allocations: {
          include: {
            vendorBill: { select: { id: true, billNumber: true, totalAmount: true } },
          },
        },
      },
    });

    await this.audit.log({
      action: 'AP_PAYMENT_CREATED',
      actorUserId: userId,
      entityType: 'VendorPayment',
      entityId: payment.id,
      metadata: {
        orgId,
        paymentNumber,
        supplierId: dto.supplierId,
        supplierName: supplier.name,
        amount: totalPayment.toString(),
        billCount: dto.allocations.length,
        journalEntryId,
      },
    });

    return finalPayment;
  }

  /** Post an AP payment to the general ledger. Returns journalEntryId. */
  private async postApPaymentToGL(params: {
    orgId: string;
    branchId?: string;
    userId: string;
    paymentId: string;
    paymentNumber: string;
    amount: Prisma.Decimal;
    cashAccountId?: string;
    apAccountId?: string;
  }): Promise<string> {
    const { orgId, branchId, userId, paymentId, paymentNumber, amount } = params;

    // Resolve accounts: prefer explicit override, fall back to posting source map
    let debitAccountId = params.apAccountId || null;
    let creditAccountId = params.cashAccountId || null;

    if (!debitAccountId || !creditAccountId) {
      const sourceMap = await this.prisma.postingSourceMap.findFirst({
        where: { orgId, sourceKey: 'AP_PAYMENT', active: true },
      });
      if (sourceMap) {
        if (!debitAccountId) debitAccountId = sourceMap.debitAccountId;
        if (!creditAccountId) creditAccountId = sourceMap.creditAccountId;
      }
    }

    if (!debitAccountId || !creditAccountId) {
      throw new Error(
        'Cannot post AP payment: no AP_PAYMENT posting source map configured and no account IDs provided',
      );
    }

    const journal = await this.ledger.createJournal({
      orgId,
      branchId,
      userId,
      dto: {
        journalDate: new Date().toISOString().split('T')[0],
        sourceKey: 'AP_PAYMENT',
        sourceDocumentId: paymentId,
        reference: paymentNumber,
        description: `AP Payment ${paymentNumber}`,
        lines: [
          {
            accountId: debitAccountId,
            direction: 'DEBIT',
            amount: amount.toString(),
            description: `AP Payment debit — ${paymentNumber}`,
          },
          {
            accountId: creditAccountId,
            direction: 'CREDIT',
            amount: amount.toString(),
            description: `AP Payment credit — ${paymentNumber}`,
          },
        ],
      },
    });

    return journal.id;
  }

  async listApPayments(params: {
    orgId: string;
    supplierId?: string;
    status?: string;
    skip?: number;
    take?: number;
  }) {
    const { orgId, supplierId, status, skip = 0, take = 50 } = params;
    const where: Prisma.VendorPaymentWhereInput = { orgId };
    if (supplierId) where.supplierId = supplierId;
    if (status) where.status = status as any;

    const [data, total] = await Promise.all([
      this.prisma.vendorPayment.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          allocations: {
            include: {
              vendorBill: { select: { id: true, billNumber: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.vendorPayment.count({ where }),
    ]);

    return { data, total, skip: Number(skip), take: Number(take) };
  }

  // ── Credit Note ──

  async createCreditNote(params: {
    orgId: string;
    branchId?: string;
    userId: string;
    dto: CreateCreditNoteDto;
  }) {
    const { orgId, branchId, userId, dto } = params;

    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, orgId },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    const totalAmount = new Prisma.Decimal(dto.totalAmount);
    if (totalAmount.lte(0)) {
      throw new BadRequestException('Credit note total must be positive');
    }

    const creditNoteNumber = await this.nextCreditNoteNumber(orgId);

    const cn = await this.prisma.creditNote.create({
      data: {
        orgId,
        branchId: branchId || null,
        supplierId: dto.supplierId,
        creditNoteNumber,
        status: 'OPEN',
        issueDate: new Date(dto.issueDate),
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        currencyCode: dto.currencyCode || supplier.currencyCode || 'USD',
        totalAmount,
        appliedAmount: new Prisma.Decimal(0),
        remainingAmount: totalAmount,
        sourceBillId: dto.sourceBillId || null,
        reason: dto.reason || null,
        notes: dto.notes || null,
      },
      include: {
        supplier: { select: { id: true, name: true } },
      },
    });

    await this.audit.log({
      action: 'CREDIT_NOTE_CREATED',
      actorUserId: userId,
      entityType: 'CreditNote',
      entityId: cn.id,
      metadata: {
        orgId,
        creditNoteNumber,
        supplierId: dto.supplierId,
        totalAmount: totalAmount.toString(),
      },
    });

    return cn;
  }

  async listCreditNotes(params: {
    orgId: string;
    supplierId?: string;
    status?: string;
    skip?: number;
    take?: number;
  }) {
    const { orgId, supplierId, status, skip = 0, take = 50 } = params;
    const where: Prisma.CreditNoteWhereInput = { orgId };
    if (supplierId) where.supplierId = supplierId;
    if (status) where.status = status as any;

    const [data, total] = await Promise.all([
      this.prisma.creditNote.findMany({
        where,
        include: { supplier: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.creditNote.count({ where }),
    ]);

    return { data, total, skip: Number(skip), take: Number(take) };
  }

  // ── AP Aging (internal / structural) ──

  /**
   * Returns an AP aging summary for the org: open bills grouped by
   * days-overdue buckets (current, 1-30, 31-60, 61-90, 90+).
   */
  async getApAgingSummary(params: { orgId: string; asOf?: string }) {
    const { orgId, asOf } = params;
    const referenceDate = asOf ? new Date(asOf) : new Date();

    const openBills = await this.prisma.vendorBill.findMany({
      where: {
        orgId,
        status: { in: ['APPROVED', 'PARTIALLY_PAID', 'OVERDUE'] },
        outstandingAmount: { gt: 0 },
      },
      include: {
        supplier: { select: { id: true, name: true } },
      },
    });

    const buckets = {
      current: new Prisma.Decimal(0),
      days1to30: new Prisma.Decimal(0),
      days31to60: new Prisma.Decimal(0),
      days61to90: new Prisma.Decimal(0),
      days90plus: new Prisma.Decimal(0),
      total: new Prisma.Decimal(0),
    };

    const bySupplier: Record<
      string,
      {
        supplierId: string;
        supplierName: string;
        current: Prisma.Decimal;
        days1to30: Prisma.Decimal;
        days31to60: Prisma.Decimal;
        days61to90: Prisma.Decimal;
        days90plus: Prisma.Decimal;
        total: Prisma.Decimal;
      }
    > = {};

    for (const bill of openBills) {
      const owed = bill.outstandingAmount;
      const due = bill.dueDate;
      const daysDue = Math.floor((referenceDate.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));

      let bucket: keyof typeof buckets;
      if (daysDue <= 0) bucket = 'current';
      else if (daysDue <= 30) bucket = 'days1to30';
      else if (daysDue <= 60) bucket = 'days31to60';
      else if (daysDue <= 90) bucket = 'days61to90';
      else bucket = 'days90plus';

      buckets[bucket] = buckets[bucket].add(owed);
      buckets.total = buckets.total.add(owed);

      const sid = bill.supplierId;
      if (!bySupplier[sid]) {
        bySupplier[sid] = {
          supplierId: sid,
          supplierName: bill.supplier.name,
          current: new Prisma.Decimal(0),
          days1to30: new Prisma.Decimal(0),
          days31to60: new Prisma.Decimal(0),
          days61to90: new Prisma.Decimal(0),
          days90plus: new Prisma.Decimal(0),
          total: new Prisma.Decimal(0),
        };
      }
      bySupplier[sid][bucket] = bySupplier[sid][bucket].add(owed);
      bySupplier[sid].total = bySupplier[sid].total.add(owed);
    }

    return {
      asOf: referenceDate.toISOString(),
      buckets,
      bySupplier: Object.values(bySupplier),
      billCount: openBills.length,
    };
  }

  // ── Recurring Bill Profiles ──

  async createRecurringProfile(params: {
    orgId: string;
    branchId?: string;
    userId: string;
    dto: CreateRecurringProfileDto;
  }) {
    const { orgId, branchId, userId, dto } = params;

    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, orgId, isActive: true },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found or inactive');
    }

    const profile = await this.prisma.recurringBillProfile.create({
      data: {
        orgId,
        branchId: branchId || null,
        supplierId: dto.supplierId,
        profileName: dto.profileName,
        cadence: dto.cadence as any,
        expectedAmount: new Prisma.Decimal(dto.expectedAmount),
        currencyCode: dto.currencyCode || supplier.currencyCode || 'USD',
        nextDueDate: new Date(dto.nextDueDate),
        leadDays: dto.leadDays ?? 7,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        sourceType: (dto.sourceType as any) || 'RECURRING',
        description: dto.description || null,
        isActive: true,
      },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
      },
    });

    await this.audit.log({
      action: 'RECURRING_PROFILE_CREATED',
      actorUserId: userId,
      entityType: 'RecurringBillProfile',
      entityId: profile.id,
      metadata: {
        orgId,
        profileName: profile.profileName,
        cadence: dto.cadence,
        supplierId: dto.supplierId,
        expectedAmount: dto.expectedAmount,
      },
    });

    return profile;
  }

  async listRecurringProfiles(params: { orgId: string; query: ListRecurringProfilesQueryDto }) {
    const { orgId, query } = params;
    const { supplierId, cadence, isActive, skip = 0, take = 50 } = query;

    const where: Prisma.RecurringBillProfileWhereInput = { orgId };
    if (supplierId) where.supplierId = supplierId;
    if (cadence) where.cadence = cadence as any;
    if (isActive !== undefined) where.isActive = isActive;

    const [data, total] = await Promise.all([
      this.prisma.recurringBillProfile.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true, code: true } },
        },
        orderBy: { nextDueDate: 'asc' },
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.recurringBillProfile.count({ where }),
    ]);

    return { data, total, skip: Number(skip), take: Number(take) };
  }

  async updateRecurringProfile(params: {
    orgId: string;
    profileId: string;
    userId: string;
    dto: UpdateRecurringProfileDto;
  }) {
    const { orgId, profileId, userId, dto } = params;

    const existing = await this.prisma.recurringBillProfile.findFirst({
      where: { id: profileId, orgId },
    });
    if (!existing) {
      throw new NotFoundException('Recurring profile not found');
    }

    const data: any = {};
    if (dto.profileName !== undefined) data.profileName = dto.profileName;
    if (dto.cadence !== undefined) data.cadence = dto.cadence as any;
    if (dto.expectedAmount !== undefined)
      data.expectedAmount = new Prisma.Decimal(dto.expectedAmount);
    if (dto.nextDueDate !== undefined) data.nextDueDate = new Date(dto.nextDueDate);
    if (dto.leadDays !== undefined) data.leadDays = dto.leadDays;
    if (dto.endDate !== undefined) data.endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.recurringBillProfile.update({
      where: { id: profileId },
      data,
      include: {
        supplier: { select: { id: true, name: true, code: true } },
      },
    });

    await this.audit.log({
      action: 'RECURRING_PROFILE_UPDATED',
      actorUserId: userId,
      entityType: 'RecurringBillProfile',
      entityId: profileId,
      metadata: { orgId, changes: dto },
    });

    return updated;
  }

  /**
   * Generate a vendor bill from a recurring profile.
   * Prevents duplicates for the same nextDueDate window.
   */
  async generateBillFromRecurring(params: {
    orgId: string;
    branchId?: string;
    userId: string;
    profileId: string;
  }) {
    const { orgId, branchId, userId, profileId } = params;

    const profile = await this.prisma.recurringBillProfile.findFirst({
      where: { id: profileId, orgId, isActive: true },
      include: { supplier: true },
    });
    if (!profile) {
      throw new NotFoundException('Recurring profile not found or inactive');
    }

    // Duplicate prevention: check if a bill was already generated for this cycle
    if (profile.lastGeneratedBillId) {
      const lastBill = await this.prisma.vendorBill.findFirst({
        where: { id: profile.lastGeneratedBillId },
      });
      if (lastBill && lastBill.dueDate.getTime() === profile.nextDueDate.getTime()) {
        throw new ConflictException(
          `A bill has already been generated for due date ${profile.nextDueDate.toISOString().split('T')[0]}`,
        );
      }
    }

    const billNumber = await this.nextBillNumber(orgId);
    const totalAmount = profile.expectedAmount;
    const now = new Date();

    const bill = await this.prisma.$transaction(async (tx) => {
      const created = await tx.vendorBill.create({
        data: {
          orgId,
          branchId: branchId || profile.branchId || null,
          supplierId: profile.supplierId,
          billNumber,
          status: 'DRAFT',
          sourceType: profile.sourceType as any,
          billDate: now,
          issueDate: now,
          dueDate: profile.nextDueDate,
          currencyCode: profile.currencyCode,
          subtotal: totalAmount,
          taxAmount: new Prisma.Decimal(0),
          totalAmount,
          outstandingAmount: totalAmount,
          notes: `Auto-generated from recurring profile: ${profile.profileName}`,
          recurringProfileId: profile.id,
          servicePeriodStart: this.computeServicePeriodStart(profile.cadence, profile.nextDueDate),
          servicePeriodEnd: profile.nextDueDate,
          lines: {
            create: [
              {
                orgId,
                description: profile.description || profile.profileName,
                quantity: new Prisma.Decimal(1),
                unitPrice: totalAmount,
                taxRate: new Prisma.Decimal(0),
                taxAmount: new Prisma.Decimal(0),
                lineTotal: totalAmount,
              },
            ],
          },
        },
        include: {
          lines: true,
          supplier: { select: { id: true, name: true, code: true } },
        },
      });

      // Advance nextDueDate
      const newNextDue = this.advanceDueDate(profile.cadence, profile.nextDueDate);
      await tx.recurringBillProfile.update({
        where: { id: profile.id },
        data: {
          lastGeneratedAt: now,
          lastGeneratedBillId: created.id,
          nextDueDate: newNextDue,
          // Deactivate if past endDate
          ...(profile.endDate && newNextDue > profile.endDate ? { isActive: false } : {}),
        },
      });

      return created;
    });

    await this.audit.log({
      action: 'RECURRING_BILL_GENERATED',
      actorUserId: userId,
      entityType: 'VendorBill',
      entityId: bill.id,
      metadata: {
        orgId,
        billNumber,
        profileId,
        profileName: profile.profileName,
        totalAmount: totalAmount.toString(),
      },
    });

    return bill;
  }

  private computeServicePeriodStart(cadence: string, dueDate: Date): Date {
    const d = new Date(dueDate);
    switch (cadence) {
      case 'WEEKLY':
        d.setDate(d.getDate() - 7);
        break;
      case 'MONTHLY':
        d.setMonth(d.getMonth() - 1);
        break;
      case 'QUARTERLY':
        d.setMonth(d.getMonth() - 3);
        break;
      case 'ANNUALLY':
        d.setFullYear(d.getFullYear() - 1);
        break;
    }
    return d;
  }

  private advanceDueDate(cadence: string, current: Date): Date {
    const d = new Date(current);
    switch (cadence) {
      case 'WEEKLY':
        d.setDate(d.getDate() + 7);
        break;
      case 'MONTHLY':
        d.setMonth(d.getMonth() + 1);
        break;
      case 'QUARTERLY':
        d.setMonth(d.getMonth() + 3);
        break;
      case 'ANNUALLY':
        d.setFullYear(d.getFullYear() + 1);
        break;
    }
    return d;
  }

  // ── Payable Reminders ──

  /**
   * Generate reminders for bills due within their supplier's paymentTermDays
   * or the system default of 7 days. Reminders at PENDING status are idempotent
   * per bill — no duplicate per billId.
   */
  async generateReminders(params: { orgId: string; branchId?: string }) {
    const { orgId, branchId } = params;
    const now = new Date();
    const defaultLeadDays = 7;

    // Find all open bills due within 90 days (or already overdue) that have no PENDING reminder
    const openBills = await this.prisma.vendorBill.findMany({
      where: {
        orgId,
        ...(branchId ? { branchId } : {}),
        status: { in: ['APPROVED', 'PARTIALLY_PAID'] },
        outstandingAmount: { gt: 0 },
        dueDate: {
          // Include overdue bills (no lower bound) and bills due within 90 days
          lte: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        supplier: { select: { id: true, name: true, paymentTermDays: true } },
        reminders: { where: { status: 'PENDING' } },
      },
    });

    const created: any[] = [];
    for (const bill of openBills) {
      if (bill.reminders.length > 0) continue; // already has a pending reminder

      const leadDays = bill.supplier.paymentTermDays ?? defaultLeadDays;
      const remindAt = new Date(bill.dueDate.getTime() - leadDays * 24 * 60 * 60 * 1000);
      // Use now as remindAt if the lead window has already passed (overdue or past lead window)
      const effectiveRemindAt = remindAt > now ? remindAt : now;

      const reminder = await this.prisma.payableReminder.create({
        data: {
          orgId,
          branchId: bill.branchId || branchId || null,
          supplierId: bill.supplierId,
          vendorBillId: bill.id,
          status: 'PENDING',
          remindAt: effectiveRemindAt,
          dueDate: bill.dueDate,
          title: `Payment due: ${bill.billNumber} — ${bill.supplier.name}`,
          description: `Outstanding: ${bill.outstandingAmount.toString()} ${bill.currencyCode}`,
        },
      });
      created.push(reminder);
    }

    return { generated: created.length, reminders: created };
  }

  async listReminders(params: { orgId: string; branchId?: string; query: ListRemindersQueryDto }) {
    const { orgId, branchId, query } = params;
    const { supplierId, status, dueBefore, skip = 0, take = 50 } = query;

    const where: Prisma.PayableReminderWhereInput = { orgId };
    if (branchId) where.branchId = branchId;
    if (supplierId) where.supplierId = supplierId;
    if (status) where.status = status as any;
    if (dueBefore) where.dueDate = { lte: new Date(dueBefore) };

    const [data, total] = await Promise.all([
      this.prisma.payableReminder.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          vendorBill: {
            select: { id: true, billNumber: true, totalAmount: true, outstandingAmount: true },
          },
        },
        orderBy: { dueDate: 'asc' },
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.payableReminder.count({ where }),
    ]);

    return { data, total, skip: Number(skip), take: Number(take) };
  }

  async dismissReminder(params: { orgId: string; reminderId: string; userId: string }) {
    const { orgId, reminderId, userId } = params;

    const reminder = await this.prisma.payableReminder.findFirst({
      where: { id: reminderId, orgId },
    });
    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }
    if (reminder.status !== 'PENDING') {
      throw new ConflictException('Only PENDING reminders can be dismissed');
    }

    const dismissed = await this.prisma.payableReminder.update({
      where: { id: reminderId },
      data: {
        status: 'DISMISSED',
        dismissedAt: new Date(),
        dismissedById: userId,
      },
    });

    await this.audit.log({
      action: 'PAYABLE_REMINDER_DISMISSED',
      actorUserId: userId,
      entityType: 'PayableReminder',
      entityId: reminderId,
      metadata: { orgId, vendorBillId: reminder.vendorBillId },
    });

    return dismissed;
  }
}
