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
import { CreateCustomerAccountDto } from './dto/create-customer-account.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { CreateArCreditNoteDto } from './dto/create-ar-credit-note.dto';
import { ListAccountsQueryDto } from './dto/list-accounts-query.dto';
import { AgingQueryDto } from './dto/aging-query.dto';

@Injectable()
export class AccountsReceivableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
  ) {}

  // ───────────────────────────────────────────
  // Number generators
  // ───────────────────────────────────────────

  private async nextInvoiceNumber(orgId: string): Promise<string> {
    const last = await this.prisma.invoice.findFirst({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      select: { invoiceNumber: true },
    });
    let seq = 1;
    if (last?.invoiceNumber) {
      const parts = last.invoiceNumber.split('-');
      const parsed = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(parsed)) seq = parsed + 1;
    }
    return `INV-${String(seq).padStart(6, '0')}`;
  }

  private async nextReceiptNumber(orgId: string): Promise<string> {
    const last = await this.prisma.arReceipt.findFirst({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      select: { receiptNumber: true },
    });
    let seq = 1;
    if (last?.receiptNumber) {
      const parts = last.receiptNumber.split('-');
      const parsed = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(parsed)) seq = parsed + 1;
    }
    return `RCP-${String(seq).padStart(6, '0')}`;
  }

  private async nextCreditNoteNumber(orgId: string): Promise<string> {
    const last = await this.prisma.arCreditNote.findFirst({
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
    return `AR-CN-${String(seq).padStart(6, '0')}`;
  }

  // ───────────────────────────────────────────
  // Invoice total math (Decimal-safe)
  // ───────────────────────────────────────────

  computeInvoiceTotals(lines: Array<{ quantity: number; unitPrice: string; taxRate?: number }>): {
    subtotal: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
  } {
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

  // ───────────────────────────────────────────
  // Aging bucket calculation (date-based)
  // ───────────────────────────────────────────

  /**
   * Compute bucket key from days overdue.
   * Returns: 'current' | '1_30' | '31_60' | '61_90' | '90_plus'
   */
  computeAgingBucket(dueDate: Date, asOf: Date): string {
    const daysOverdue = Math.floor((asOf.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysOverdue <= 0) return 'current';
    if (daysOverdue <= 30) return '1_30';
    if (daysOverdue <= 60) return '31_60';
    if (daysOverdue <= 90) return '61_90';
    return '90_plus';
  }

  // ───────────────────────────────────────────
  // Customer Account CRUD
  // ───────────────────────────────────────────

  async createCustomerAccount(params: {
    orgId: string;
    branchId?: string;
    userId: string;
    dto: CreateCustomerAccountDto;
  }) {
    const { orgId, branchId, userId, dto } = params;

    if (dto.code) {
      const existing = await this.prisma.customerAccount.findFirst({
        where: { orgId, code: dto.code },
      });
      if (existing) {
        throw new ConflictException(`Customer account with code "${dto.code}" already exists`);
      }
    }

    const account = await this.prisma.customerAccount.create({
      data: {
        orgId,
        branchId: branchId || null,
        name: dto.name,
        code: dto.code || null,
        type: dto.type || 'INDIVIDUAL',
        status: 'ACTIVE',
        contactName: dto.contactName || null,
        email: dto.email || null,
        phone: dto.phone || null,
        address: dto.address || null,
        taxId: dto.taxId || null,
        currencyCode: dto.currencyCode || 'USD',
        creditLimit: dto.creditLimit ? new Prisma.Decimal(dto.creditLimit) : null,
        openBalance: new Prisma.Decimal(0),
        notes: dto.notes || null,
        createdById: userId,
      },
    });

    await this.audit.log({
      action: 'CUSTOMER_ACCOUNT_CREATED',
      actorUserId: userId,
      entityType: 'CustomerAccount',
      entityId: account.id,
      metadata: { orgId, name: account.name, code: account.code, type: account.type },
    });

    return account;
  }

  async listCustomerAccounts(params: { orgId: string; query: ListAccountsQueryDto }) {
    const { orgId, query } = params;
    const { status, type, branchId, skip = '0', take = '50' } = query;

    const where: Prisma.CustomerAccountWhereInput = { orgId };
    if (status) where.status = status as any;
    if (type) where.type = type as any;
    if (branchId) where.branchId = branchId;

    const [data, total] = await Promise.all([
      this.prisma.customerAccount.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: Number(skip),
        take: Number(take),
        include: {
          _count: { select: { invoices: true } },
        },
      }),
      this.prisma.customerAccount.count({ where }),
    ]);

    return { data, total, skip: Number(skip), take: Number(take) };
  }

  async getCustomerAccount(params: { orgId: string; accountId: string }) {
    const account = await this.prisma.customerAccount.findFirst({
      where: { id: params.accountId, orgId: params.orgId },
      include: {
        _count: { select: { invoices: true, receipts: true, creditNotes: true } },
      },
    });
    if (!account) throw new NotFoundException('Customer account not found');
    return account;
  }

  // ───────────────────────────────────────────
  // Invoice Workflow
  // ───────────────────────────────────────────

  async createInvoice(params: {
    orgId: string;
    branchId?: string;
    userId: string;
    dto: CreateInvoiceDto;
  }) {
    const { orgId, branchId, userId, dto } = params;

    // Validate customer account
    const account = await this.prisma.customerAccount.findFirst({
      where: { id: dto.customerAccountId, orgId, status: 'ACTIVE' },
    });
    if (!account) {
      throw new NotFoundException('Customer account not found or inactive');
    }

    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException('Invoice must have at least one line');
    }

    // Compute totals
    const { subtotal, taxAmount, totalAmount } = this.computeInvoiceTotals(dto.lines);

    const invoiceNumber = await this.nextInvoiceNumber(orgId);
    const currency = dto.currencyCode || account.currencyCode || 'USD';

    const invoice = await this.prisma.invoice.create({
      data: {
        orgId,
        branchId: branchId || null,
        customerAccountId: dto.customerAccountId,
        invoiceNumber,
        status: 'ISSUED',
        sourceType: (dto.sourceType as any) || 'MANUAL',
        sourceDocumentId: dto.sourceDocumentId || null,
        invoiceDate: new Date(dto.invoiceDate),
        issueDate: new Date(),
        dueDate: new Date(dto.dueDate),
        currencyCode: currency,
        subtotal,
        taxAmount,
        totalAmount,
        outstandingBalance: totalAmount,
        issuedAt: new Date(),
        issuedById: userId,
        notes: dto.notes || null,
        createdById: userId,
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
            };
          }),
        },
      },
      include: {
        lines: true,
        customerAccount: { select: { id: true, name: true, code: true, type: true } },
      },
    });

    // Update account open balance
    await this.prisma.customerAccount.update({
      where: { id: dto.customerAccountId },
      data: { openBalance: { increment: totalAmount } },
    });

    await this.audit.log({
      action: 'INVOICE_CREATED',
      actorUserId: userId,
      entityType: 'Invoice',
      entityId: invoice.id,
      metadata: {
        orgId,
        invoiceNumber,
        customerAccountId: dto.customerAccountId,
        totalAmount: totalAmount.toString(),
        sourceType: invoice.sourceType,
      },
    });

    return invoice;
  }

  async listInvoices(params: {
    orgId: string;
    branchId?: string;
    customerAccountId?: string;
    status?: string;
    skip?: number;
    take?: number;
  }) {
    const { orgId, branchId, customerAccountId, status, skip = 0, take = 50 } = params;
    const where: Prisma.InvoiceWhereInput = { orgId };
    if (branchId) where.branchId = branchId;
    if (customerAccountId) where.customerAccountId = customerAccountId;
    if (status) where.status = status as any;

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          customerAccount: { select: { id: true, name: true, code: true, type: true } },
          lines: true,
          _count: { select: { receiptAllocs: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async getInvoice(params: { orgId: string; invoiceId: string }) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: params.invoiceId, orgId: params.orgId },
      include: {
        customerAccount: true,
        lines: true,
        issuedBy: { select: { id: true, firstName: true, lastName: true } },
        receiptAllocs: {
          include: {
            receipt: {
              select: {
                id: true,
                receiptNumber: true,
                receiptDate: true,
                amount: true,
                status: true,
                paymentMethod: true,
              },
            },
          },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  // ───────────────────────────────────────────
  // Receipt + Allocation
  // ───────────────────────────────────────────

  async createReceipt(params: {
    orgId: string;
    branchId?: string;
    userId: string;
    dto: CreateReceiptDto;
  }) {
    const { orgId, branchId, userId, dto } = params;

    // Validate customer account
    const account = await this.prisma.customerAccount.findFirst({
      where: { id: dto.customerAccountId, orgId },
    });
    if (!account) {
      throw new NotFoundException('Customer account not found');
    }

    if (!dto.allocations || dto.allocations.length === 0) {
      throw new BadRequestException('Receipt must allocate to at least one invoice');
    }

    const totalReceipt = new Prisma.Decimal(dto.amount);
    if (totalReceipt.lte(0)) {
      throw new BadRequestException('Receipt amount must be positive');
    }

    // Validate allocations sum
    let allocTotal = new Prisma.Decimal(0);
    for (const alloc of dto.allocations) {
      const allocAmt = new Prisma.Decimal(alloc.amount);
      if (allocAmt.lte(0)) {
        throw new BadRequestException(
          `Allocation amount for invoice ${alloc.invoiceId} must be positive`,
        );
      }
      allocTotal = allocTotal.add(allocAmt);
    }

    if (!allocTotal.equals(totalReceipt)) {
      throw new BadRequestException(
        `Allocation total (${allocTotal}) must equal receipt amount (${totalReceipt})`,
      );
    }

    // Fetch all referenced invoices
    const invoiceIds = dto.allocations.map((a) => a.invoiceId);
    const invoices = await this.prisma.invoice.findMany({
      where: { id: { in: invoiceIds }, orgId },
    });
    const invoiceMap = new Map(invoices.map((inv) => [inv.id, inv]));

    for (const alloc of dto.allocations) {
      const inv = invoiceMap.get(alloc.invoiceId);
      if (!inv) {
        throw new NotFoundException(`Invoice ${alloc.invoiceId} not found`);
      }
      if (inv.customerAccountId !== dto.customerAccountId) {
        throw new BadRequestException(
          `Invoice ${alloc.invoiceId} does not belong to this customer account`,
        );
      }
      if (inv.status !== 'ISSUED' && inv.status !== 'PARTIALLY_PAID') {
        throw new BadRequestException(
          `Invoice ${alloc.invoiceId} is in status "${inv.status}" — only ISSUED or PARTIALLY_PAID invoices can receive payments`,
        );
      }
      const allocAmt = new Prisma.Decimal(alloc.amount);
      if (allocAmt.gt(inv.outstandingBalance)) {
        throw new BadRequestException(
          `Allocation of ${allocAmt} exceeds outstanding balance of ${inv.outstandingBalance} for invoice ${alloc.invoiceId}`,
        );
      }
    }

    const receiptNumber = await this.nextReceiptNumber(orgId);
    const currency = dto.currencyCode || account.currencyCode || 'USD';

    // Execute in transaction: create receipt + allocations + update invoices
    const receipt = await this.prisma.$transaction(async (tx) => {
      const rcp = await tx.arReceipt.create({
        data: {
          orgId,
          branchId: branchId || null,
          customerAccountId: dto.customerAccountId,
          receiptNumber,
          status: 'PENDING',
          receiptDate: new Date(dto.receiptDate),
          currencyCode: currency,
          amount: totalReceipt,
          remainingAmount: new Prisma.Decimal(0),
          paymentMethod: dto.paymentMethod,
          reference: dto.reference || null,
          notes: dto.notes || null,
          receivedById: userId,
        },
      });

      for (const alloc of dto.allocations) {
        const inv = invoiceMap.get(alloc.invoiceId)!;
        const allocAmt = new Prisma.Decimal(alloc.amount);
        const newOutstanding = inv.outstandingBalance.sub(allocAmt);

        await tx.receiptAllocation.create({
          data: {
            orgId,
            receiptId: rcp.id,
            invoiceId: alloc.invoiceId,
            allocatedAmount: allocAmt,
          },
        });

        const newStatus = newOutstanding.lte(0) ? ('PAID' as const) : ('PARTIALLY_PAID' as const);

        await tx.invoice.update({
          where: { id: alloc.invoiceId },
          data: {
            outstandingBalance: newOutstanding.lte(0) ? new Prisma.Decimal(0) : newOutstanding,
            status: newStatus,
          },
        });
      }

      // Update account open balance
      await tx.customerAccount.update({
        where: { id: dto.customerAccountId },
        data: { openBalance: { decrement: totalReceipt } },
      });

      return rcp;
    });

    // Post to GL through the posting engine
    let journalEntryId: string | null = null;
    try {
      journalEntryId = await this.postReceiptToGL({
        orgId,
        branchId,
        userId,
        receiptId: receipt.id,
        receiptNumber,
        amount: totalReceipt,
        debitAccountId: dto.debitAccountId,
        arAccountId: dto.arAccountId,
      });

      await this.prisma.arReceipt.update({
        where: { id: receipt.id },
        data: {
          status: 'POSTED',
          journalEntryId,
        },
      });
    } catch (glErr: any) {
      await this.audit.log({
        action: 'AR_RECEIPT_GL_POSTING_FAILED',
        actorUserId: userId,
        entityType: 'ArReceipt',
        entityId: receipt.id,
        metadata: {
          orgId,
          receiptNumber,
          error: glErr?.message || String(glErr),
        },
      });
    }

    await this.audit.log({
      action: 'AR_RECEIPT_CREATED',
      actorUserId: userId,
      entityType: 'ArReceipt',
      entityId: receipt.id,
      metadata: {
        orgId,
        receiptNumber,
        customerAccountId: dto.customerAccountId,
        amount: totalReceipt.toString(),
        invoiceCount: dto.allocations.length,
        glPosted: !!journalEntryId,
      },
    });

    const result = await this.prisma.arReceipt.findFirst({
      where: { id: receipt.id },
      include: {
        allocations: {
          include: {
            invoice: {
              select: { id: true, invoiceNumber: true, status: true, outstandingBalance: true },
            },
          },
        },
        customerAccount: { select: { id: true, name: true, code: true } },
      },
    });

    return result;
  }

  private async postReceiptToGL(params: {
    orgId: string;
    branchId?: string;
    userId: string;
    receiptId: string;
    receiptNumber: string;
    amount: Prisma.Decimal;
    debitAccountId?: string;
    arAccountId?: string;
  }): Promise<string | null> {
    const {
      orgId,
      branchId,
      userId,
      receiptId,
      receiptNumber,
      amount,
      debitAccountId,
      arAccountId,
    } = params;

    // Both accounts must be provided for GL posting
    if (!debitAccountId || !arAccountId) {
      return null;
    }

    // Validate both accounts exist and are active
    const accts = await this.prisma.account.findMany({
      where: { id: { in: [debitAccountId, arAccountId] }, orgId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (accts.length !== 2) {
      return null;
    }

    const journal = await this.ledger.createJournal({
      orgId,
      branchId,
      userId,
      dto: {
        journalDate: new Date().toISOString().split('T')[0],
        sourceKey: 'AR_RECEIPT',
        sourceDocumentId: receiptId,
        description: `AR Receipt ${receiptNumber}`,
        lines: [
          {
            accountId: debitAccountId,
            direction: 'DEBIT',
            amount: amount.toString(),
            description: `Cash received — ${receiptNumber}`,
          },
          {
            accountId: arAccountId,
            direction: 'CREDIT',
            amount: amount.toString(),
            description: `AR cleared — ${receiptNumber}`,
          },
        ],
      },
    });

    return journal.id;
  }

  // ───────────────────────────────────────────
  // AR Aging
  // ───────────────────────────────────────────

  async getAgingSummary(params: { orgId: string; query: AgingQueryDto }) {
    const { orgId, query } = params;
    const asOf = query.asOf ? new Date(query.asOf) : new Date();
    const skip = Number(query.skip ?? 0);
    const take = Number(query.take ?? 50);

    const where: Prisma.InvoiceWhereInput = {
      orgId,
      status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
      outstandingBalance: { gt: 0 },
    };
    if (query.customerAccountId) {
      where.customerAccountId = query.customerAccountId;
    }

    const openInvoices = await this.prisma.invoice.findMany({
      where,
      include: {
        customerAccount: { select: { id: true, name: true, code: true, type: true } },
      },
      orderBy: [{ customerAccountId: 'asc' }, { dueDate: 'asc' }],
      skip,
      take,
    });

    const total = await this.prisma.invoice.count({ where });

    // Build per-account aging bucket summary
    const accountMap = new Map<
      string,
      {
        customerAccountId: string;
        customerAccountName: string;
        customerAccountCode: string | null;
        customerAccountType: string;
        current: Prisma.Decimal;
        bucket_1_30: Prisma.Decimal;
        bucket_31_60: Prisma.Decimal;
        bucket_61_90: Prisma.Decimal;
        bucket_90_plus: Prisma.Decimal;
        totalOutstanding: Prisma.Decimal;
        invoices: Array<{
          invoiceId: string;
          invoiceNumber: string;
          dueDate: Date;
          outstandingBalance: Prisma.Decimal;
          agingBucket: string;
          daysOverdue: number;
        }>;
      }
    >();

    for (const inv of openInvoices) {
      const bucket = this.computeAgingBucket(inv.dueDate, asOf);
      const daysOverdue = Math.max(
        0,
        Math.floor((asOf.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
      );
      const outstanding = inv.outstandingBalance;

      if (!accountMap.has(inv.customerAccountId)) {
        accountMap.set(inv.customerAccountId, {
          customerAccountId: inv.customerAccountId,
          customerAccountName: inv.customerAccount.name,
          customerAccountCode: inv.customerAccount.code,
          customerAccountType: inv.customerAccount.type,
          current: new Prisma.Decimal(0),
          bucket_1_30: new Prisma.Decimal(0),
          bucket_31_60: new Prisma.Decimal(0),
          bucket_61_90: new Prisma.Decimal(0),
          bucket_90_plus: new Prisma.Decimal(0),
          totalOutstanding: new Prisma.Decimal(0),
          invoices: [],
        });
      }

      const acctEntry = accountMap.get(inv.customerAccountId)!;
      acctEntry.totalOutstanding = acctEntry.totalOutstanding.add(outstanding);

      switch (bucket) {
        case 'current':
          acctEntry.current = acctEntry.current.add(outstanding);
          break;
        case '1_30':
          acctEntry.bucket_1_30 = acctEntry.bucket_1_30.add(outstanding);
          break;
        case '31_60':
          acctEntry.bucket_31_60 = acctEntry.bucket_31_60.add(outstanding);
          break;
        case '61_90':
          acctEntry.bucket_61_90 = acctEntry.bucket_61_90.add(outstanding);
          break;
        case '90_plus':
          acctEntry.bucket_90_plus = acctEntry.bucket_90_plus.add(outstanding);
          break;
      }

      acctEntry.invoices.push({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        dueDate: inv.dueDate,
        outstandingBalance: outstanding,
        agingBucket: bucket,
        daysOverdue,
      });
    }

    // Compute overall totals
    let grandCurrent = new Prisma.Decimal(0);
    let grand1_30 = new Prisma.Decimal(0);
    let grand31_60 = new Prisma.Decimal(0);
    let grand61_90 = new Prisma.Decimal(0);
    let grand90Plus = new Prisma.Decimal(0);
    let grandTotal = new Prisma.Decimal(0);

    const accounts = Array.from(accountMap.values()).map((a) => {
      grandCurrent = grandCurrent.add(a.current);
      grand1_30 = grand1_30.add(a.bucket_1_30);
      grand31_60 = grand31_60.add(a.bucket_31_60);
      grand61_90 = grand61_90.add(a.bucket_61_90);
      grand90Plus = grand90Plus.add(a.bucket_90_plus);
      grandTotal = grandTotal.add(a.totalOutstanding);

      return {
        ...a,
        current: a.current.toString(),
        bucket_1_30: a.bucket_1_30.toString(),
        bucket_31_60: a.bucket_31_60.toString(),
        bucket_61_90: a.bucket_61_90.toString(),
        bucket_90_plus: a.bucket_90_plus.toString(),
        totalOutstanding: a.totalOutstanding.toString(),
      };
    });

    return {
      asOf: asOf.toISOString().split('T')[0],
      total,
      skip,
      take,
      summary: {
        current: grandCurrent.toString(),
        bucket_1_30: grand1_30.toString(),
        bucket_31_60: grand31_60.toString(),
        bucket_61_90: grand61_90.toString(),
        bucket_90_plus: grand90Plus.toString(),
        totalOutstanding: grandTotal.toString(),
      },
      accounts,
    };
  }

  // ───────────────────────────────────────────
  // AR Credit Notes
  // ───────────────────────────────────────────

  async createArCreditNote(params: {
    orgId: string;
    branchId?: string;
    userId: string;
    dto: CreateArCreditNoteDto;
  }) {
    const { orgId, branchId, userId, dto } = params;

    const account = await this.prisma.customerAccount.findFirst({
      where: { id: dto.customerAccountId, orgId },
    });
    if (!account) {
      throw new NotFoundException('Customer account not found');
    }

    if (dto.invoiceId) {
      const inv = await this.prisma.invoice.findFirst({
        where: { id: dto.invoiceId, orgId, customerAccountId: dto.customerAccountId },
      });
      if (!inv) {
        throw new NotFoundException(
          'Invoice not found or does not belong to this customer account',
        );
      }
    }

    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException('Credit note amount must be positive');
    }

    const creditNoteNumber = await this.nextCreditNoteNumber(orgId);
    const currency = dto.currencyCode || account.currencyCode || 'USD';

    const creditNote = await this.prisma.arCreditNote.create({
      data: {
        orgId,
        branchId: branchId || null,
        customerAccountId: dto.customerAccountId,
        invoiceId: dto.invoiceId || null,
        creditNoteNumber,
        status: 'OPEN',
        creditNoteDate: new Date(dto.creditNoteDate),
        currencyCode: currency,
        amount,
        appliedAmount: new Prisma.Decimal(0),
        remainingAmount: amount,
        reason: dto.reason || null,
        notes: dto.notes || null,
        issuedById: userId,
      },
      include: {
        customerAccount: { select: { id: true, name: true, code: true, type: true } },
        invoice: { select: { id: true, invoiceNumber: true, status: true } },
        issuedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await this.audit.log({
      action: 'AR_CREDIT_NOTE_CREATED',
      actorUserId: userId,
      entityType: 'ArCreditNote',
      entityId: creditNote.id,
      metadata: {
        orgId,
        creditNoteNumber,
        customerAccountId: dto.customerAccountId,
        amount: amount.toString(),
        invoiceId: dto.invoiceId || null,
      },
    });

    return creditNote;
  }

  async listArCreditNotes(params: {
    orgId: string;
    customerAccountId?: string;
    status?: string;
    skip?: number;
    take?: number;
  }) {
    const { orgId, customerAccountId, status, skip = 0, take = 50 } = params;
    const where: Prisma.ArCreditNoteWhereInput = { orgId };
    if (customerAccountId) where.customerAccountId = customerAccountId;
    if (status) where.status = status as any;

    const [data, total] = await Promise.all([
      this.prisma.arCreditNote.findMany({
        where,
        include: {
          customerAccount: { select: { id: true, name: true, code: true } },
          invoice: { select: { id: true, invoiceNumber: true, status: true } },
          issuedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.arCreditNote.count({ where }),
    ]);

    return { data, total, skip, take };
  }
}
