// T2 phase 1 — a 200-item test menu for measuring /api/menu/workspace. Test helper only, never
// in the seed. Items are put away (isActive=false) afterwards, never deleted.
import { T2World } from './t2-helpers';

export async function buildTestMenu(w: T2World, count: number) {
  const tag = `WS${w.run}`;
  const food = await w.prisma.menuBrowseGroup.create({
    data: {
      orgId: w.orgId,
      branchId: w.branchId,
      section: 'FOOD',
      name: `${tag} Grills`,
      sortOrder: 90,
    },
  });
  const drinks = await w.prisma.menuBrowseGroup.create({
    data: {
      orgId: w.orgId,
      branchId: w.branchId,
      section: 'DRINKS',
      name: `${tag} Spirits`,
      sortOrder: 90,
    },
  });
  const sub = await w.prisma.menuBrowseSubgroup.create({
    data: { groupId: food.id, name: `${tag} Beef` },
  });
  const choice = await w.prisma.modifierGroup.create({
    data: {
      orgId: w.orgId,
      branchId: w.branchId,
      name: `${tag} Doneness`,
      min: 1,
      max: 1,
      required: true,
      options: {
        create: [
          { name: 'Rare', priceDelta: 0 },
          { name: 'Medium', priceDelta: 0 },
          { name: 'Well done', priceDelta: 0 },
          { name: 'Extra sauce', priceDelta: 2000 },
        ],
      },
    },
  });

  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const drink = i % 3 === 0;
    const item = await w.prisma.menuItem.create({
      data: {
        orgId: w.orgId,
        branchId: w.branchId,
        categoryId: w.categoryId,
        name: `${tag} ${drink ? 'Spirit' : 'Grill plate'} number ${i}`,
        price: 10000 + i * 100,
        itemType: drink ? 'DRINK' : 'FOOD',
        station: drink ? 'BAR' : 'KITCHEN',
        sortOrder: 500 + i,
        browseGroupId: drink ? drinks.id : food.id,
        browseSubgroupId: drink ? null : sub.id,
        ...(drink
          ? {
              servings: {
                create: [
                  { format: 'SINGLE', label: 'Single', price: 8000, isDefault: true },
                  { format: 'DOUBLE', label: 'Double', price: 15000 },
                ],
              },
            }
          : { menuItemOnGroups: { create: [{ groupId: choice.id }] } }),
      },
    });
    ids.push(item.id);
  }
  return {
    ids,
    groupId: food.id,
    withServings: ids[0],
    withChoices: ids[1],
    async putAway() {
      await w.prisma.menuItem.updateMany({ where: { id: { in: ids } }, data: { isActive: false } });
      await w.prisma.menuBrowseGroup.updateMany({
        where: { id: { in: [food.id, drinks.id] } },
        data: { isActive: false },
      });
      await w.prisma.modifierGroup.update({ where: { id: choice.id }, data: { isActive: false } });
    },
  };
}
