import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
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
  ResolvePostingErrorDto,
  DismissPostingErrorDto,
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
      branchId: ctx.branchId,
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

  // B5.4-D1 (backend gap batch 4): there was previously no resolve/dismiss endpoint
  // for a PostingError anywhere in the API, for any role.
  @Patch('posting-errors/:id/resolve')
  @Permissions('pos:accounting:posting-errors:resolve')
  async resolvePostingError(
    @Param('id') id: string,
    @Body() dto: ResolvePostingErrorDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.ledgerService.resolvePostingError({
      orgId: ctx.organizationId,
      branchId: ctx.branchId,
      errorId: id,
      userId: user.id,
      resolutionNotes: dto.resolutionNotes,
    });
  }

  @Patch('posting-errors/:id/dismiss')
  @Permissions('pos:accounting:posting-errors:resolve')
  async dismissPostingError(
    @Param('id') id: string,
    @Body() dto: DismissPostingErrorDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.ledgerService.dismissPostingError({
      orgId: ctx.organizationId,
      branchId: ctx.branchId,
      errorId: id,
      userId: user.id,
      resolutionNotes: dto.resolutionNotes,
    });
  }
}
