import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { SetRecipeDto, CreateInventoryItemDto, UpdateInventoryItemDto } from './dto';

interface BranchContext {
  branchId: string;
  organizationId: string;
  roleId?: string;
}

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

interface CallerInfo {
  userId: string;
  permissions: string[];
  roleLevel?: number;
}

@Injectable()
export class RecipesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Inventory Items ──

  async createInventoryItem(
    userId: string,
    ctx: BranchContext,
    dto: CreateInventoryItemDto,
    meta: RequestMeta,
  ) {
    const existing = await this.prisma.inventoryItem.findUnique({
      where: { branchId_name: { branchId: ctx.branchId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException(`Inventory item "${dto.name}" already exists in this branch`);
    }

    const item = await this.prisma.inventoryItem.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        sku: dto.sku ?? null,
        name: dto.name,
        unit: dto.unit,
        category: dto.category ?? null,
        theoreticalUnitCost: dto.theoreticalUnitCost ?? '0',
        reorderLevel: dto.reorderLevel ?? '0',
        reorderQty: dto.reorderQty ?? '0',
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'INVENTORY_ITEM_CREATED',
      entityType: 'inventoryItem',
      entityId: item.id,
      metadata: { orgId: ctx.organizationId, branchId: ctx.branchId, name: dto.name },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return item;
  }

  async updateInventoryItem(
    id: string,
    userId: string,
    ctx: BranchContext,
    dto: UpdateInventoryItemDto,
    meta: RequestMeta,
  ) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!item) throw new NotFoundException('Inventory item not found');

    if (dto.name && dto.name !== item.name) {
      const conflict = await this.prisma.inventoryItem.findUnique({
        where: { branchId_name: { branchId: ctx.branchId, name: dto.name } },
      });
      if (conflict) throw new ConflictException(`Inventory item "${dto.name}" already exists`);
    }

    const updated = await this.prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(dto.sku !== undefined && { sku: dto.sku }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.theoreticalUnitCost !== undefined && {
          theoreticalUnitCost: dto.theoreticalUnitCost,
        }),
        ...(dto.reorderLevel !== undefined && { reorderLevel: dto.reorderLevel }),
        ...(dto.reorderQty !== undefined && { reorderQty: dto.reorderQty }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'INVENTORY_ITEM_UPDATED',
      entityType: 'inventoryItem',
      entityId: id,
      metadata: { orgId: ctx.organizationId, branchId: ctx.branchId, changes: dto },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  async listInventoryItems(ctx: BranchContext) {
    return this.prisma.inventoryItem.findMany({
      where: { branchId: ctx.branchId, orgId: ctx.organizationId },
      orderBy: { name: 'asc' },
    });
  }

  async getInventoryItem(id: string, ctx: BranchContext) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!item) throw new NotFoundException('Inventory item not found');
    return item;
  }

  // ── Recipe Set (atomic replace) ──

  async setRecipe(
    menuItemId: string,
    userId: string,
    ctx: BranchContext,
    dto: SetRecipeDto,
    meta: RequestMeta,
  ) {
    // Verify menu item exists in this branch
    const menuItem = await this.prisma.menuItem.findFirst({
      where: { id: menuItemId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!menuItem) throw new NotFoundException('Menu item not found');

    // Validate all inventory items exist in this branch
    const inventoryItemIds = [...new Set(dto.ingredients.map((i) => i.inventoryItemId))];
    const inventoryItems = await this.prisma.inventoryItem.findMany({
      where: { id: { in: inventoryItemIds }, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (inventoryItems.length !== inventoryItemIds.length) {
      const foundIds = new Set(inventoryItems.map((i) => i.id));
      const missing = inventoryItemIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(`Inventory items not found: ${missing.join(', ')}`);
    }

    // Validate serving IDs if provided
    const servingIds = dto.ingredients
      .map((i) => i.menuItemServingId)
      .filter((id): id is string => !!id);
    if (servingIds.length > 0) {
      const servings = await this.prisma.menuItemServing.findMany({
        where: { id: { in: [...new Set(servingIds)] }, menuItemId },
      });
      if (servings.length !== new Set(servingIds).size) {
        throw new NotFoundException('One or more serving IDs not found for this menu item');
      }
    }

    // Validate modifier option IDs if provided
    const modOptionIds = dto.ingredients
      .map((i) => i.modifierOptionId)
      .filter((id): id is string => !!id);
    if (modOptionIds.length > 0) {
      const options = await this.prisma.modifierOption.findMany({
        where: { id: { in: [...new Set(modOptionIds)] } },
      });
      if (options.length !== new Set(modOptionIds).size) {
        throw new NotFoundException('One or more modifier option IDs not found');
      }
    }

    // Check if recipe already exists (for audit action differentiation)
    const existingCount = await this.prisma.recipeIngredient.count({
      where: { menuItemId, branchId: ctx.branchId },
    });
    const action = existingCount > 0 ? 'RECIPE_UPDATED' : 'RECIPE_SET';

    // Atomic replace: delete all existing + create new in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.recipeIngredient.deleteMany({
        where: { menuItemId, branchId: ctx.branchId, orgId: ctx.organizationId },
      });

      const created = await Promise.all(
        dto.ingredients.map((ing) =>
          tx.recipeIngredient.create({
            data: {
              orgId: ctx.organizationId,
              branchId: ctx.branchId,
              menuItemId,
              inventoryItemId: ing.inventoryItemId,
              menuItemServingId: ing.menuItemServingId ?? null,
              modifierOptionId: ing.modifierOptionId ?? null,
              qtyPerUnit: ing.qtyPerUnit,
              wastePct: ing.wastePct ?? '0',
              unit: ing.unit,
              notes: ing.notes ?? null,
            },
            include: { inventoryItem: true },
          }),
        ),
      );

      return created;
    });

    await this.audit.log({
      actorUserId: userId,
      action,
      entityType: 'recipe',
      entityId: menuItemId,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        menuItemId,
        ingredientCount: dto.ingredients.length,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      menuItemId,
      menuItemName: menuItem.name,
      ingredientCount: result.length,
      ingredients: result,
    };
  }

  // ── Recipe GET ──

  async getRecipe(menuItemId: string, ctx: BranchContext) {
    const menuItem = await this.prisma.menuItem.findFirst({
      where: { id: menuItemId, branchId: ctx.branchId, orgId: ctx.organizationId },
      include: {
        category: true,
        servings: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!menuItem) throw new NotFoundException('Menu item not found');

    const ingredients = await this.prisma.recipeIngredient.findMany({
      where: { menuItemId, branchId: ctx.branchId, orgId: ctx.organizationId },
      include: {
        inventoryItem: true,
        menuItemServing: true,
        modifierOption: { include: { group: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const baseIngredients = ingredients.filter((i) => !i.modifierOptionId && !i.menuItemServingId);
    const modifierIngredients = ingredients.filter((i) => !!i.modifierOptionId);
    const servingIngredients = ingredients.filter(
      (i) => !!i.menuItemServingId && !i.modifierOptionId,
    );

    return {
      menuItem: {
        id: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        categoryName: menuItem.category.name,
      },
      servings: menuItem.servings.map((s) => ({
        id: s.id,
        format: s.format,
        label: s.label,
        price: s.price,
        isDefault: s.isDefault,
      })),
      baseIngredients: baseIngredients.map((i) => this.mapIngredientRow(i)),
      modifierIngredients: modifierIngredients.map((i) => ({
        ...this.mapIngredientRow(i),
        modifierGroupName: i.modifierOption?.group?.name ?? null,
        modifierOptionName: i.modifierOption?.name ?? null,
      })),
      servingIngredients: servingIngredients.map((i) => ({
        ...this.mapIngredientRow(i),
        servingFormat: i.menuItemServing?.format ?? null,
        servingLabel: i.menuItemServing?.label ?? null,
      })),
    };
  }

  // ── Cost Breakdown ──

  async getRecipeCost(
    menuItemId: string,
    ctx: BranchContext,
    caller: CallerInfo,
    meta: RequestMeta,
    servingId?: string,
  ) {
    // Check cost read permission
    if (!caller.permissions.includes('pos:cost:read')) {
      await this.audit.log({
        actorUserId: caller.userId,
        action: 'RECIPE_ACCESS_DENIED',
        entityType: 'recipe',
        entityId: menuItemId,
        metadata: { reason: 'missing_pos:cost:read', branchId: ctx.branchId },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new ForbiddenException('Insufficient permissions to view cost data');
    }

    // Check chef cost visibility via OrgSettings
    const shouldMaskCost = await this.shouldMaskCostForCaller(ctx, caller);

    const menuItem = await this.prisma.menuItem.findFirst({
      where: { id: menuItemId, branchId: ctx.branchId, orgId: ctx.organizationId },
      include: {
        servings: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!menuItem) throw new NotFoundException('Menu item not found');

    const ingredients = await this.prisma.recipeIngredient.findMany({
      where: { menuItemId, branchId: ctx.branchId, orgId: ctx.organizationId },
      include: {
        inventoryItem: true,
        menuItemServing: true,
        modifierOption: { include: { group: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Determine selling price
    // Rule: if servingId provided, use that serving's price.
    // Otherwise, use the default serving price if servings exist, else use base menu item price.
    let sellingPrice: Decimal;
    let sellingPriceSource: string;

    if (servingId) {
      const serving = menuItem.servings.find((s) => s.id === servingId);
      if (!serving) throw new NotFoundException('Serving not found for this menu item');
      sellingPrice = serving.price;
      sellingPriceSource = `serving:${serving.format}${serving.label ? ':' + serving.label : ''}`;
    } else {
      const defaultServing = menuItem.servings.find((s) => s.isDefault);
      if (defaultServing) {
        sellingPrice = defaultServing.price;
        sellingPriceSource = `defaultServing:${defaultServing.format}`;
      } else {
        sellingPrice = menuItem.price;
        sellingPriceSource = 'menuItemBasePrice';
      }
    }

    // Calculate cost per ingredient row
    const costRows = ingredients.map((ing) => {
      const qtyPerUnit = new Decimal(ing.qtyPerUnit.toString());
      const wastePct = new Decimal(ing.wastePct.toString());
      const unitCost = new Decimal(ing.inventoryItem.theoreticalUnitCost.toString());

      // effectiveQty = qtyPerUnit × (1 + wastePct / 100)
      const effectiveQty = qtyPerUnit.mul(new Decimal(1).add(wastePct.div(100)));
      // extendedCost = effectiveQty × unitCost
      const extendedCost = effectiveQty.mul(unitCost);

      const row: Record<string, unknown> = {
        recipeIngredientId: ing.id,
        inventoryItemId: ing.inventoryItem.id,
        inventoryItemName: ing.inventoryItem.name,
        unit: ing.unit,
        qtyPerUnit: qtyPerUnit.toString(),
        wastePct: wastePct.toString(),
        modifierOptionId: ing.modifierOptionId,
        modifierGroupName: ing.modifierOption?.group?.name ?? null,
        modifierOptionName: ing.modifierOption?.name ?? null,
        menuItemServingId: ing.menuItemServingId,
      };

      if (!shouldMaskCost) {
        row.unitCost = unitCost.toString();
        row.effectiveQty = effectiveQty.toDecimalPlaces(3).toString();
        row.extendedCost = extendedCost.toDecimalPlaces(3).toString();
      }

      return { ...row, _extendedCost: extendedCost };
    });

    // Total theoretical COGS
    const totalCogs = costRows.reduce(
      (sum, r) => sum.add(r._extendedCost as Decimal),
      new Decimal(0),
    );

    // Build response
    const costBreakdown: Record<string, unknown> = {
      menuItemId,
      menuItemName: menuItem.name,
      sellingPrice: sellingPrice.toString(),
      sellingPriceSource,
      ingredientCount: costRows.length,
      rows: costRows.map(({ _extendedCost, ...rest }) => rest),
    };

    if (!shouldMaskCost) {
      costBreakdown.totalTheoreticalCogs = totalCogs.toDecimalPlaces(3).toString();
      costBreakdown.margin = sellingPrice.sub(totalCogs).toDecimalPlaces(3).toString();
      costBreakdown.marginPercent = sellingPrice.gt(0)
        ? sellingPrice.sub(totalCogs).div(sellingPrice).mul(100).toDecimalPlaces(2).toString()
        : '0';
    }

    // Audit cost viewed
    await this.audit.log({
      actorUserId: caller.userId,
      action: 'RECIPE_COST_VIEWED',
      entityType: 'recipe',
      entityId: menuItemId,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        menuItemId,
        masked: shouldMaskCost,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return costBreakdown;
  }

  // ── Visibility helper ──

  /**
   * Cost is masked for Chef (L2 with CHEF job role) when OrgSettings.showCostToChef = false.
   * Manager (L4) and Owner (L5) always see cost.
   * For non-chef L2/L3 roles, cost is visible if they have pos:cost:read.
   */
  private async shouldMaskCostForCaller(ctx: BranchContext, _caller: CallerInfo): Promise<boolean> {
    if (!ctx.roleId) return false;

    const role = await this.prisma.role.findUnique({ where: { id: ctx.roleId } });
    if (!role) return false;

    // L4+ always see cost
    if (['L4', 'L5'].includes(role.level)) return false;

    // Chef-specific masking
    if (role.jobRole === 'CHEF') {
      const settings = await this.prisma.orgSettings.findUnique({
        where: { orgId: ctx.organizationId },
      });
      return !(settings?.showCostToChef ?? false);
    }

    // Other roles with pos:cost:read see cost
    return false;
  }

  // ── Helpers ──

  private mapIngredientRow(i: any) {
    return {
      id: i.id,
      inventoryItemId: i.inventoryItem.id,
      inventoryItemName: i.inventoryItem.name,
      qtyPerUnit: i.qtyPerUnit.toString(),
      wastePct: i.wastePct.toString(),
      unit: i.unit,
      notes: i.notes,
    };
  }
}
