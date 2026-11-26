import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, RequireBranchContext } from '../../common/decorators';
import { ApprovalRequestsService } from './approval-requests.service';

export class DecideApprovalDto {
  @IsIn(['APPROVE', 'DECLINE'])
  decision!: 'APPROVE' | 'DECLINE';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class PinApprovalDto extends DecideApprovalDto {
  @IsString()
  @Length(4, 12)
  pin!: string;
}

type Me = { id: string; permissions?: string[] };

/**
 * T6 — requests for approval. Anyone signed in may read their own (`?scope=mine`) and hand
 * their device to an approver (`/pin`); the service decides who may answer by level.
 */
@Controller('approval-requests')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class ApprovalRequestsController {
  constructor(private readonly approvals: ApprovalRequestsService) {}

  @Get()
  list(@Query('scope') scope: string, @CurrentUser() user: Me, @Req() req: Request) {
    const s = scope === 'mine' || scope === 'all' ? scope : 'waiting';
    return this.approvals.list(
      (req as any).branchContext,
      { id: user.id, permissions: user.permissions ?? [] },
      s,
    );
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: Request) {
    return this.approvals.get((req as any).branchContext, id);
  }

  @Post(':id/decide')
  @HttpCode(200)
  decide(
    @Param('id') id: string,
    @Body() dto: DecideApprovalDto,
    @CurrentUser() user: Me,
    @Req() req: Request,
  ) {
    return this.approvals.decide(
      (req as any).branchContext,
      { id: user.id, permissions: user.permissions ?? [] },
      id,
      dto.decision,
      dto.note,
    );
  }

  @Post(':id/pin')
  @HttpCode(200)
  withPin(
    @Param('id') id: string,
    @Body() dto: PinApprovalDto,
    @CurrentUser() user: Me,
    @Req() req: Request,
  ) {
    return this.approvals.answerWithPin(
      (req as any).branchContext,
      { id: user.id },
      id,
      dto.pin,
      dto.decision,
      dto.note,
    );
  }
}
