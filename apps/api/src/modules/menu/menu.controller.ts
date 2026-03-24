import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { MenuService } from './menu.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateTaxCategoryDto,
  UpdateTaxCategoryDto,
  CreateMenuItemDto,
  UpdateMenuItemDto,
  ListMenuQueryDto,
  CreateBrowseGroupDto,
  UpdateBrowseGroupDto,
  CreateBrowseSubgroupDto,
  UpdateBrowseSubgroupDto,
  CreateMenuItemServingDto,
  UpdateMenuItemServingDto,
  AssignMenuItemBrowseDto,
  ListMenuNavigationQueryDto,
  CreateModifierGroupDto,
  UpdateModifierGroupDto,
  CreateModifierOptionDto,
  UpdateModifierOptionDto,
  AssignItemModifierGroupsDto,
} from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';

@Controller('menu')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  // ── Categories ──

  @Post('categories')
  @Permissions('pos:menu:write')
  async createCategory(
    @Body() dto: CreateCategoryDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.menuService.createCategory(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('categories')
  @Permissions('pos:menu:read')
  async listCategories(@Req() req: Request) {
    return this.menuService.listCategories((req as any).branchContext);
  }

  @Get('categories/:id')
  @Permissions('pos:menu:read')
  async getCategory(@Param('id') id: string, @Req() req: Request) {
    return this.menuService.getCategory(id, (req as any).branchContext);
  }

  @Patch('categories/:id')
  @Permissions('pos:menu:write')
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.menuService.updateCategory(id, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Tax Categories ──

  @Post('tax-categories')
  @Permissions('pos:tax:write')
  async createTaxCategory(
    @Body() dto: CreateTaxCategoryDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.menuService.createTaxCategory(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('tax-categories')
  @Permissions('pos:tax:read')
  async listTaxCategories(@Req() req: Request) {
    return this.menuService.listTaxCategories((req as any).branchContext);
  }

  @Get('tax-categories/:id')
  @Permissions('pos:tax:read')
  async getTaxCategory(@Param('id') id: string, @Req() req: Request) {
    return this.menuService.getTaxCategory(id, (req as any).branchContext);
  }

  @Patch('tax-categories/:id')
  @Permissions('pos:tax:write')
  async updateTaxCategory(
    @Param('id') id: string,
    @Body() dto: UpdateTaxCategoryDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.menuService.updateTaxCategory(id, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Menu Items ──

  @Post('items')
  @Permissions('pos:menu:write')
  async createMenuItem(
    @Body() dto: CreateMenuItemDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.menuService.createMenuItem(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('items')
  @Permissions('pos:menu:read')
  async listMenuItems(@Query() query: ListMenuQueryDto, @Req() req: Request) {
    return this.menuService.listMenuItems((req as any).branchContext, query);
  }

  @Get('items/:id')
  @Permissions('pos:menu:read')
  async getMenuItem(@Param('id') id: string, @Req() req: Request) {
    return this.menuService.getMenuItem(id, (req as any).branchContext);
  }

  @Patch('items/:id')
  @Permissions('pos:menu:write')
  async updateMenuItem(
    @Param('id') id: string,
    @Body() dto: UpdateMenuItemDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.menuService.updateMenuItem(id, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Catalog (POS-friendly grouped read — upgraded M6.1) ──

  @Get('catalog')
  @Permissions('pos:menu:read')
  async getCatalog(@Req() req: Request) {
    return this.menuService.getCatalog((req as any).branchContext);
  }

  // ── Browse Groups (M6.1) ──

  @Post('browse-groups')
  @Permissions('pos:menu:write')
  async createBrowseGroup(
    @Body() dto: CreateBrowseGroupDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.menuService.createBrowseGroup(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('browse-groups')
  @Permissions('pos:menu:read')
  async listBrowseGroups(@Req() req: Request) {
    return this.menuService.listBrowseGroups((req as any).branchContext);
  }

  @Get('browse-groups/:id')
  @Permissions('pos:menu:read')
  async getBrowseGroup(@Param('id') id: string, @Req() req: Request) {
    return this.menuService.getBrowseGroup(id, (req as any).branchContext);
  }

  @Patch('browse-groups/:id')
  @Permissions('pos:menu:write')
  async updateBrowseGroup(
    @Param('id') id: string,
    @Body() dto: UpdateBrowseGroupDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.menuService.updateBrowseGroup(id, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Browse Subgroups (M6.1) ──

  @Post('browse-groups/:id/subgroups')
  @Permissions('pos:menu:write')
  async createBrowseSubgroup(
    @Param('id') groupId: string,
    @Body() dto: CreateBrowseSubgroupDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.menuService.createBrowseSubgroup(groupId, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('browse-groups/:id/subgroups')
  @Permissions('pos:menu:read')
  async listBrowseSubgroups(@Param('id') groupId: string, @Req() req: Request) {
    return this.menuService.listBrowseSubgroups(groupId, (req as any).branchContext);
  }

  @Patch('browse-groups/:groupId/subgroups/:subgroupId')
  @Permissions('pos:menu:write')
  async updateBrowseSubgroup(
    @Param('groupId') groupId: string,
    @Param('subgroupId') subgroupId: string,
    @Body() dto: UpdateBrowseSubgroupDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.menuService.updateBrowseSubgroup(groupId, subgroupId, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Menu Item Servings (M6.1) ──

  @Post('items/:id/servings')
  @Permissions('pos:menu:write')
  async createMenuItemServing(
    @Param('id') itemId: string,
    @Body() dto: CreateMenuItemServingDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.menuService.createMenuItemServing(itemId, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('items/:id/servings')
  @Permissions('pos:menu:read')
  async listMenuItemServings(@Param('id') itemId: string, @Req() req: Request) {
    return this.menuService.listMenuItemServings(itemId, (req as any).branchContext);
  }

  @Patch('items/:itemId/servings/:servingId')
  @Permissions('pos:menu:write')
  async updateMenuItemServing(
    @Param('itemId') itemId: string,
    @Param('servingId') servingId: string,
    @Body() dto: UpdateMenuItemServingDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.menuService.updateMenuItemServing(itemId, servingId, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Assign Browse (M6.1) ──

  @Patch('items/:id/browse')
  @Permissions('pos:menu:write')
  async assignItemBrowse(
    @Param('id') itemId: string,
    @Body() dto: AssignMenuItemBrowseDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.menuService.assignItemBrowse(itemId, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Navigation Tree (M6.1) ──

  @Get('navigation')
  @Permissions('pos:menu:read')
  async getNavigation(@Query() query: ListMenuNavigationQueryDto, @Req() req: Request) {
    return this.menuService.getNavigation((req as any).branchContext, query);
  }

  // ── Modifier Groups (M7) ──

  @Post('modifier-groups')
  @Permissions('pos:menu:write')
  async createModifierGroup(
    @Body() dto: CreateModifierGroupDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.menuService.createModifierGroup(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('modifier-groups')
  @Permissions('pos:menu:read')
  async listModifierGroups(@Req() req: Request) {
    return this.menuService.listModifierGroups((req as any).branchContext);
  }

  @Get('modifier-groups/:id')
  @Permissions('pos:menu:read')
  async getModifierGroup(@Param('id') id: string, @Req() req: Request) {
    return this.menuService.getModifierGroup(id, (req as any).branchContext);
  }

  @Patch('modifier-groups/:id')
  @Permissions('pos:menu:write')
  async updateModifierGroup(
    @Param('id') id: string,
    @Body() dto: UpdateModifierGroupDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.menuService.updateModifierGroup(id, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Modifier Options (M7) ──

  @Post('modifier-groups/:id/options')
  @Permissions('pos:menu:write')
  async createModifierOption(
    @Param('id') groupId: string,
    @Body() dto: CreateModifierOptionDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.menuService.createModifierOption(groupId, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('modifier-groups/:id/options')
  @Permissions('pos:menu:read')
  async listModifierOptions(@Param('id') groupId: string, @Req() req: Request) {
    return this.menuService.listModifierOptions(groupId, (req as any).branchContext);
  }

  @Patch('modifier-groups/:groupId/options/:optionId')
  @Permissions('pos:menu:write')
  async updateModifierOption(
    @Param('groupId') groupId: string,
    @Param('optionId') optionId: string,
    @Body() dto: UpdateModifierOptionDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.menuService.updateModifierOption(groupId, optionId, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Item ↔ Modifier Group Assignment (M7) ──

  @Post('items/:id/modifier-groups')
  @Permissions('pos:menu:write')
  async assignItemModifierGroups(
    @Param('id') itemId: string,
    @Body() dto: AssignItemModifierGroupsDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.menuService.assignItemModifierGroups(itemId, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('items/:id/modifier-groups')
  @Permissions('pos:menu:read')
  async listItemModifierGroups(@Param('id') itemId: string, @Req() req: Request) {
    return this.menuService.listItemModifierGroups(itemId, (req as any).branchContext);
  }
}
