import { Test, TestingModule } from '@nestjs/testing';
import { RecipesService } from './recipes.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

describe('RecipesService', () => {
  let service: RecipesService;
  let prisma: Record<string, any>;
  let audit: { log: jest.Mock };

  const mockBranchCtx = {
    branchId: 'branch-1',
    organizationId: 'org-1',
    roleId: 'role-owner',
  };
  const mockMeta = { ipAddress: '127.0.0.1', userAgent: 'test' };

  beforeEach(async () => {
    prisma = {
      inventoryItem: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      recipeIngredient: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        deleteMany: jest.fn(),
      },
      menuItem: {
        findFirst: jest.fn(),
      },
      menuItemServing: {
        findMany: jest.fn(),
      },
      modifierOption: {
        findMany: jest.fn(),
      },
      role: {
        findUnique: jest.fn(),
      },
      orgSettings: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((fn: (tx: any) => Promise<any>) => fn(prisma)),
    };

    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecipesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<RecipesService>(RecipesService);
  });

  // ── Inventory Items ──

  it('should create an inventory item', async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue(null);
    prisma.inventoryItem.create.mockResolvedValue({
      id: 'inv-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      name: 'Beef Patty',
      unit: 'kg',
      theoreticalUnitCost: new Decimal('12.500'),
      isActive: true,
    });

    const result = await service.createInventoryItem(
      'user-1',
      mockBranchCtx,
      { name: 'Beef Patty', unit: 'kg', theoreticalUnitCost: '12.500' },
      mockMeta,
    );

    expect(result.name).toBe('Beef Patty');
    expect(prisma.inventoryItem.create).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'INVENTORY_ITEM_CREATED' }),
    );
  });

  it('should reject duplicate inventory item name per branch', async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue({ id: 'inv-existing', name: 'Beef Patty' });

    await expect(
      service.createInventoryItem(
        'user-1',
        mockBranchCtx,
        { name: 'Beef Patty', unit: 'kg' },
        mockMeta,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should update an inventory item', async () => {
    prisma.inventoryItem.findFirst.mockResolvedValue({
      id: 'inv-1',
      branchId: 'branch-1',
      orgId: 'org-1',
      name: 'Beef Patty',
    });
    prisma.inventoryItem.update.mockResolvedValue({
      id: 'inv-1',
      name: 'Beef Patty',
      theoreticalUnitCost: new Decimal('15.000'),
    });

    const result = await service.updateInventoryItem(
      'inv-1',
      'user-1',
      mockBranchCtx,
      { theoreticalUnitCost: '15.000' },
      mockMeta,
    );
    expect(result).toBeDefined();

    expect(prisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inv-1' } }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'INVENTORY_ITEM_UPDATED' }),
    );
  });

  it('should throw 404 when updating non-existent inventory item', async () => {
    prisma.inventoryItem.findFirst.mockResolvedValue(null);

    await expect(
      service.updateInventoryItem('inv-999', 'user-1', mockBranchCtx, { name: 'X' }, mockMeta),
    ).rejects.toThrow(NotFoundException);
  });

  it('should reject duplicate name on update', async () => {
    prisma.inventoryItem.findFirst.mockResolvedValue({
      id: 'inv-1',
      branchId: 'branch-1',
      orgId: 'org-1',
      name: 'Beef Patty',
    });
    prisma.inventoryItem.findUnique.mockResolvedValue({ id: 'inv-2', name: 'Lettuce' });

    await expect(
      service.updateInventoryItem('inv-1', 'user-1', mockBranchCtx, { name: 'Lettuce' }, mockMeta),
    ).rejects.toThrow(ConflictException);
  });

  it('should list inventory items for a branch', async () => {
    prisma.inventoryItem.findMany.mockResolvedValue([
      { id: 'inv-1', name: 'Beef Patty' },
      { id: 'inv-2', name: 'Lettuce' },
    ]);

    const result = await service.listInventoryItems(mockBranchCtx);

    expect(result).toHaveLength(2);
    expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { branchId: 'branch-1', orgId: 'org-1' },
      }),
    );
  });

  it('should get a single inventory item', async () => {
    prisma.inventoryItem.findFirst.mockResolvedValue({ id: 'inv-1', name: 'Beef Patty' });

    const result = await service.getInventoryItem('inv-1', mockBranchCtx);
    expect(result.id).toBe('inv-1');
  });

  it('should throw 404 for non-existent inventory item', async () => {
    prisma.inventoryItem.findFirst.mockResolvedValue(null);

    await expect(service.getInventoryItem('inv-999', mockBranchCtx)).rejects.toThrow(
      NotFoundException,
    );
  });

  // ── Set Recipe ──

  const mockMenuItem = {
    id: 'item-1',
    branchId: 'branch-1',
    orgId: 'org-1',
    name: 'Beef Burger',
    price: new Decimal('15.00'),
  };

  const mockInventoryItems = [
    { id: 'inv-bun', name: 'Bun', theoreticalUnitCost: new Decimal('0.500') },
    { id: 'inv-patty', name: 'Beef Patty', theoreticalUnitCost: new Decimal('3.000') },
  ];

  const setRecipeDto = {
    ingredients: [
      { inventoryItemId: 'inv-bun', qtyPerUnit: '2', unit: 'pcs' },
      { inventoryItemId: 'inv-patty', qtyPerUnit: '0.200', wastePct: '5', unit: 'kg' },
    ],
  };

  it('should set a new recipe (first time)', async () => {
    prisma.menuItem.findFirst.mockResolvedValue(mockMenuItem);
    prisma.inventoryItem.findMany.mockResolvedValue(mockInventoryItems);
    prisma.recipeIngredient.count.mockResolvedValue(0); // no existing recipe
    prisma.recipeIngredient.deleteMany.mockResolvedValue({ count: 0 });
    prisma.recipeIngredient.create
      .mockResolvedValueOnce({
        id: 'ri-1',
        inventoryItemId: 'inv-bun',
        qtyPerUnit: new Decimal('2'),
        wastePct: new Decimal('0'),
        unit: 'pcs',
        inventoryItem: mockInventoryItems[0],
      })
      .mockResolvedValueOnce({
        id: 'ri-2',
        inventoryItemId: 'inv-patty',
        qtyPerUnit: new Decimal('0.200'),
        wastePct: new Decimal('5'),
        unit: 'kg',
        inventoryItem: mockInventoryItems[1],
      });

    const result = await service.setRecipe(
      'item-1',
      'user-1',
      mockBranchCtx,
      setRecipeDto,
      mockMeta,
    );

    expect(result.menuItemId).toBe('item-1');
    expect(result.ingredientCount).toBe(2);
    expect(prisma.recipeIngredient.deleteMany).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'RECIPE_SET' }));
  });

  it('should replace an existing recipe (atomic)', async () => {
    prisma.menuItem.findFirst.mockResolvedValue(mockMenuItem);
    prisma.inventoryItem.findMany.mockResolvedValue(mockInventoryItems);
    prisma.recipeIngredient.count.mockResolvedValue(3); // existing recipe rows exist
    prisma.recipeIngredient.deleteMany.mockResolvedValue({ count: 3 });
    prisma.recipeIngredient.create
      .mockResolvedValueOnce({
        id: 'ri-new-1',
        inventoryItemId: 'inv-bun',
        qtyPerUnit: new Decimal('2'),
        wastePct: new Decimal('0'),
        unit: 'pcs',
        inventoryItem: mockInventoryItems[0],
      })
      .mockResolvedValueOnce({
        id: 'ri-new-2',
        inventoryItemId: 'inv-patty',
        qtyPerUnit: new Decimal('0.200'),
        wastePct: new Decimal('5'),
        unit: 'kg',
        inventoryItem: mockInventoryItems[1],
      });

    const result = await service.setRecipe(
      'item-1',
      'user-1',
      mockBranchCtx,
      setRecipeDto,
      mockMeta,
    );

    expect(result.ingredientCount).toBe(2);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'RECIPE_UPDATED' }));
  });

  it('should throw 404 when menu item not found', async () => {
    prisma.menuItem.findFirst.mockResolvedValue(null);

    await expect(
      service.setRecipe('item-missing', 'user-1', mockBranchCtx, setRecipeDto, mockMeta),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw 404 when inventory item not found', async () => {
    prisma.menuItem.findFirst.mockResolvedValue(mockMenuItem);
    prisma.inventoryItem.findMany.mockResolvedValue([mockInventoryItems[0]]); // missing inv-patty

    await expect(
      service.setRecipe('item-1', 'user-1', mockBranchCtx, setRecipeDto, mockMeta),
    ).rejects.toThrow(NotFoundException);
  });

  it('should validate serving IDs when provided', async () => {
    const dtoWithServing = {
      ingredients: [
        {
          inventoryItemId: 'inv-bun',
          qtyPerUnit: '2',
          unit: 'pcs',
          menuItemServingId: 'srv-missing',
        },
      ],
    };
    prisma.menuItem.findFirst.mockResolvedValue(mockMenuItem);
    prisma.inventoryItem.findMany.mockResolvedValue([mockInventoryItems[0]]);
    prisma.menuItemServing.findMany.mockResolvedValue([]); // serving not found

    await expect(
      service.setRecipe('item-1', 'user-1', mockBranchCtx, dtoWithServing, mockMeta),
    ).rejects.toThrow(NotFoundException);
  });

  it('should validate modifier option IDs when provided', async () => {
    const dtoWithModifier = {
      ingredients: [
        {
          inventoryItemId: 'inv-bun',
          qtyPerUnit: '1',
          unit: 'pcs',
          modifierOptionId: 'mod-missing',
        },
      ],
    };
    prisma.menuItem.findFirst.mockResolvedValue(mockMenuItem);
    prisma.inventoryItem.findMany.mockResolvedValue([mockInventoryItems[0]]);
    prisma.modifierOption.findMany.mockResolvedValue([]); // modifier not found

    await expect(
      service.setRecipe('item-1', 'user-1', mockBranchCtx, dtoWithModifier, mockMeta),
    ).rejects.toThrow(NotFoundException);
  });

  // ── Get Recipe ──

  it('should get recipe with grouped ingredients', async () => {
    prisma.menuItem.findFirst.mockResolvedValue({
      ...mockMenuItem,
      category: { name: 'Burgers' },
      servings: [],
    });
    prisma.recipeIngredient.findMany.mockResolvedValue([
      {
        id: 'ri-1',
        inventoryItem: { id: 'inv-bun', name: 'Bun' },
        qtyPerUnit: new Decimal('2'),
        wastePct: new Decimal('0'),
        unit: 'pcs',
        notes: null,
        modifierOptionId: null,
        menuItemServingId: null,
        modifierOption: null,
        menuItemServing: null,
        createdAt: new Date(),
      },
      {
        id: 'ri-2',
        inventoryItem: { id: 'inv-cheese', name: 'Cheese Slice' },
        qtyPerUnit: new Decimal('1'),
        wastePct: new Decimal('0'),
        unit: 'slice',
        notes: null,
        modifierOptionId: 'mod-extra-cheese',
        menuItemServingId: null,
        modifierOption: { name: 'Extra Cheese', group: { name: 'Cheese Options' } },
        menuItemServing: null,
        createdAt: new Date(),
      },
    ]);

    const result = await service.getRecipe('item-1', mockBranchCtx);

    expect(result.menuItem.name).toBe('Beef Burger');
    expect(result.baseIngredients).toHaveLength(1);
    expect(result.modifierIngredients).toHaveLength(1);
    expect(result.modifierIngredients[0].modifierGroupName).toBe('Cheese Options');
  });

  it('should throw 404 when getting recipe for non-existent menu item', async () => {
    prisma.menuItem.findFirst.mockResolvedValue(null);

    await expect(service.getRecipe('item-missing', mockBranchCtx)).rejects.toThrow(
      NotFoundException,
    );
  });

  // ── Cost Breakdown ──

  const ownerCaller = {
    userId: 'user-owner',
    permissions: ['pos:cost:read', 'pos:recipe:read'],
    roleLevel: 5,
  };

  it('should calculate recipe cost correctly', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'role-owner', level: 'L5', jobRole: null });
    prisma.menuItem.findFirst.mockResolvedValue({
      ...mockMenuItem,
      servings: [],
    });
    prisma.recipeIngredient.findMany.mockResolvedValue([
      {
        id: 'ri-1',
        inventoryItem: {
          id: 'inv-bun',
          name: 'Bun',
          theoreticalUnitCost: new Decimal('0.500'),
        },
        qtyPerUnit: new Decimal('2'),
        wastePct: new Decimal('0'),
        unit: 'pcs',
        modifierOptionId: null,
        menuItemServingId: null,
        modifierOption: null,
        menuItemServing: null,
        createdAt: new Date(),
      },
      {
        id: 'ri-2',
        inventoryItem: {
          id: 'inv-patty',
          name: 'Beef Patty',
          theoreticalUnitCost: new Decimal('3.000'),
        },
        qtyPerUnit: new Decimal('0.200'),
        wastePct: new Decimal('5'),
        unit: 'kg',
        modifierOptionId: null,
        menuItemServingId: null,
        modifierOption: null,
        menuItemServing: null,
        createdAt: new Date(),
      },
    ]);

    const result = await service.getRecipeCost('item-1', mockBranchCtx, ownerCaller, mockMeta);

    // Bun: effectiveQty = 2 × 1.00 = 2, extendedCost = 2 × 0.5 = 1.000
    // Patty: effectiveQty = 0.2 × 1.05 = 0.21, extendedCost = 0.21 × 3 = 0.630
    // Total COGS = 1.630
    expect(result.totalTheoreticalCogs).toBe('1.63');
    expect(result.menuItemName).toBe('Beef Burger');
    expect(result.sellingPrice).toBe('15');
    // margin = 15 - 1.63 = 13.37
    expect(result.margin).toBe('13.37');
    expect(result.ingredientCount).toBe(2);
  });

  it('should use serving price when servingId provided', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'role-owner', level: 'L5', jobRole: null });
    prisma.menuItem.findFirst.mockResolvedValue({
      ...mockMenuItem,
      servings: [
        {
          id: 'srv-large',
          format: 'LARGE',
          label: null,
          price: new Decimal('20.00'),
          isDefault: false,
          isActive: true,
        },
        {
          id: 'srv-regular',
          format: 'REGULAR',
          label: null,
          price: new Decimal('15.00'),
          isDefault: true,
          isActive: true,
        },
      ],
    });
    prisma.recipeIngredient.findMany.mockResolvedValue([
      {
        id: 'ri-1',
        inventoryItem: {
          id: 'inv-bun',
          name: 'Bun',
          theoreticalUnitCost: new Decimal('0.500'),
        },
        qtyPerUnit: new Decimal('1'),
        wastePct: new Decimal('0'),
        unit: 'pcs',
        modifierOptionId: null,
        menuItemServingId: null,
        modifierOption: null,
        menuItemServing: null,
        createdAt: new Date(),
      },
    ]);

    const result = await service.getRecipeCost(
      'item-1',
      mockBranchCtx,
      ownerCaller,
      mockMeta,
      'srv-large',
    );

    expect(result.sellingPrice).toBe('20');
    expect(result.sellingPriceSource).toBe('serving:LARGE');
  });

  it('should use default serving price when no servingId given', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'role-owner', level: 'L5', jobRole: null });
    prisma.menuItem.findFirst.mockResolvedValue({
      ...mockMenuItem,
      servings: [
        {
          id: 'srv-1',
          format: 'REGULAR',
          label: null,
          price: new Decimal('18.00'),
          isDefault: true,
          isActive: true,
        },
      ],
    });
    prisma.recipeIngredient.findMany.mockResolvedValue([]);

    const result = await service.getRecipeCost('item-1', mockBranchCtx, ownerCaller, mockMeta);

    expect(result.sellingPrice).toBe('18');
    expect(result.sellingPriceSource).toBe('defaultServing:REGULAR');
  });

  it('should mask cost for Chef when showCostToChef=false', async () => {
    prisma.role.findUnique.mockResolvedValue({
      id: 'role-chef',
      level: 'L2',
      jobRole: 'CHEF',
    });
    prisma.orgSettings.findUnique.mockResolvedValue({
      orgId: 'org-1',
      showCostToChef: false,
    });
    prisma.menuItem.findFirst.mockResolvedValue({
      ...mockMenuItem,
      servings: [],
    });
    prisma.recipeIngredient.findMany.mockResolvedValue([
      {
        id: 'ri-1',
        inventoryItem: {
          id: 'inv-bun',
          name: 'Bun',
          theoreticalUnitCost: new Decimal('0.500'),
        },
        qtyPerUnit: new Decimal('2'),
        wastePct: new Decimal('0'),
        unit: 'pcs',
        modifierOptionId: null,
        menuItemServingId: null,
        modifierOption: null,
        menuItemServing: null,
        createdAt: new Date(),
      },
    ]);

    const chefCaller = {
      userId: 'user-chef',
      permissions: ['pos:cost:read', 'pos:recipe:read'],
    };

    const result = await service.getRecipeCost('item-1', mockBranchCtx, chefCaller, mockMeta);

    expect(result.totalTheoreticalCogs).toBeUndefined();
    expect(result.margin).toBeUndefined();
    expect(result.marginPercent).toBeUndefined();
    // Row-level cost should also be masked
    const rows = result.rows as any[];
    expect(rows[0].unitCost).toBeUndefined();
    expect(rows[0].extendedCost).toBeUndefined();
  });

  it('should show cost for Chef when showCostToChef=true', async () => {
    prisma.role.findUnique.mockResolvedValue({
      id: 'role-chef',
      level: 'L2',
      jobRole: 'CHEF',
    });
    prisma.orgSettings.findUnique.mockResolvedValue({
      orgId: 'org-1',
      showCostToChef: true,
    });
    prisma.menuItem.findFirst.mockResolvedValue({
      ...mockMenuItem,
      servings: [],
    });
    prisma.recipeIngredient.findMany.mockResolvedValue([
      {
        id: 'ri-1',
        inventoryItem: {
          id: 'inv-bun',
          name: 'Bun',
          theoreticalUnitCost: new Decimal('0.500'),
        },
        qtyPerUnit: new Decimal('2'),
        wastePct: new Decimal('0'),
        unit: 'pcs',
        modifierOptionId: null,
        menuItemServingId: null,
        modifierOption: null,
        menuItemServing: null,
        createdAt: new Date(),
      },
    ]);

    const chefCaller = {
      userId: 'user-chef',
      permissions: ['pos:cost:read', 'pos:recipe:read'],
    };

    const result = await service.getRecipeCost('item-1', mockBranchCtx, chefCaller, mockMeta);

    expect(result.totalTheoreticalCogs).toBeDefined();
    expect(result.margin).toBeDefined();
  });

  it('should deny cost access without pos:cost:read permission', async () => {
    const noCostCaller = {
      userId: 'user-waiter',
      permissions: ['pos:recipe:read'],
    };

    await expect(
      service.getRecipeCost('item-1', mockBranchCtx, noCostCaller, mockMeta),
    ).rejects.toThrow(ForbiddenException);

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RECIPE_ACCESS_DENIED' }),
    );
  });

  it('should throw 404 for cost of non-existent menu item', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'role-owner', level: 'L5', jobRole: null });
    prisma.menuItem.findFirst.mockResolvedValue(null);

    await expect(
      service.getRecipeCost('item-missing', mockBranchCtx, ownerCaller, mockMeta),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw 404 for non-existent serving in cost query', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'role-owner', level: 'L5', jobRole: null });
    prisma.menuItem.findFirst.mockResolvedValue({
      ...mockMenuItem,
      servings: [
        {
          id: 'srv-1',
          format: 'REGULAR',
          label: null,
          price: new Decimal('15'),
          isDefault: true,
          isActive: true,
        },
      ],
    });
    prisma.recipeIngredient.findMany.mockResolvedValue([]);

    await expect(
      service.getRecipeCost('item-1', mockBranchCtx, ownerCaller, mockMeta, 'srv-unknown'),
    ).rejects.toThrow(NotFoundException);
  });

  // ── Modifier-linked ingredient costing ──

  it('should include modifier-linked ingredient in cost calculation', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'role-owner', level: 'L5', jobRole: null });
    prisma.menuItem.findFirst.mockResolvedValue({
      ...mockMenuItem,
      servings: [],
    });
    prisma.recipeIngredient.findMany.mockResolvedValue([
      {
        id: 'ri-base',
        inventoryItem: {
          id: 'inv-bun',
          name: 'Bun',
          theoreticalUnitCost: new Decimal('0.500'),
        },
        qtyPerUnit: new Decimal('1'),
        wastePct: new Decimal('0'),
        unit: 'pcs',
        modifierOptionId: null,
        menuItemServingId: null,
        modifierOption: null,
        menuItemServing: null,
        createdAt: new Date('2024-01-01'),
      },
      {
        id: 'ri-mod',
        inventoryItem: {
          id: 'inv-cheese',
          name: 'Cheese Slice',
          theoreticalUnitCost: new Decimal('0.300'),
        },
        qtyPerUnit: new Decimal('1'),
        wastePct: new Decimal('0'),
        unit: 'slice',
        modifierOptionId: 'mod-extra-cheese',
        menuItemServingId: null,
        modifierOption: { name: 'Extra Cheese', group: { name: 'Cheese Options' } },
        menuItemServing: null,
        createdAt: new Date('2024-01-02'),
      },
    ]);

    const result = await service.getRecipeCost('item-1', mockBranchCtx, ownerCaller, mockMeta);

    // Bun: 1 × 0.5 = 0.5, Cheese: 1 × 0.3 = 0.3, Total = 0.8
    expect(result.totalTheoreticalCogs).toBe('0.8');
    expect(result.ingredientCount).toBe(2);
    const rows = result.rows as any[];
    expect(rows[1].modifierOptionId).toBe('mod-extra-cheese');
    expect(rows[1].modifierOptionName).toBe('Extra Cheese');
  });
});
