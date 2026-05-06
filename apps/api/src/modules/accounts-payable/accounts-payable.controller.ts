import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
} from '@nestjs/common';
import { AccountsPayableService } from './accounts-payable.service';
import { Bg3ReliabilityService, BG3_CATEGORY } from '../bg3-reliability';
import type { Request as ExRequest } from 'express';
import {
  CreateSupplierDto,
  CreateVendorBillDto,
  CreateApPaymentDto,
  CreateCreditNoteDto,
  ListBillsQueryDto,
  CreateRecurringProfileDto,
  UpdateRecurringProfileDto,
  ListRecurringProfilesQueryDto,
  ListRemindersQueryDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BranchContextGuard } from '../../common/guards/branch-context.guard';
import { RequireBranchContext } from '../../common/decorators';

@UseGuards(JwtAuthGuard, BranchContextGuard, PermissionGuard)
@RequireBranchContext()
@Controller('accounting/ap')
export class AccountsPayableController {
  constructor(
    private readonly apService: AccountsPayableService,
    private readonly bg3: Bg3ReliabilityService,
  ) { }

  // ── Suppliers ──

  @Post('suppliers')
  @Permissions('accounting:ap:bill:write')
  async createSupplier(
    @Request() req: any,
    @Body() dto: CreateSupplierDto,
    @CurrentUser() user: { id: string },
  ) {
    const orgId = req.branchContext.organizationId;
    const branchId = req.branchContext.branchId;
    return this.apService.createSupplier({ orgId, branchId, userId: user.id, dto });
  }

  @Get('suppliers')
  @Permissions('accounting:ap:bill:read')
  async listSuppliers(
    @Request() req: any,
    @Query('activeOnly') activeOnly?: string,
    @Query('counterpartyType') counterpartyType?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const orgId = req.branchContext.organizationId;
    return this.apService.listSuppliers({
      orgId,
      activeOnly: activeOnly === 'true',
      counterpartyType,
      skip: skip ? Number(skip) : 0,
      take: take ? Number(take) : 50,
    });
  }

  // BG6 — AP supplier detail (closes BG0 missing route).
  @Get('suppliers/:id')
  @Permissions('accounting:ap:bill:read')
  async getSupplier(
    @Request() req: any,
    @Param('id') supplierId: string,
  ) {
    const orgId = req.branchContext.organizationId;
    return this.apService.getSupplierDetail({ orgId, supplierId });
  }

  // ── Vendor Bills ──

  @Post('bills')
  @Permissions('accounting:ap:bill:write')
  async createVendorBill(
    @Request() req: any,
    @Body() dto: CreateVendorBillDto,
    @CurrentUser() user: { id: string },
  ) {
    const orgId = req.branchContext.organizationId;
    const branchId = req.branchContext.branchId;
    return this.apService.createVendorBill({ orgId, branchId, userId: user.id, dto });
  }

  @Get('bills')
  @Permissions('accounting:ap:bill:read')
  async listVendorBills(@Request() req: any, @Query() query: ListBillsQueryDto) {
    const orgId = req.branchContext.organizationId;
    const branchId = req.branchContext.branchId;
    return this.apService.listVendorBills({ orgId, branchId, query });
  }

  @Get('bills/:id')
  @Permissions('accounting:ap:bill:read')
  async getVendorBill(@Request() req: any, @Param('id') billId: string) {
    const orgId = req.branchContext.organizationId;
    return this.apService.getVendorBill({ orgId, billId });
  }

  @Post('bills/:id/approve')
  @HttpCode(200)
  @Permissions('accounting:ap:bill:approve')
  async approveVendorBill(
    @Request() req: any,
    @Param('id') billId: string,
    @CurrentUser() user: { id: string },
  ) {
    const orgId = req.branchContext.organizationId;
    return this.apService.approveVendorBill({ orgId, billId, userId: user.id });
  }

  // ── AP Payments ──

  @Post('payments')
  @Permissions('accounting:ap:payment:write')
  async createApPayment(
    @Request() req: any,
    @Body() dto: CreateApPaymentDto,
    @CurrentUser() user: { id: string },
  ) {
    const orgId = req.branchContext.organizationId;
    const branchId = req.branchContext.branchId;
    return this.bg3.guard(
      {
        req: req as ExRequest,
        scope: 'accounting.ap.payments.create',
        routeMethod: 'POST',
        routePath: '/api/accounting/ap/payments',
        category: BG3_CATEGORY.ACCOUNTING,
        idempotencyMode: 'optional',
        fingerprintSource: dto,
        actorUserId: user.id,
        orgId,
        branchId,
      },
      () => this.apService.createApPayment({ orgId, branchId, userId: user.id, dto }),
    );
  }

