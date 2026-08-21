import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';
import { LedgerService } from './ledger.service';
import {
  CreateJournalEntryDto,
  ReverseJournalDto,
  ReplayPostingDto,
  ListJournalsQueryDto,
  ListPostingRunsQueryDto,
  ListPostingErrorsQueryDto,
} from './dto';

@Controller('accounting')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  // ── Journals ──

  @Post('journals')
  @Permissions('pos:accounting:journals:create')
  async createJournal(
    @Body() dto: CreateJournalEntryDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.ledgerService.createJournal({
      orgId: ctx.organizationId,
      branchId: ctx.branchId,
      userId: user.id,
      dto,
    });
  }

  @Get('journals')
  @Permissions('pos:accounting:journals:read')
  async listJournals(@Query() query: ListJournalsQueryDto, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.ledgerService.listJournals({
      orgId: ctx.organizationId,
      branchId: ctx.branchId,
      status: query.status,
      sourceKey: query.sourceKey,
      from: query.from,
      to: query.to,
      skip: query.skip,
      take: query.take,
    });
  }

  @Get('journals/:id')
  @Permissions('pos:accounting:journals:read')
  async getJournal(@Param('id') id: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.ledgerService.getJournal({
      orgId: ctx.organizationId,
      journalId: id,
    });
  }

  @Post('journals/:id/reverse')
  @Permissions('pos:accounting:journals:reverse')
  async reverseJournal(
    @Param('id') id: string,
    @Body() dto: ReverseJournalDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.ledgerService.reverseJournal({
      orgId: ctx.organizationId,
      branchId: ctx.branchId,
      journalId: id,
      userId: user.id,
      reason: dto.reason,
    });
  }

  // ── Posting Engine ──

  @Post('posting/replay')
  @Permissions('pos:accounting:posting:replay')
  async replayPosting(
    @Body() dto: ReplayPostingDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.ledgerService.replayPosting({
      orgId: ctx.organizationId,
      branchId: ctx.branchId,
      userId: user.id,
      sourceKey: dto.sourceKey,
      sourceDocumentId: dto.sourceDocumentId,
    });
  }

  @Get('posting-runs')
  @Permissions('pos:accounting:posting-runs:read')
  async listPostingRuns(@Query() query: ListPostingRunsQueryDto, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.ledgerService.listPostingRuns({
      orgId: ctx.organizationId,
      branchId: ctx.branchId,
      skip: query.skip,
      take: query.take,
    });
  }

  @Get('posting-errors')
  @Permissions('pos:accounting:posting-errors:read')
  async listPostingErrors(@Query() query: ListPostingErrorsQueryDto, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.ledgerService.listPostingErrors({
      orgId: ctx.organizationId,
      branchId: ctx.branchId,
      status: query.status,
      skip: query.skip,
      take: query.take,
    });
  }

  @Get('posting-errors/:id')
  @Permissions('pos:accounting:posting-errors:read')
  async getPostingError(@Param('id') id: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.ledgerService.getPostingError({
      orgId: ctx.organizationId,
      branchId: ctx.branchId,
      errorId: id,
    });
  }
}
