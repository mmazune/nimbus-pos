import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';
import { BankRecService } from './bank-rec.service';
import {
  CreateBankAccountDto,
  ImportBankStatementDto,
  CreateReconciliationDto,
  MatchLineDto,
  CreateManualBankEntryDto,
  SkipLineDto,
  PeriodCloseDto,
} from './dto';

@Controller('accounting')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class BankRecController {
  constructor(private readonly bankRecService: BankRecService) {}

  // ── Bank Accounts ──

  @Get('bank-accounts')
  @Permissions('pos:accounting:bank-accounts:read')
  async listBankAccounts(@Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.bankRecService.listBankAccounts(ctx);
  }

  @Post('bank-accounts')
  @Permissions('pos:accounting:bank-accounts:create')
  async createBankAccount(
    @Body() dto: CreateBankAccountDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.bankRecService.createBankAccount(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Bank Statements ──

  @Get('bank-statements')
  @Permissions('pos:accounting:bank-statements:read')
  async listBankStatements(@Query('bankAccountId') bankAccountId: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.bankRecService.listBankStatements(ctx, bankAccountId);
  }

  @Get('bank-statements/:id')
  @Permissions('pos:accounting:bank-statements:read')
  async getBankStatement(@Param('id') id: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.bankRecService.getBankStatement(ctx, id);
  }

  @Post('bank-statements/import')
  @Permissions('pos:accounting:bank-statements:import')
  async importBankStatement(
    @Body() dto: ImportBankStatementDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.bankRecService.importBankStatement(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Reconciliations ──

  @Get('reconciliation')
  @Permissions('pos:accounting:reconciliation:read')
  async listReconciliations(@Query('bankAccountId') bankAccountId: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.bankRecService.listReconciliations(ctx, bankAccountId);
  }

  @Get('reconciliation/:id')
  @Permissions('pos:accounting:reconciliation:read')
  async getReconciliation(@Param('id') id: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.bankRecService.getReconciliation(ctx, id);
  }

  @Post('reconciliation')
  @Permissions('pos:accounting:reconciliation:create')
  async createReconciliation(
    @Body() dto: CreateReconciliationDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.bankRecService.createReconciliation(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch('reconciliation/:id/match')
  @HttpCode(200)
  @Permissions('pos:accounting:reconciliation:match')
  async matchLine(
    @Param('id') id: string,
    @Body() dto: MatchLineDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.bankRecService.matchLine(user.id, ctx, id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch('reconciliation/:id/skip')
  @HttpCode(200)
  @Permissions('pos:accounting:reconciliation:match')
  async skipLine(
    @Param('id') id: string,
    @Body() dto: SkipLineDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.bankRecService.skipLine(user.id, ctx, id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('reconciliation/:id/complete')
  @HttpCode(200)
  @Permissions('pos:accounting:reconciliation:create')
  async completeReconciliation(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.bankRecService.completeReconciliation(user.id, ctx, id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Manual Bank Entries ──

  @Post('manual-bank-entries')
  @Permissions('pos:accounting:bank-entry:create')
  async createManualBankEntry(
    @Body() dto: CreateManualBankEntryDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.bankRecService.createManualBankEntry(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Period Close Runs ──

  @Get('period-close-runs')
  @Permissions('pos:accounting:period-close-runs:read')
  async listPeriodCloseRuns(@Query('fiscalPeriodId') fiscalPeriodId: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.bankRecService.listPeriodCloseRuns(ctx, fiscalPeriodId);
  }

  // ── Period Close / Lock ──

  @Patch('periods/:id/close')
  @HttpCode(200)
  @Permissions('pos:accounting:periods:close')
  async closeFiscalPeriod(
    @Param('id') id: string,
    @Body() dto: PeriodCloseDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.bankRecService.closeFiscalPeriod(user.id, ctx.organizationId, id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch('periods/:id/lock')
  @HttpCode(200)
  @Permissions('pos:accounting:periods:lock')
  async lockFiscalPeriod(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.bankRecService.lockFiscalPeriod(user.id, ctx.organizationId, id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
