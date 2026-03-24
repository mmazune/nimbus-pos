import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { RecipesService } from './recipes.service';
import {
  SetRecipeDto,
  ListRecipeCostQueryDto,
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
} from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';

@Controller('inventory')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  // ── Inventory Items ──

  @Post('items')
  @Permissions('pos:recipe:write')
  async createInventoryItem(
    @Body() dto: CreateInventoryItemDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.recipesService.createInventoryItem(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('items')
  @Permissions('pos:recipe:read')
  async listInventoryItems(@Req() req: Request) {
    return this.recipesService.listInventoryItems((req as any).branchContext);
  }

  @Get('items/:id')
  @Permissions('pos:recipe:read')
  async getInventoryItem(@Param('id') id: string, @Req() req: Request) {
    return this.recipesService.getInventoryItem(id, (req as any).branchContext);
  }

  @Patch('items/:id')
  @Permissions('pos:recipe:write')
  async updateInventoryItem(
    @Param('id') id: string,
    @Body() dto: UpdateInventoryItemDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.recipesService.updateInventoryItem(id, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Recipes ──

  @Post('recipes/:menuItemId')
  @Permissions('pos:recipe:write')
  async setRecipe(
    @Param('menuItemId') menuItemId: string,
    @Body() dto: SetRecipeDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.recipesService.setRecipe(menuItemId, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('recipes/:menuItemId')
  @Permissions('pos:recipe:read')
  async getRecipe(@Param('menuItemId') menuItemId: string, @Req() req: Request) {
    return this.recipesService.getRecipe(menuItemId, (req as any).branchContext);
  }

  @Get('recipes/:menuItemId/cost')
  @Permissions('pos:cost:read')
  async getRecipeCost(
    @Param('menuItemId') menuItemId: string,
    @Query() query: ListRecipeCostQueryDto,
    @CurrentUser() user: { id: string; permissions: string[]; roleLevel?: number },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.recipesService.getRecipeCost(
      menuItemId,
      ctx,
      { userId: user.id, permissions: user.permissions ?? [] },
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
      query.servingId,
    );
  }
}
