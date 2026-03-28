import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { FeedbackService } from './feedback.service';
import {
  CreateFeedbackRequestDto,
  ListFeedbackQueryDto,
  TagFeedbackDto,
  ResolveFeedbackDto,
  NpsSummaryQueryDto,
} from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';

@Controller('feedback')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) { }

  // ── Feedback Requests ──

  @Post('requests')
  @Permissions('pos:feedback:request:create')
  async createRequest(
    @Body() dto: CreateFeedbackRequestDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.feedbackService.createFeedbackRequest(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('requests')
  @Permissions('pos:feedback:read')
  async listRequests(@Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.feedbackService.listFeedbackRequests(ctx);
  }

  @Patch('requests/:id/cancel')
  @Permissions('pos:feedback:request:cancel')
  async cancelRequest(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.feedbackService.cancelFeedbackRequest(id, user.id, ctx, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Feedback List / Detail ──

  @Get()
  @Permissions('pos:feedback:read')
  async listFeedback(@Query() query: ListFeedbackQueryDto, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.feedbackService.listFeedback(ctx, query);
  }

  @Get('nps-summary')
  @Permissions('pos:feedback:nps:read')
  async getNpsSummary(@Query() query: NpsSummaryQueryDto, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.feedbackService.getNpsSummary(ctx, query);
  }

  @Get('tags')
  @Permissions('pos:feedback:read')
  async listTags(@Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.feedbackService.listTags(ctx);
  }

  @Get(':id')
  @Permissions('pos:feedback:read')
  async getFeedback(@Param('id') id: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.feedbackService.getFeedback(id, ctx);
  }

  // ── Tag / Acknowledge / Resolve ──

  @Patch(':id/tag')
  @Permissions('pos:feedback:tag')
  async tagFeedback(
    @Param('id') id: string,
    @Body() dto: TagFeedbackDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.feedbackService.tagFeedback(id, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch(':id/acknowledge')
  @Permissions('pos:feedback:acknowledge')
  async acknowledgeFeedback(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.feedbackService.acknowledgeFeedback(id, user.id, ctx, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch(':id/resolve')
  @Permissions('pos:feedback:resolve')
  async resolveFeedback(
    @Param('id') id: string,
    @Body() dto: ResolveFeedbackDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.feedbackService.resolveFeedback(id, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
