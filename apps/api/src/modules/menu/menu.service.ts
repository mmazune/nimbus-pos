import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { InputJsonValue } from '@prisma/client/runtime/library';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
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

interface BranchContext {
  branchId: string;
  organizationId: string;
}

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class MenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Categories ──

  async createCategory(
    userId: string,
    ctx: BranchContext,
    dto: CreateCategoryDto,
    meta: RequestMeta,
  ) {
    const existing = await this.prisma.category.findUnique({
      where: { branchId_name: { branchId: ctx.branchId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException(`Category "${dto.name}" already exists in this branch`);
    }

    const category = await this.prisma.category.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        name: dto.name,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'MENU_CATEGORY_CREATED',
      entityType: 'category',
      entityId: category.id,
      metadata: { orgId: ctx.organizationId, branchId: ctx.branchId, name: dto.name },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return category;
  }

  async listCategories(ctx: BranchContext) {
    return this.prisma.category.findMany({
      where: { branchId: ctx.branchId, orgId: ctx.organizationId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getCategory(id: string, ctx: BranchContext) {
    const category = await this.prisma.category.findFirst({
      where: { id, branchId: ctx.branchId, orgId: ctx.organizationId },
      include: { menuItems: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async updateCategory(
    id: string,
    userId: string,
    ctx: BranchContext,
    dto: UpdateCategoryDto,
    meta: RequestMeta,
  ) {
    const existing = await this.prisma.category.findFirst({
      where: { id, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    if (dto.name !== undefined && dto.name !== existing.name) {
      const dup = await this.prisma.category.findUnique({
        where: { branchId_name: { branchId: ctx.branchId, name: dto.name } },
      });
      if (dup) {
        throw new ConflictException(`Category "${dto.name}" already exists in this branch`);
      }
    }

    const data: Prisma.CategoryUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.category.update({ where: { id }, data });

    await this.audit.log({
      actorUserId: userId,
      action: 'MENU_CATEGORY_UPDATED',
      entityType: 'category',
      entityId: id,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        fields: Object.keys(dto).filter((k) => (dto as any)[k] !== undefined),
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ── Tax Categories ──

  async createTaxCategory(
    userId: string,
    ctx: BranchContext,
    dto: CreateTaxCategoryDto,
    meta: RequestMeta,
  ) {
    const existing = await this.prisma.taxCategory.findUnique({
      where: { branchId_name: { branchId: ctx.branchId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException(`Tax category "${dto.name}" already exists in this branch`);
    }

    const taxCategory = await this.prisma.taxCategory.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        name: dto.name,
        rate: dto.rate,
        efirsTaxCode: dto.efirsTaxCode ?? null,
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'TAX_CATEGORY_CREATED',
      entityType: 'tax_category',
      entityId: taxCategory.id,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        name: dto.name,
        rate: dto.rate,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return taxCategory;
  }

  async listTaxCategories(ctx: BranchContext) {
    return this.prisma.taxCategory.findMany({
      where: { branchId: ctx.branchId, orgId: ctx.organizationId },
      orderBy: { name: 'asc' },
    });
  }

  async getTaxCategory(id: string, ctx: BranchContext) {
    const taxCategory = await this.prisma.taxCategory.findFirst({
      where: { id, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!taxCategory) {
      throw new NotFoundException('Tax category not found');
    }
    return taxCategory;
  }

  async updateTaxCategory(
    id: string,
    userId: string,
    ctx: BranchContext,
    dto: UpdateTaxCategoryDto,
    meta: RequestMeta,
  ) {
    const existing = await this.prisma.taxCategory.findFirst({
      where: { id, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!existing) {
      throw new NotFoundException('Tax category not found');
    }

    if (dto.name !== undefined && dto.name !== existing.name) {
      const dup = await this.prisma.taxCategory.findUnique({
        where: { branchId_name: { branchId: ctx.branchId, name: dto.name } },
      });
      if (dup) {
        throw new ConflictException(`Tax category "${dto.name}" already exists in this branch`);
      }
    }

    const data: Prisma.TaxCategoryUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.rate !== undefined) data.rate = dto.rate;
    if (dto.efirsTaxCode !== undefined) data.efirsTaxCode = dto.efirsTaxCode;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.taxCategory.update({ where: { id }, data });

    await this.audit.log({
      actorUserId: userId,
      action: 'TAX_CATEGORY_UPDATED',
      entityType: 'tax_category',
      entityId: id,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        fields: Object.keys(dto).filter((k) => (dto as any)[k] !== undefined),
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ── Menu Items ──

  async createMenuItem(
    userId: string,
    ctx: BranchContext,
    dto: CreateMenuItemDto,
    meta: RequestMeta,
  ) {
    // Validate category belongs to branch
    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!category) {
      throw new NotFoundException('Category not found in this branch');
    }

    // Validate tax category if provided
    if (dto.taxCategoryId) {
      const taxCat = await this.prisma.taxCategory.findFirst({
        where: { id: dto.taxCategoryId, branchId: ctx.branchId, orgId: ctx.organizationId },
      });
      if (!taxCat) {
        throw new NotFoundException('Tax category not found in this branch');
      }
    }

    // Check unique name per category
    const existing = await this.prisma.menuItem.findUnique({
      where: { categoryId_name: { categoryId: dto.categoryId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException(`Menu item "${dto.name}" already exists in this category`);
    }

    const menuItem = await this.prisma.menuItem.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        categoryId: dto.categoryId,
        taxCategoryId: dto.taxCategoryId ?? null,
        name: dto.name,
        sku: dto.sku ?? null,
        description: dto.description ?? null,
        price: dto.price,
        itemType: dto.itemType,
        station: dto.station ?? 'NONE',
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        metadata: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : undefined,
      },
      include: {
        category: { select: { id: true, name: true } },
        taxCategory: { select: { id: true, name: true, rate: true } },
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'MENU_ITEM_CREATED',
      entityType: 'menu_item',
      entityId: menuItem.id,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        name: dto.name,
        categoryId: dto.categoryId,
        price: dto.price,
        itemType: dto.itemType,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return menuItem;
  }

  async listMenuItems(ctx: BranchContext, query?: ListMenuQueryDto) {
    const where: Prisma.MenuItemWhereInput = {
      branchId: ctx.branchId,
      orgId: ctx.organizationId,
    };
    if (query?.categoryId) where.categoryId = query.categoryId;
    if (query?.activeOnly) where.isActive = true;

    return this.prisma.menuItem.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        category: { select: { id: true, name: true } },
        taxCategory: { select: { id: true, name: true, rate: true } },
      },
    });
  }

  async getMenuItem(id: string, ctx: BranchContext) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id, branchId: ctx.branchId, orgId: ctx.organizationId },
      include: {
        category: { select: { id: true, name: true } },
        taxCategory: { select: { id: true, name: true, rate: true } },
        browseGroup: { select: { id: true, name: true, section: true } },
        browseSubgroup: { select: { id: true, name: true } },
        servings: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            format: true,
            label: true,
            price: true,
            volumeText: true,
            isDefault: true,
            sortOrder: true,
          },
        },
        menuItemOnGroups: {
          orderBy: { sortOrder: 'asc' },
          include: {
            modifierGroup: {
              include: {
                options: {
                  where: { isActive: true },
                  orderBy: { sortOrder: 'asc' },
                  select: {
                    id: true,
                    name: true,
                    priceDelta: true,
                    sortOrder: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!item) {
      throw new NotFoundException('Menu item not found');
    }

    // Reshape modifierGroups for cleaner response
    const modifierGroups = item.menuItemOnGroups
      .filter((link) => link.modifierGroup.isActive)
      .map((link) => ({
        id: link.modifierGroup.id,
        name: link.modifierGroup.name,
        min: link.modifierGroup.min,
        max: link.modifierGroup.max,
        required: link.modifierGroup.required,
        sortOrder: link.sortOrder,
        options: link.modifierGroup.options,
      }));

    const { menuItemOnGroups: _menuItemOnGroups, ...rest } = item;
    return { ...rest, modifierGroups };
  }

  async updateMenuItem(
    id: string,
    userId: string,
    ctx: BranchContext,
    dto: UpdateMenuItemDto,
    meta: RequestMeta,
  ) {
    const existing = await this.prisma.menuItem.findFirst({
      where: { id, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!existing) {
      throw new NotFoundException('Menu item not found');
    }

    // If changing category, validate it
    const targetCategoryId = dto.categoryId ?? existing.categoryId;
    if (dto.categoryId !== undefined && dto.categoryId !== existing.categoryId) {
      const cat = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, branchId: ctx.branchId, orgId: ctx.organizationId },
      });
      if (!cat) {
        throw new NotFoundException('Category not found in this branch');
      }
    }

    // If changing tax category, validate it
    if (dto.taxCategoryId !== undefined && dto.taxCategoryId !== null) {
      const taxCat = await this.prisma.taxCategory.findFirst({
        where: { id: dto.taxCategoryId, branchId: ctx.branchId, orgId: ctx.organizationId },
      });
      if (!taxCat) {
        throw new NotFoundException('Tax category not found in this branch');
      }
    }

    // Check unique name per category if name or category changed
    const targetName = dto.name ?? existing.name;
    if (
      (dto.name !== undefined || dto.categoryId !== undefined) &&
      (targetName !== existing.name || targetCategoryId !== existing.categoryId)
    ) {
      const dup = await this.prisma.menuItem.findUnique({
        where: { categoryId_name: { categoryId: targetCategoryId, name: targetName } },
      });
      if (dup && dup.id !== id) {
        throw new ConflictException(`Menu item "${targetName}" already exists in this category`);
      }
    }

    const data: Prisma.MenuItemUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.categoryId !== undefined) {
      data.category = { connect: { id: dto.categoryId } };
    }
    if (dto.taxCategoryId !== undefined) {
      data.taxCategory = dto.taxCategoryId
        ? { connect: { id: dto.taxCategoryId } }
        : { disconnect: true };
    }
    if (dto.sku !== undefined) data.sku = dto.sku;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.itemType !== undefined) data.itemType = dto.itemType;
    if (dto.station !== undefined) data.station = dto.station;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.metadata !== undefined) data.metadata = dto.metadata as Prisma.InputJsonValue;

    const updated = await this.prisma.menuItem.update({
      where: { id },
      data,
      include: {
        category: { select: { id: true, name: true } },
        taxCategory: { select: { id: true, name: true, rate: true } },
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'MENU_ITEM_UPDATED',
      entityType: 'menu_item',
      entityId: id,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        fields: Object.keys(dto).filter((k) => (dto as any)[k] !== undefined),
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ── Catalog (POS-friendly grouped read) — upgraded for M6.1 ──

  async getCatalog(ctx: BranchContext) {
    const categories = await this.prisma.category.findMany({
      where: {
        branchId: ctx.branchId,
        orgId: ctx.organizationId,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
      include: {
        menuItems: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            taxCategory: { select: { id: true, name: true, rate: true } },
            browseGroup: { select: { id: true, name: true, section: true } },
            browseSubgroup: { select: { id: true, name: true } },
            servings: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
              select: {
                id: true,
                format: true,
                label: true,
                price: true,
                volumeText: true,
                isDefault: true,
                sortOrder: true,
              },
            },
          },
        },
      },
    });

    const taxCategories = await this.prisma.taxCategory.findMany({
      where: { branchId: ctx.branchId, orgId: ctx.organizationId, isActive: true },
      select: { id: true, name: true, rate: true },
    });

    return {
      categories: categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        sortOrder: cat.sortOrder,
        items: cat.menuItems.map((item) => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          description: item.description,
          price: item.price,
          itemType: item.itemType,
          station: item.station,
          sortOrder: item.sortOrder,
          taxCategory: item.taxCategory
            ? { id: item.taxCategory.id, name: item.taxCategory.name, rate: item.taxCategory.rate }
            : null,
          browseGroup: item.browseGroup
            ? {
                id: item.browseGroup.id,
                name: item.browseGroup.name,
                section: item.browseGroup.section,
              }
            : null,
          browseSubgroup: item.browseSubgroup
            ? { id: item.browseSubgroup.id, name: item.browseSubgroup.name }
            : null,
          servings: item.servings,
        })),
      })),
      taxCategories,
    };
  }

  // ── Browse Groups (M6.1) ──

  async createBrowseGroup(
    userId: string,
    ctx: BranchContext,
    dto: CreateBrowseGroupDto,
    meta: RequestMeta,
  ) {
    const existing = await this.prisma.menuBrowseGroup.findUnique({
      where: { branchId_name: { branchId: ctx.branchId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException(`Browse group "${dto.name}" already exists in this branch`);
    }

    const group = await this.prisma.menuBrowseGroup.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        section: dto.section,
        name: dto.name,
        internalKey: dto.internalKey ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'MENU_BROWSE_GROUP_CREATED',
      entityType: 'menu_browse_group',
      entityId: group.id,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        name: dto.name,
        section: dto.section,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return group;
  }

  async listBrowseGroups(ctx: BranchContext) {
    return this.prisma.menuBrowseGroup.findMany({
      where: { branchId: ctx.branchId, orgId: ctx.organizationId },
      orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }],
      include: { subgroups: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async getBrowseGroup(id: string, ctx: BranchContext) {
    const group = await this.prisma.menuBrowseGroup.findFirst({
      where: { id, branchId: ctx.branchId, orgId: ctx.organizationId },
      include: { subgroups: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!group) {
      throw new NotFoundException('Browse group not found');
    }
    return group;
  }

  async updateBrowseGroup(
    id: string,
    userId: string,
    ctx: BranchContext,
    dto: UpdateBrowseGroupDto,
    meta: RequestMeta,
  ) {
    const existing = await this.prisma.menuBrowseGroup.findFirst({
      where: { id, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!existing) {
      throw new NotFoundException('Browse group not found');
    }

    if (dto.name !== undefined && dto.name !== existing.name) {
      const dup = await this.prisma.menuBrowseGroup.findUnique({
        where: { branchId_name: { branchId: ctx.branchId, name: dto.name } },
      });
      if (dup) {
        throw new ConflictException(`Browse group "${dto.name}" already exists in this branch`);
      }
    }

    const data: Prisma.MenuBrowseGroupUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.section !== undefined) data.section = dto.section;
    if (dto.internalKey !== undefined) data.internalKey = dto.internalKey;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.menuBrowseGroup.update({ where: { id }, data });

    await this.audit.log({
      actorUserId: userId,
      action: 'MENU_BROWSE_GROUP_UPDATED',
      entityType: 'menu_browse_group',
      entityId: id,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        fields: Object.keys(dto).filter((k) => (dto as any)[k] !== undefined),
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ── Browse Subgroups (M6.1) ──

  async createBrowseSubgroup(
    groupId: string,
    userId: string,
    ctx: BranchContext,
    dto: CreateBrowseSubgroupDto,
    meta: RequestMeta,
  ) {
    const group = await this.prisma.menuBrowseGroup.findFirst({
      where: { id: groupId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!group) {
      throw new NotFoundException('Browse group not found in this branch');
    }

    const existing = await this.prisma.menuBrowseSubgroup.findUnique({
      where: { groupId_name: { groupId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException(`Subgroup "${dto.name}" already exists in this group`);
    }

    const subgroup = await this.prisma.menuBrowseSubgroup.create({
      data: {
        groupId,
        name: dto.name,
        internalKey: dto.internalKey ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'MENU_BROWSE_SUBGROUP_CREATED',
      entityType: 'menu_browse_subgroup',
      entityId: subgroup.id,
      metadata: { orgId: ctx.organizationId, branchId: ctx.branchId, groupId, name: dto.name },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return subgroup;
  }

  async listBrowseSubgroups(groupId: string, ctx: BranchContext) {
    const group = await this.prisma.menuBrowseGroup.findFirst({
      where: { id: groupId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!group) {
      throw new NotFoundException('Browse group not found in this branch');
    }

    return this.prisma.menuBrowseSubgroup.findMany({
      where: { groupId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async updateBrowseSubgroup(
    groupId: string,
    subgroupId: string,
    userId: string,
    ctx: BranchContext,
    dto: UpdateBrowseSubgroupDto,
    meta: RequestMeta,
  ) {
    const group = await this.prisma.menuBrowseGroup.findFirst({
      where: { id: groupId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!group) {
      throw new NotFoundException('Browse group not found in this branch');
    }

    const existing = await this.prisma.menuBrowseSubgroup.findFirst({
      where: { id: subgroupId, groupId },
    });
    if (!existing) {
      throw new NotFoundException('Browse subgroup not found');
    }

    if (dto.name !== undefined && dto.name !== existing.name) {
      const dup = await this.prisma.menuBrowseSubgroup.findUnique({
        where: { groupId_name: { groupId, name: dto.name } },
      });
      if (dup) {
        throw new ConflictException(`Subgroup "${dto.name}" already exists in this group`);
      }
    }

    const data: Prisma.MenuBrowseSubgroupUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.internalKey !== undefined) data.internalKey = dto.internalKey;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.menuBrowseSubgroup.update({
      where: { id: subgroupId },
      data,
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'MENU_BROWSE_SUBGROUP_UPDATED',
      entityType: 'menu_browse_subgroup',
      entityId: subgroupId,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        groupId,
        fields: Object.keys(dto).filter((k) => (dto as any)[k] !== undefined),
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ── Menu Item Servings (M6.1) ──

  async createMenuItemServing(
    menuItemId: string,
    userId: string,
    ctx: BranchContext,
    dto: CreateMenuItemServingDto,
    meta: RequestMeta,
  ) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id: menuItemId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!item) {
      throw new NotFoundException('Menu item not found in this branch');
    }

    const existing = await this.prisma.menuItemServing.findFirst({
      where: {
        menuItemId,
        format: dto.format,
        label: dto.label ?? null,
      },
    });
    if (existing) {
      throw new ConflictException(
        `Serving format "${dto.format}" with label "${dto.label ?? ''}" already exists for this item`,
      );
    }

    const serving = await this.prisma.menuItemServing.create({
      data: {
        menuItemId,
        format: dto.format,
        label: dto.label ?? null,
        price: dto.price,
        volumeText: dto.volumeText ?? null,
        isDefault: dto.isDefault ?? false,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        metadata: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : undefined,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'MENU_ITEM_SERVING_CREATED',
      entityType: 'menu_item_serving',
      entityId: serving.id,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        menuItemId,
        format: dto.format,
        price: dto.price,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return serving;
  }

  async listMenuItemServings(menuItemId: string, ctx: BranchContext) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id: menuItemId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!item) {
      throw new NotFoundException('Menu item not found in this branch');
    }

    return this.prisma.menuItemServing.findMany({
      where: { menuItemId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async updateMenuItemServing(
    itemId: string,
    servingId: string,
    userId: string,
    ctx: BranchContext,
    dto: UpdateMenuItemServingDto,
    meta: RequestMeta,
  ) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id: itemId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!item) {
      throw new NotFoundException('Menu item not found in this branch');
    }

    const existing = await this.prisma.menuItemServing.findFirst({
      where: { id: servingId, menuItemId: itemId },
    });
    if (!existing) {
      throw new NotFoundException('Serving not found for this menu item');
    }

    const data: Prisma.MenuItemServingUpdateInput = {};
    if (dto.format !== undefined) data.format = dto.format;
    if (dto.label !== undefined) data.label = dto.label;
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.volumeText !== undefined) data.volumeText = dto.volumeText;
    if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.metadata !== undefined) data.metadata = dto.metadata as Prisma.InputJsonValue;

    const updated = await this.prisma.menuItemServing.update({ where: { id: servingId }, data });

    await this.audit.log({
      actorUserId: userId,
      action: 'MENU_ITEM_SERVING_UPDATED',
      entityType: 'menu_item_serving',
      entityId: servingId,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        menuItemId: itemId,
        fields: Object.keys(dto).filter((k) => (dto as any)[k] !== undefined),
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ── Assign Browse Group/Subgroup to Item (M6.1) ──

  async assignItemBrowse(
    itemId: string,
    userId: string,
    ctx: BranchContext,
    dto: AssignMenuItemBrowseDto,
    meta: RequestMeta,
  ) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id: itemId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!item) {
      throw new NotFoundException('Menu item not found in this branch');
    }

    const data: Prisma.MenuItemUpdateInput = {};

    if (dto.browseGroupId !== undefined) {
      if (dto.browseGroupId === null) {
        data.browseGroup = { disconnect: true };
        // also clear subgroup when clearing group
        data.browseSubgroup = { disconnect: true };
      } else {
        const group = await this.prisma.menuBrowseGroup.findFirst({
          where: { id: dto.browseGroupId, branchId: ctx.branchId, orgId: ctx.organizationId },
        });
        if (!group) {
          throw new NotFoundException('Browse group not found in this branch');
        }
        data.browseGroup = { connect: { id: dto.browseGroupId } };
      }
    }

    if (dto.browseSubgroupId !== undefined) {
      if (dto.browseSubgroupId === null) {
        data.browseSubgroup = { disconnect: true };
      } else {
        // Validate subgroup belongs to the intended group
        const targetGroupId = dto.browseGroupId ?? item.browseGroupId;
        if (!targetGroupId) {
          throw new BadRequestException('Cannot assign subgroup without a browse group');
        }

        const subgroup = await this.prisma.menuBrowseSubgroup.findFirst({
          where: { id: dto.browseSubgroupId, groupId: targetGroupId },
        });
        if (!subgroup) {
          throw new BadRequestException('Subgroup does not belong to the specified browse group');
        }
        data.browseSubgroup = { connect: { id: dto.browseSubgroupId } };
      }
    }

    const updated = await this.prisma.menuItem.update({
      where: { id: itemId },
      data,
      include: {
        browseGroup: { select: { id: true, name: true, section: true } },
        browseSubgroup: { select: { id: true, name: true } },
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'MENU_ITEM_BROWSE_ASSIGNED',
      entityType: 'menu_item',
      entityId: itemId,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        browseGroupId: dto.browseGroupId,
        browseSubgroupId: dto.browseSubgroupId,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  // ── Navigation Tree (M6.1) ──

  async getNavigation(ctx: BranchContext, query?: ListMenuNavigationQueryDto) {
    const where: Prisma.MenuBrowseGroupWhereInput = {
      branchId: ctx.branchId,
      orgId: ctx.organizationId,
    };
    if (query?.activeOnly) where.isActive = true;
    if (query?.section) where.section = query.section;

    const groups = await this.prisma.menuBrowseGroup.findMany({
      where,
      orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }],
      include: {
        subgroups: {
          where: query?.activeOnly ? { isActive: true } : undefined,
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            internalKey: true,
            sortOrder: true,
            isActive: true,
          },
        },
      },
    });

    // Group by section
    const sections: Record<string, typeof groups> = {};
    for (const group of groups) {
      if (!sections[group.section]) {
        sections[group.section] = [];
      }
      sections[group.section].push(group);
    }

    return Object.entries(sections).map(([section, sectionGroups]) => ({
      section,
      groups: sectionGroups.map((g) => ({
        id: g.id,
        name: g.name,
        internalKey: g.internalKey,
        sortOrder: g.sortOrder,
        isActive: g.isActive,
        subgroups: g.subgroups,
      })),
    }));
  }

  // ── Modifier Groups (M7) ──

  async createModifierGroup(
    userId: string,
    ctx: BranchContext,
    dto: CreateModifierGroupDto,
    meta: RequestMeta,
  ) {
    const existing = await this.prisma.modifierGroup.findUnique({
      where: { branchId_name: { branchId: ctx.branchId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException('Modifier group name already exists in this branch');
    }

    const min = dto.min ?? 0;
    const max = dto.max ?? 0;
    if (min > 0 && max > 0 && min > max) {
      throw new BadRequestException('min cannot exceed max');
    }

    const group = await this.prisma.modifierGroup.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        name: dto.name,
        min,
        max,
        required: dto.required ?? false,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'MODIFIER_GROUP_CREATED',
      entityType: 'modifierGroup',
      entityId: group.id,
      metadata: { orgId: ctx.organizationId, branchId: ctx.branchId, name: dto.name },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return group;
  }

  async listModifierGroups(ctx: BranchContext) {
    return this.prisma.modifierGroup.findMany({
      where: { branchId: ctx.branchId, orgId: ctx.organizationId },
      orderBy: { sortOrder: 'asc' },
      include: {
        options: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            priceDelta: true,
            sortOrder: true,
            isActive: true,
          },
        },
      },
    });
  }

  async getModifierGroup(id: string, ctx: BranchContext) {
    const group = await this.prisma.modifierGroup.findFirst({
      where: { id, branchId: ctx.branchId, orgId: ctx.organizationId },
      include: {
        options: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            priceDelta: true,
            sortOrder: true,
            isActive: true,
          },
        },
      },
    });
    if (!group) {
      throw new NotFoundException('Modifier group not found');
    }
    return group;
  }

  async updateModifierGroup(
    id: string,
    userId: string,
    ctx: BranchContext,
    dto: UpdateModifierGroupDto,
    meta: RequestMeta,
  ) {
    const existing = await this.prisma.modifierGroup.findFirst({
      where: { id, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!existing) {
      throw new NotFoundException('Modifier group not found');
    }

    if (dto.name && dto.name !== existing.name) {
      const dup = await this.prisma.modifierGroup.findUnique({
        where: { branchId_name: { branchId: ctx.branchId, name: dto.name } },
      });
      if (dup) {
        throw new ConflictException('Modifier group name already exists in this branch');
      }
    }

    const min = dto.min ?? existing.min;
    const max = dto.max ?? existing.max;
    if (min > 0 && max > 0 && min > max) {
      throw new BadRequestException('min cannot exceed max');
    }

    const group = await this.prisma.modifierGroup.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.min !== undefined && { min: dto.min }),
        ...(dto.max !== undefined && { max: dto.max }),
        ...(dto.required !== undefined && { required: dto.required }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'MODIFIER_GROUP_UPDATED',
      entityType: 'modifierGroup',
      entityId: group.id,
      metadata: { orgId: ctx.organizationId, branchId: ctx.branchId, changes: dto },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return group;
  }

  // ── Modifier Options (M7) ──

  async createModifierOption(
    groupId: string,
    userId: string,
    ctx: BranchContext,
    dto: CreateModifierOptionDto,
    meta: RequestMeta,
  ) {
    const group = await this.prisma.modifierGroup.findFirst({
      where: { id: groupId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!group) {
      throw new NotFoundException('Modifier group not found');
    }

    const existing = await this.prisma.modifierOption.findUnique({
      where: { groupId_name: { groupId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException('Option name already exists in this group');
    }

    const option = await this.prisma.modifierOption.create({
      data: {
        groupId,
        name: dto.name,
        priceDelta: dto.priceDelta ?? '0',
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        metadata: (dto.metadata as InputJsonValue) ?? undefined,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'MODIFIER_OPTION_CREATED',
      entityType: 'modifierOption',
      entityId: option.id,
      metadata: { orgId: ctx.organizationId, branchId: ctx.branchId, groupId, name: dto.name },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return option;
  }

  async listModifierOptions(groupId: string, ctx: BranchContext) {
    const group = await this.prisma.modifierGroup.findFirst({
      where: { id: groupId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!group) {
      throw new NotFoundException('Modifier group not found');
    }

    return this.prisma.modifierOption.findMany({
      where: { groupId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async updateModifierOption(
    groupId: string,
    optionId: string,
    userId: string,
    ctx: BranchContext,
    dto: UpdateModifierOptionDto,
    meta: RequestMeta,
  ) {
    const group = await this.prisma.modifierGroup.findFirst({
      where: { id: groupId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!group) {
      throw new NotFoundException('Modifier group not found');
    }

    const existing = await this.prisma.modifierOption.findFirst({
      where: { id: optionId, groupId },
    });
    if (!existing) {
      throw new NotFoundException('Modifier option not found');
    }

    if (dto.name && dto.name !== existing.name) {
      const dup = await this.prisma.modifierOption.findUnique({
        where: { groupId_name: { groupId, name: dto.name } },
      });
      if (dup) {
        throw new ConflictException('Option name already exists in this group');
      }
    }

    const option = await this.prisma.modifierOption.update({
      where: { id: optionId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.priceDelta !== undefined && { priceDelta: dto.priceDelta }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.metadata !== undefined && { metadata: dto.metadata as InputJsonValue }),
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'MODIFIER_OPTION_UPDATED',
      entityType: 'modifierOption',
      entityId: option.id,
      metadata: { orgId: ctx.organizationId, branchId: ctx.branchId, groupId, changes: dto },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return option;
  }

  // ── Item ↔ Modifier Group Assignment (M7) ──

  async assignItemModifierGroups(
    itemId: string,
    userId: string,
    ctx: BranchContext,
    dto: AssignItemModifierGroupsDto,
    meta: RequestMeta,
  ) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id: itemId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!item) {
      throw new NotFoundException('Menu item not found');
    }

    // Validate all groups belong to the same branch
    const groupIds = dto.groups.map((g) => g.groupId);
    if (groupIds.length > 0) {
      const groups = await this.prisma.modifierGroup.findMany({
        where: { id: { in: groupIds }, branchId: ctx.branchId, orgId: ctx.organizationId },
        select: { id: true },
      });
      if (groups.length !== groupIds.length) {
        throw new NotFoundException('One or more modifier groups not found in this branch');
      }
    }

    // Delete existing links and recreate
    await this.prisma.$transaction(async (tx) => {
      await tx.menuItemOnGroup.deleteMany({ where: { itemId } });
      if (dto.groups.length > 0) {
        await tx.menuItemOnGroup.createMany({
          data: dto.groups.map((g) => ({
            itemId,
            groupId: g.groupId,
            sortOrder: g.sortOrder ?? 0,
          })),
        });
      }
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'MENU_ITEM_MODIFIER_GROUPS_ASSIGNED',
      entityType: 'menuItem',
      entityId: itemId,
      metadata: { orgId: ctx.organizationId, branchId: ctx.branchId, groupIds },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.listItemModifierGroups(itemId, ctx);
  }

  async listItemModifierGroups(itemId: string, ctx: BranchContext) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id: itemId, branchId: ctx.branchId, orgId: ctx.organizationId },
      select: { id: true },
    });
    if (!item) {
      throw new NotFoundException('Menu item not found');
    }

    const links = await this.prisma.menuItemOnGroup.findMany({
      where: { itemId },
      orderBy: { sortOrder: 'asc' },
      include: {
        modifierGroup: {
          include: {
            options: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
              select: {
                id: true,
                name: true,
                priceDelta: true,
                sortOrder: true,
              },
            },
          },
        },
      },
    });

    return links
      .filter((link) => link.modifierGroup.isActive)
      .map((link) => ({
        id: link.modifierGroup.id,
        name: link.modifierGroup.name,
        min: link.modifierGroup.min,
        max: link.modifierGroup.max,
        required: link.modifierGroup.required,
        sortOrder: link.sortOrder,
        options: link.modifierGroup.options,
      }));
  }
}
