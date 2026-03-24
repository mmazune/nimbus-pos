import { Test, TestingModule } from '@nestjs/testing';
import { MenuService } from './menu.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { MenuItemType, PrepStation, MenuSection, ServingFormat } from '@prisma/client';

describe('MenuService', () => {
  let service: MenuService;
  let prisma: Record<string, any>;
  let audit: { log: jest.Mock };

  const mockBranchCtx = {
    branchId: 'branch-1',
    organizationId: 'org-1',
  };
  const mockMeta = { ipAddress: '127.0.0.1', userAgent: 'test' };

  beforeEach(async () => {
    prisma = {
      category: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      taxCategory: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      menuItem: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      menuBrowseGroup: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      menuBrowseSubgroup: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      menuItemServing: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      modifierGroup: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      modifierOption: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      menuItemOnGroup: {
        createMany: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((fn: (tx: any) => Promise<any>) => fn(prisma)),
    };

    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenuService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<MenuService>(MenuService);
  });

  // ── Categories ──

  it('should create a category', async () => {
    prisma.category.findUnique.mockResolvedValue(null);
    prisma.category.create.mockResolvedValue({
      id: 'cat-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      name: 'Starters',
      sortOrder: 0,
      isActive: true,
    });

    const result = await service.createCategory(
      'user-1',
      mockBranchCtx,
      { name: 'Starters' },
      mockMeta,
    );

    expect(result.name).toBe('Starters');
    expect(prisma.category.create).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MENU_CATEGORY_CREATED' }),
    );
  });

  it('should reject duplicate category name per branch', async () => {
    prisma.category.findUnique.mockResolvedValue({
      id: 'cat-existing',
      name: 'Starters',
    });

    await expect(
      service.createCategory('user-1', mockBranchCtx, { name: 'Starters' }, mockMeta),
    ).rejects.toThrow(ConflictException);
  });

  // ── Tax Categories ──

  it('should create a tax category', async () => {
    prisma.taxCategory.findUnique.mockResolvedValue(null);
    prisma.taxCategory.create.mockResolvedValue({
      id: 'tc-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      name: 'VAT Standard',
      rate: 18.0,
      isActive: true,
    });

    const result = await service.createTaxCategory(
      'user-1',
      mockBranchCtx,
      { name: 'VAT Standard', rate: 18.0 },
      mockMeta,
    );

    expect(result.name).toBe('VAT Standard');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TAX_CATEGORY_CREATED' }),
    );
  });

  // ── Menu Items ──

  it('should create a menu item', async () => {
    prisma.category.findFirst.mockResolvedValue({ id: 'cat-1', branchId: 'branch-1' });
    prisma.menuItem.findUnique.mockResolvedValue(null);
    prisma.menuItem.create.mockResolvedValue({
      id: 'item-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      categoryId: 'cat-1',
      name: 'Bruschetta',
      price: 12.5,
      itemType: MenuItemType.FOOD,
      station: PrepStation.KITCHEN,
      isActive: true,
    });

    const result = await service.createMenuItem(
      'user-1',
      mockBranchCtx,
      {
        name: 'Bruschetta',
        categoryId: 'cat-1',
        price: 12.5,
        itemType: MenuItemType.FOOD,
        station: PrepStation.KITCHEN,
      },
      mockMeta,
    );

    expect(result.name).toBe('Bruschetta');
    expect(result.price).toBe(12.5);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MENU_ITEM_CREATED' }),
    );
  });

  it('should reject duplicate menu item name per category', async () => {
    prisma.category.findFirst.mockResolvedValue({ id: 'cat-1', branchId: 'branch-1' });
    prisma.menuItem.findUnique.mockResolvedValue({ id: 'item-existing', name: 'Bruschetta' });

    await expect(
      service.createMenuItem(
        'user-1',
        mockBranchCtx,
        {
          name: 'Bruschetta',
          categoryId: 'cat-1',
          price: 12.5,
          itemType: MenuItemType.FOOD,
        },
        mockMeta,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject menu item with invalid category', async () => {
    prisma.category.findFirst.mockResolvedValue(null);

    await expect(
      service.createMenuItem(
        'user-1',
        mockBranchCtx,
        {
          name: 'Bruschetta',
          categoryId: 'nonexistent',
          price: 12.5,
          itemType: MenuItemType.FOOD,
        },
        mockMeta,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  // ── Catalog ──

  it('should return catalog grouped by active categories with active items', async () => {
    prisma.category.findMany.mockResolvedValue([
      {
        id: 'cat-1',
        name: 'Starters',
        sortOrder: 0,
        isActive: true,
        menuItems: [
          {
            id: 'item-1',
            name: 'Bruschetta',
            sku: null,
            description: null,
            price: 12.5,
            itemType: 'FOOD',
            station: 'KITCHEN',
            sortOrder: 0,
            taxCategory: { id: 'tc-1', name: 'VAT Standard', rate: 18.0 },
            browseGroup: null,
            browseSubgroup: null,
            servings: [],
          },
        ],
      },
    ]);
    prisma.taxCategory.findMany.mockResolvedValue([
      { id: 'tc-1', name: 'VAT Standard', rate: 18.0 },
    ]);

    const result = await service.getCatalog(mockBranchCtx);

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].name).toBe('Starters');
    expect(result.categories[0].items).toHaveLength(1);
    expect(result.categories[0].items[0].name).toBe('Bruschetta');
    expect(result.categories[0].items[0].taxCategory?.name).toBe('VAT Standard');
  });

  // ── Branch isolation ──

  it('should list categories only for the given branch', async () => {
    prisma.category.findMany.mockResolvedValue([]);

    await service.listCategories(mockBranchCtx);

    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { branchId: 'branch-1', orgId: 'org-1' },
      }),
    );
  });

  // ── Not Found ──

  it('should throw NotFoundException for non-existent category', async () => {
    prisma.category.findFirst.mockResolvedValue(null);

    await expect(service.getCategory('nonexistent', mockBranchCtx)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw NotFoundException for non-existent menu item', async () => {
    prisma.menuItem.findFirst.mockResolvedValue(null);

    await expect(service.getMenuItem('nonexistent', mockBranchCtx)).rejects.toThrow(
      NotFoundException,
    );
  });

  // ── Browse Groups (M6.1) ──

  it('should create a browse group', async () => {
    prisma.menuBrowseGroup.findUnique.mockResolvedValue(null);
    prisma.menuBrowseGroup.create.mockResolvedValue({
      id: 'bg-1',
      name: 'Starters',
      section: MenuSection.FOOD,
      sortOrder: 0,
      isActive: true,
    });

    const result = await service.createBrowseGroup(
      'user-1',
      mockBranchCtx,
      { name: 'Starters', section: MenuSection.FOOD },
      mockMeta,
    );

    expect(result.name).toBe('Starters');
    expect(result.section).toBe('FOOD');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MENU_BROWSE_GROUP_CREATED' }),
    );
  });

  it('should throw ConflictException for duplicate browse group name', async () => {
    prisma.menuBrowseGroup.findUnique.mockResolvedValue({ id: 'bg-1', name: 'Starters' });

    await expect(
      service.createBrowseGroup(
        'user-1',
        mockBranchCtx,
        { name: 'Starters', section: MenuSection.FOOD },
        mockMeta,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should list browse groups with subgroups', async () => {
    prisma.menuBrowseGroup.findMany.mockResolvedValue([
      { id: 'bg-1', name: 'Starters', section: 'FOOD', sortOrder: 0, subgroups: [] },
    ]);

    const result = await service.listBrowseGroups(mockBranchCtx);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Starters');
  });

  it('should throw NotFoundException for non-existent browse group', async () => {
    prisma.menuBrowseGroup.findFirst.mockResolvedValue(null);

    await expect(service.getBrowseGroup('nonexistent', mockBranchCtx)).rejects.toThrow(
      NotFoundException,
    );
  });

  // ── Browse Subgroups (M6.1) ──

  it('should create a browse subgroup', async () => {
    prisma.menuBrowseGroup.findFirst.mockResolvedValue({ id: 'bg-1', branchId: 'branch-1' });
    prisma.menuBrowseSubgroup.findUnique.mockResolvedValue(null);
    prisma.menuBrowseSubgroup.create.mockResolvedValue({
      id: 'bsg-1',
      groupId: 'bg-1',
      name: 'Cold Starters',
      sortOrder: 0,
      isActive: true,
    });

    const result = await service.createBrowseSubgroup(
      'bg-1',
      'user-1',
      mockBranchCtx,
      { name: 'Cold Starters' },
      mockMeta,
    );

    expect(result.name).toBe('Cold Starters');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MENU_BROWSE_SUBGROUP_CREATED' }),
    );
  });

  it('should throw NotFoundException when subgroup parent group not found', async () => {
    prisma.menuBrowseGroup.findFirst.mockResolvedValue(null);

    await expect(
      service.createBrowseSubgroup(
        'nonexistent',
        'user-1',
        mockBranchCtx,
        { name: 'Sub' },
        mockMeta,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  // ── Menu Item Servings (M6.1) ──

  it('should create a menu item serving', async () => {
    prisma.menuItem.findFirst.mockResolvedValue({ id: 'item-1', branchId: 'branch-1' });
    prisma.menuItemServing.findFirst.mockResolvedValue(null);
    prisma.menuItemServing.create.mockResolvedValue({
      id: 'srv-1',
      menuItemId: 'item-1',
      format: ServingFormat.GLASS,
      label: null,
      price: 12.0,
      isDefault: true,
      sortOrder: 0,
    });

    const result = await service.createMenuItemServing(
      'item-1',
      'user-1',
      mockBranchCtx,
      { format: ServingFormat.GLASS, price: 12.0 },
      mockMeta,
    );

    expect(result.format).toBe('GLASS');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MENU_ITEM_SERVING_CREATED' }),
    );
  });

  it('should throw ConflictException for duplicate serving format+label', async () => {
    prisma.menuItem.findFirst.mockResolvedValue({ id: 'item-1', branchId: 'branch-1' });
    prisma.menuItemServing.findFirst.mockResolvedValue({ id: 'srv-1' });

    await expect(
      service.createMenuItemServing(
        'item-1',
        'user-1',
        mockBranchCtx,
        { format: ServingFormat.GLASS, price: 12.0 },
        mockMeta,
      ),
    ).rejects.toThrow(ConflictException);
  });

  // ── Assign Browse (M6.1) ──

  it('should assign browse group to a menu item', async () => {
    prisma.menuItem.findFirst.mockResolvedValue({ id: 'item-1', branchId: 'branch-1' });
    prisma.menuBrowseGroup.findFirst.mockResolvedValue({ id: 'bg-1', branchId: 'branch-1' });
    prisma.menuItem.update.mockResolvedValue({
      id: 'item-1',
      browseGroupId: 'bg-1',
      browseSubgroupId: null,
    });

    const result = await service.assignItemBrowse(
      'item-1',
      'user-1',
      mockBranchCtx,
      { browseGroupId: 'bg-1' },
      mockMeta,
    );

    expect(result.browseGroupId).toBe('bg-1');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MENU_ITEM_BROWSE_ASSIGNED' }),
    );
  });

  // ── Navigation (M6.1) ──

  it('should return navigation tree grouped by section', async () => {
    prisma.menuBrowseGroup.findMany.mockResolvedValue([
      {
        id: 'bg-1',
        name: 'Starters',
        section: 'FOOD',
        sortOrder: 0,
        isActive: true,
        subgroups: [{ id: 'bsg-1', name: 'Cold Starters', sortOrder: 0, isActive: true }],
      },
      {
        id: 'bg-2',
        name: 'Cocktails',
        section: 'DRINKS',
        sortOrder: 0,
        isActive: true,
        subgroups: [],
      },
    ]);

    const result = await service.getNavigation(mockBranchCtx, {});

    expect(result).toHaveLength(2);
    const food = result.find((s: any) => s.section === 'FOOD');
    expect(food).toBeDefined();
    expect(food!.groups).toHaveLength(1);
    expect(food!.groups[0].subgroups).toHaveLength(1);
  });

  // ── Modifier Groups (M7) ──

  it('should create a modifier group', async () => {
    prisma.modifierGroup.findUnique.mockResolvedValue(null);
    prisma.modifierGroup.create.mockResolvedValue({
      id: 'mg-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      name: 'Size',
      min: 1,
      max: 1,
      required: true,
      sortOrder: 0,
      isActive: true,
    });

    const result = await service.createModifierGroup(
      'user-1',
      mockBranchCtx,
      { name: 'Size', min: 1, max: 1, required: true },
      mockMeta,
    );

    expect(result.name).toBe('Size');
    expect(result.required).toBe(true);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MODIFIER_GROUP_CREATED' }),
    );
  });

  it('should reject duplicate modifier group name per branch', async () => {
    prisma.modifierGroup.findUnique.mockResolvedValue({ id: 'mg-existing', name: 'Size' });

    await expect(
      service.createModifierGroup('user-1', mockBranchCtx, { name: 'Size' }, mockMeta),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject modifier group when min > max', async () => {
    prisma.modifierGroup.findUnique.mockResolvedValue(null);

    await expect(
      service.createModifierGroup(
        'user-1',
        mockBranchCtx,
        { name: 'Bad', min: 5, max: 2 },
        mockMeta,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should list modifier groups with options', async () => {
    prisma.modifierGroup.findMany.mockResolvedValue([{ id: 'mg-1', name: 'Size', options: [] }]);

    const result = await service.listModifierGroups(mockBranchCtx);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Size');
  });

  it('should throw NotFoundException for non-existent modifier group', async () => {
    prisma.modifierGroup.findFirst.mockResolvedValue(null);

    await expect(service.getModifierGroup('nonexistent', mockBranchCtx)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should update a modifier group', async () => {
    prisma.modifierGroup.findFirst.mockResolvedValue({
      id: 'mg-1',
      name: 'Size',
      min: 1,
      max: 1,
    });
    prisma.modifierGroup.update.mockResolvedValue({
      id: 'mg-1',
      name: 'Sizing',
      min: 1,
      max: 3,
    });

    const result = await service.updateModifierGroup(
      'mg-1',
      'user-1',
      mockBranchCtx,
      { name: 'Sizing', max: 3 },
      mockMeta,
    );

    expect(result.name).toBe('Sizing');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MODIFIER_GROUP_UPDATED' }),
    );
  });

  // ── Modifier Options (M7) ──

  it('should create a modifier option', async () => {
    prisma.modifierGroup.findFirst.mockResolvedValue({ id: 'mg-1', branchId: 'branch-1' });
    prisma.modifierOption.findUnique.mockResolvedValue(null);
    prisma.modifierOption.create.mockResolvedValue({
      id: 'mo-1',
      groupId: 'mg-1',
      name: 'Small',
      priceDelta: '0.00',
      sortOrder: 0,
      isActive: true,
    });

    const result = await service.createModifierOption(
      'mg-1',
      'user-1',
      mockBranchCtx,
      { name: 'Small' },
      mockMeta,
    );

    expect(result.name).toBe('Small');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MODIFIER_OPTION_CREATED' }),
    );
  });

  it('should reject duplicate option name per group', async () => {
    prisma.modifierGroup.findFirst.mockResolvedValue({ id: 'mg-1', branchId: 'branch-1' });
    prisma.modifierOption.findUnique.mockResolvedValue({ id: 'mo-existing', name: 'Small' });

    await expect(
      service.createModifierOption('mg-1', 'user-1', mockBranchCtx, { name: 'Small' }, mockMeta),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException when creating option for non-existent group', async () => {
    prisma.modifierGroup.findFirst.mockResolvedValue(null);

    await expect(
      service.createModifierOption(
        'nonexistent',
        'user-1',
        mockBranchCtx,
        { name: 'Small' },
        mockMeta,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should update a modifier option', async () => {
    prisma.modifierGroup.findFirst.mockResolvedValue({ id: 'mg-1', branchId: 'branch-1' });
    prisma.modifierOption.findFirst.mockResolvedValue({
      id: 'mo-1',
      groupId: 'mg-1',
      name: 'Small',
    });
    prisma.modifierOption.update.mockResolvedValue({
      id: 'mo-1',
      name: 'Small',
      priceDelta: '1.50',
    });

    const result = await service.updateModifierOption(
      'mg-1',
      'mo-1',
      'user-1',
      mockBranchCtx,
      { priceDelta: '1.50' },
      mockMeta,
    );

    expect(result.priceDelta).toBe('1.50');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MODIFIER_OPTION_UPDATED' }),
    );
  });

  // ── Item ↔ Modifier Group Assignment (M7) ──

  it('should assign modifier groups to a menu item', async () => {
    prisma.menuItem.findFirst.mockResolvedValue({ id: 'item-1', branchId: 'branch-1' });
    prisma.modifierGroup.findMany.mockResolvedValue([{ id: 'mg-1' }, { id: 'mg-2' }]);
    prisma.menuItemOnGroup.deleteMany.mockResolvedValue({ count: 0 });
    prisma.menuItemOnGroup.createMany.mockResolvedValue({ count: 2 });
    // For listItemModifierGroups called at end of assign
    prisma.menuItemOnGroup.findMany.mockResolvedValue([
      {
        sortOrder: 0,
        modifierGroup: {
          id: 'mg-1',
          name: 'Size',
          min: 1,
          max: 1,
          required: true,
          isActive: true,
          options: [],
        },
      },
      {
        sortOrder: 1,
        modifierGroup: {
          id: 'mg-2',
          name: 'Extras',
          min: 0,
          max: 3,
          required: false,
          isActive: true,
          options: [],
        },
      },
    ]);

    const result = await service.assignItemModifierGroups(
      'item-1',
      'user-1',
      mockBranchCtx,
      {
        groups: [
          { groupId: 'mg-1', sortOrder: 0 },
          { groupId: 'mg-2', sortOrder: 1 },
        ],
      },
      mockMeta,
    );

    expect(result).toHaveLength(2);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MENU_ITEM_MODIFIER_GROUPS_ASSIGNED' }),
    );
  });

  it('should throw NotFoundException when assigning groups to non-existent item', async () => {
    prisma.menuItem.findFirst.mockResolvedValue(null);

    await expect(
      service.assignItemModifierGroups(
        'nonexistent',
        'user-1',
        mockBranchCtx,
        { groups: [{ groupId: 'mg-1' }] },
        mockMeta,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw NotFoundException when assigned groups not found in branch', async () => {
    prisma.menuItem.findFirst.mockResolvedValue({ id: 'item-1', branchId: 'branch-1' });
    prisma.modifierGroup.findMany.mockResolvedValue([{ id: 'mg-1' }]); // Only 1 found but 2 requested

    await expect(
      service.assignItemModifierGroups(
        'item-1',
        'user-1',
        mockBranchCtx,
        { groups: [{ groupId: 'mg-1' }, { groupId: 'mg-missing' }] },
        mockMeta,
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
