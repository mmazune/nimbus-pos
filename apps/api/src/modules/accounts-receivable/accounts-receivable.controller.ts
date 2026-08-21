import { Controller, Get, Post, Body, Param, Query, UseGuards, Request, Req } from '@nestjs/common';
import { Request as ExRequest } from 'express';
import { AccountsReceivableService } from './accounts-receivable.service';
import {
  CreateCustomerAccountDto,
  CreateInvoiceDto,
  CreateReceiptDto,
  CreateArCreditNoteDto,
  ListAccountsQueryDto,
  AgingQueryDto,
  ListInvoicesQueryDto,
  ListArCreditNotesQueryDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BranchContextGuard } from '../../common/guards/branch-context.guard';
import { RequireBranchContext } from '../../common/decorators';
import { Bg3ReliabilityService, BG3_CATEGORY } from '../bg3-reliability';

@UseGuards(JwtAuthGuard, BranchContextGuard, PermissionGuard)
@RequireBranchContext()
@Controller('accounting/ar')
export class AccountsReceivableController {
  constructor(
    private readonly arService: AccountsReceivableService,
    private readonly bg3: Bg3ReliabilityService,
  ) {}

  // ── Customer Accounts ──

  @Post('accounts')
  @Permissions('accounting:ar:account:write')
  async createCustomerAccount(
    @Request() req: any,
    @Body() dto: CreateCustomerAccountDto,
    @CurrentUser() user: { id: string },
  ) {
    const orgId = req.branchContext.organizationId;
    const branchId = req.branchContext.branchId;
    return this.arService.createCustomerAccount({ orgId, branchId, userId: user.id, dto });
  }

  @Get('accounts')
  @Permissions('accounting:ar:account:read')
  async listCustomerAccounts(@Request() req: any, @Query() query: ListAccountsQueryDto) {
    const orgId = req.branchContext.organizationId;
    const branchId = req.branchContext.branchId;
    return this.arService.listCustomerAccounts({ orgId, branchId, query });
  }

  @Get('accounts/:id')
  @Permissions('accounting:ar:account:read')
  async getCustomerAccount(@Request() req: any, @Param('id') accountId: string) {
    const orgId = req.branchContext.organizationId;
    const branchId = req.branchContext.branchId;
    return this.arService.getCustomerAccount({ orgId, branchId, accountId });
  }

  // ── Invoices ──

  @Post('invoices')
  @Permissions('accounting:ar:invoice:write')
  async createInvoice(
    @Request() req: any,
    @Body() dto: CreateInvoiceDto,
    @CurrentUser() user: { id: string },
  ) {
    const orgId = req.branchContext.organizationId;
    const branchId = req.branchContext.branchId;
    return this.arService.createInvoice({ orgId, branchId, userId: user.id, dto });
  }

  @Get('invoices')
  @Permissions('accounting:ar:invoice:read')
  async listInvoices(@Request() req: any, @Query() query: ListInvoicesQueryDto) {
    const orgId = req.branchContext.organizationId;
    const branchId = req.branchContext.branchId;
    return this.arService.listInvoices({
      orgId,
      branchId,
      customerAccountId: query.customerAccountId,
      status: query.status,
      skip: query.skip ?? 0,
      take: query.take ?? 50,
    });
  }

  @Get('invoices/:id')
  @Permissions('accounting:ar:invoice:read')
  async getInvoice(@Request() req: any, @Param('id') invoiceId: string) {
    const orgId = req.branchContext.organizationId;
    const branchId = req.branchContext.branchId;
    return this.arService.getInvoice({ orgId, branchId, invoiceId });
  }

  // ── Receipts ──

  @Post('receipts')
  @Permissions('accounting:ar:receipt:write')
  async createReceipt(
    @Request() req: any,
    @Body() dto: CreateReceiptDto,
    @CurrentUser() user: { id: string },
  ) {
    const orgId = req.branchContext.organizationId;
    const branchId = req.branchContext.branchId;
    return this.bg3.guard(
      {
        req: req as ExRequest,
        scope: 'accounting.ar.receipts.create',
        routeMethod: 'POST',
        routePath: '/api/accounting/ar/receipts',
        category: BG3_CATEGORY.ACCOUNTING,
        idempotencyMode: 'optional',
        fingerprintSource: dto,
        actorUserId: user.id,
        orgId,
        branchId,
      },
      () => this.arService.createReceipt({ orgId, branchId, userId: user.id, dto }),
    );
  }

  // ── Aging ──

  @Get('aging')
  @Permissions('accounting:ar:aging:read')
  async getAgingSummary(@Request() req: any, @Query() query: AgingQueryDto) {
    const orgId = req.branchContext.organizationId;
    const branchId = req.branchContext.branchId;
    return this.arService.getAgingSummary({ orgId, branchId, query });
  }

  // ── AR Credit Notes ──

  @Post('credit-notes')
  @Permissions('accounting:ar:credit-note:write')
  async createArCreditNote(
    @Request() req: any,
    @Body() dto: CreateArCreditNoteDto,
    @CurrentUser() user: { id: string },
  ) {
    const orgId = req.branchContext.organizationId;
    const branchId = req.branchContext.branchId;
    return this.arService.createArCreditNote({ orgId, branchId, userId: user.id, dto });
  }

  @Get('credit-notes')
  @Permissions('accounting:ar:credit-note:read')
  async listArCreditNotes(@Request() req: any, @Query() query: ListArCreditNotesQueryDto) {
    const orgId = req.branchContext.organizationId;
    const branchId = req.branchContext.branchId;
    return this.arService.listArCreditNotes({
      orgId,
      branchId,
      customerAccountId: query.customerAccountId,
      status: query.status,
      skip: query.skip ?? 0,
      take: query.take ?? 50,
    });
  }
}