  @Get('payments')
  @Permissions('accounting:ap:bill:read')
  async listApPayments(
    @Request() req: any,
    @Query('supplierId') supplierId?: string,
    @Query('status') status?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const orgId = req.branchContext.organizationId;
    return this.apService.listApPayments({
      orgId,
      supplierId,
      status,
      skip: skip ? Number(skip) : 0,
      take: take ? Number(take) : 50,
    });
  }

  // ── Credit Notes ──

  @Post('credit-notes')
  @Permissions('accounting:ap:credit-note:write')
  async createCreditNote(
    @Request() req: any,
    @Body() dto: CreateCreditNoteDto,
    @CurrentUser() user: { id: string },
  ) {
    const orgId = req.branchContext.organizationId;
    const branchId = req.branchContext.branchId;
    return this.apService.createCreditNote({ orgId, branchId, userId: user.id, dto });
  }

  @Get('credit-notes')
  @Permissions('accounting:ap:credit-note:read')
  async listCreditNotes(
    @Request() req: any,
    @Query('supplierId') supplierId?: string,
    @Query('status') status?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const orgId = req.branchContext.organizationId;
    return this.apService.listCreditNotes({
      orgId,
      supplierId,
      status,
      skip: skip ? Number(skip) : 0,
      take: take ? Number(take) : 50,
    });
  }

  // ── AP Aging ──

  @Get('aging')
  @Permissions('accounting:ap:bill:read')
  async getApAging(@Request() req: any, @Query('asOf') asOf?: string) {
    const orgId = req.branchContext.organizationId;
    return this.apService.getApAgingSummary({ orgId, asOf });
  }

  // ── Recurring Bill Profiles ──

  @Post('recurring-profiles')
  @Permissions('accounting:ap:recurring:write')
  async createRecurringProfile(
    @Request() req: any,
    @Body() dto: CreateRecurringProfileDto,
    @CurrentUser() user: { id: string },
  ) {
    const orgId = req.branchContext.organizationId;
    const branchId = req.branchContext.branchId;
    return this.apService.createRecurringProfile({ orgId, branchId, userId: user.id, dto });
  }

  @Get('recurring-profiles')
  @Permissions('accounting:ap:recurring:read')
  async listRecurringProfiles(@Request() req: any, @Query() query: ListRecurringProfilesQueryDto) {
    const orgId = req.branchContext.organizationId;
    return this.apService.listRecurringProfiles({ orgId, query });
  }

  @Patch('recurring-profiles/:id')
  @Permissions('accounting:ap:recurring:write')
  async updateRecurringProfile(
    @Request() req: any,
    @Param('id') profileId: string,
    @Body() dto: UpdateRecurringProfileDto,
    @CurrentUser() user: { id: string },
  ) {
    const orgId = req.branchContext.organizationId;
    return this.apService.updateRecurringProfile({ orgId, profileId, userId: user.id, dto });
  }

  @Post('recurring-profiles/:id/generate-bill')
  @HttpCode(200)
  @Permissions('accounting:ap:recurring:write')
  async generateBillFromRecurring(
    @Request() req: any,
    @Param('id') profileId: string,
    @CurrentUser() user: { id: string },
  ) {
    const orgId = req.branchContext.organizationId;
    const branchId = req.branchContext.branchId;
    return this.apService.generateBillFromRecurring({
      orgId,
      branchId,
      userId: user.id,
      profileId,
    });
  }

  // ── Payable Reminders ──

  @Post('reminders/generate')
  @HttpCode(200)
  @Permissions('accounting:ap:reminder:write')
  async generateReminders(@Request() req: any) {
    const orgId = req.branchContext.organizationId;
    const branchId = req.branchContext.branchId;
    return this.apService.generateReminders({ orgId, branchId });
  }

  @Get('reminders')
  @Permissions('accounting:ap:reminder:read')
  async listReminders(@Request() req: any, @Query() query: ListRemindersQueryDto) {
    const orgId = req.branchContext.organizationId;
    const branchId = req.branchContext.branchId;
    return this.apService.listReminders({ orgId, branchId, query });
  }

  @Post('reminders/:id/dismiss')
  @HttpCode(200)
  @Permissions('accounting:ap:reminder:write')
  async dismissReminder(
    @Request() req: any,
    @Param('id') reminderId: string,
    @CurrentUser() user: { id: string },
  ) {
    const orgId = req.branchContext.organizationId;
    return this.apService.dismissReminder({ orgId, reminderId, userId: user.id });
  }
}
