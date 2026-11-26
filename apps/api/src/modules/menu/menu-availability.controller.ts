import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';
import { MenuWorkspaceService } from './menu-workspace.service';
import { AvailabilityActor, MenuAvailabilityService } from './menu-availability.service';
import { AvailabilitySinceQueryDto, SetMenuItemLeftDto } from './dto';

/** T2 phase 1 (E2): the waiter's menu in one call, and sold out / back on / a number left. */
@Controller('menu')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class MenuAvailabilityController {
  constructor(
    private readonly workspace: MenuWorkspaceService,
    private readonly availability: MenuAvailabilityService,
  ) {}

  @Get('workspace')
  @Permissions('pos:menu:read')
  async getWorkspace(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const answer = await this.workspace.getWorkspace((req as any).branchContext);
    const etag = `"${answer.version}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'no-cache');
    const inm = req.headers['if-none-match'];
    if (inm && inm.split(',').some((t) => t.trim().replace(/^W\//, '') === etag)) {
      res.status(HttpStatus.NOT_MODIFIED);
      return undefined;
    }
    return answer;
  }

  @Get('availability')
  @Permissions('pos:menu:read')
  changedSince(@Query() q: AvailabilitySinceQueryDto, @Req() req: Request) {
    return this.availability.changedSince((req as any).branchContext, q.since);
  }

  @Get('availability/unavailable')
  @Permissions('pos:menu:read')
  listNotAvailable(@Req() req: Request) {
    return this.availability.listNotAvailable((req as any).branchContext);
  }

  @Get('availability/yesterday')
  @Permissions('pos:menu:read')
  yesterday(@Req() req: Request) {
    return this.availability.yesterday((req as any).branchContext);
  }

  @Post('availability/reset')
  @HttpCode(HttpStatus.OK)
  @Permissions('pos:menu:availability:write')
  reset(@CurrentUser() user: AvailabilityActor, @Req() req: Request) {
    return this.availability.reset((req as any).branchContext, user);
  }

  @Post('items/:id/sold-out')
  @HttpCode(HttpStatus.OK)
  @Permissions('pos:menu:availability:write')
  soldOut(@Param('id') id: string, @CurrentUser() user: AvailabilityActor, @Req() req: Request) {
    return this.availability.markSoldOut((req as any).branchContext, id, user);
  }

  @Post('items/:id/available')
  @HttpCode(HttpStatus.OK)
  @Permissions('pos:menu:availability:write')
  available(@Param('id') id: string, @CurrentUser() user: AvailabilityActor, @Req() req: Request) {
    return this.availability.markAvailable((req as any).branchContext, id, user);
  }

  @Put('items/:id/left')
  @Permissions('pos:menu:availability:write')
  setLeft(
    @Param('id') id: string,
    @Body() dto: SetMenuItemLeftDto,
    @CurrentUser() user: AvailabilityActor,
    @Req() req: Request,
  ) {
    return this.availability.setLeft((req as any).branchContext, id, user, dto.left, dto.lowAt);
  }
}
