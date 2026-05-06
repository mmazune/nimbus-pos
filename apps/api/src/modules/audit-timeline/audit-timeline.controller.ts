import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuditTimelineReadService } from './audit-timeline.service';
import { AuditTimelineQueryDto } from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { Permissions, RequireBranchContext } from '../../common/decorators';

/**
 * BG2 — Global Audit Timeline read API.
 * Read-only. Powers the frontend audit drawer across domains.
 */
@Controller('audit')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class AuditTimelineController {
  constructor(private readonly service: AuditTimelineReadService) { }

  @Get('timeline')
  @Permissions('audit:read')
  async timeline(@Query() query: AuditTimelineQueryDto, @Req() req: Request) {
    const ctx = (req as { branchContext?: { branchId: string; organizationId: string } })
      .branchContext!;
    return this.service.query(ctx, query);
  }
}
