import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { MenuSection } from '@prisma/client';
import { PrismaService } from '../../common/prisma';
import { availabilityView } from './availability-engine';

interface BranchContext {
  branchId: string;
  organizationId: string;
}

const SECTIONS: MenuSection[] = ['FOOD', 'DRINKS'];
const POPULAR_DAYS = 14;
const POPULAR_MAX = 20;

/** First letters of the name's words, lower case: "Lamb chops" -> "lc". */
export function initialsOf(name: string): string {
  return name
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((w) => w[0].toLowerCase())
    .join('');
}

/**
 * T2 phase 1 (E2) part a — the waiter's whole menu in one call.
 * `version` is a hash of the answer itself (no clock in it), so it changes exactly when
 * something in the answer would.
 */
@Injectable()
export class MenuWorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkspace(ctx: BranchContext, now: Date = new Date()) {
    const where = { branchId: ctx.branchId, orgId: ctx.organizationId };
    const [groups, items, sales] = await Promise.all([
      this.prisma.menuBrowseGroup.findMany({
        where: { ...where, isActive: true },
        orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          section: true,
          sortOrder: true,
          subgroups: {
            where: { isActive: true },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            select: { id: true, name: true, sortOrder: true },
          },
        },
      }),
      this.prisma.menuItem.findMany({
        where: { ...where, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          itemType: true,
          station: true,
          sortOrder: true,
          browseGroupId: true,
          browseSubgroupId: true,
          browseGroup: { select: { section: true, isActive: true } },
          isOffer: true,
          offerPrice: true,
          offerNote: true,
          taxCategory: { select: { id: true, name: true, rate: true } },
          servings: {
            where: { isActive: true },
            orderBy: [{ sortOrder: 'asc' }],
            select: {
              id: true,
              format: true,
              label: true,
              price: true,
              volumeText: true,
              isDefault: true,
            },
          },
          menuItemOnGroups: {
            orderBy: { sortOrder: 'asc' },
            select: {
              modifierGroup: {
                select: {
                  id: true,
                  name: true,
                  min: true,
                  max: true,
                  required: true,
                  isActive: true,
                  options: {
                    where: { isActive: true },
                    orderBy: [{ sortOrder: 'asc' }],
                    select: { id: true, name: true, priceDelta: true },
                  },
                },
              },
            },
          },
          availability: true,
        },
      }),
      this.prisma.$queryRaw<{ menu_item_id: string; qty: bigint }[]>`
        SELECT oi."menu_item_id", SUM(oi."quantity")::bigint AS qty
          FROM "order_items" oi JOIN "orders" o ON o."id" = oi."order_id"
         WHERE o."branch_id" = ${ctx.branchId}
           AND oi."sent_at" >= ${new Date(now.getTime() - POPULAR_DAYS * 86_400_000)}
           AND oi."voided_at" IS NULL
         GROUP BY oi."menu_item_id"
         ORDER BY qty DESC, oi."menu_item_id" ASC`,
    ]);

    const sectionOf = (it: (typeof items)[number]): MenuSection =>
      it.browseGroup?.isActive && it.browseGroup.section
        ? it.browseGroup.section
        : it.itemType === 'DRINK'
          ? 'DRINKS'
          : 'FOOD';

    const activeGroupIds = new Set(groups.map((g) => g.id));
    const outItems = items.map((it) => ({
      id: it.id,
      name: it.name,
      description: it.description,
      initials: initialsOf(it.name),
      section: sectionOf(it),
      groupId: it.browseGroupId && activeGroupIds.has(it.browseGroupId) ? it.browseGroupId : null,
      subgroupId:
        it.browseGroupId && activeGroupIds.has(it.browseGroupId) ? it.browseSubgroupId : null,
      itemType: it.itemType,
      station: it.station,
      price: it.price,
      offer:
        it.isOffer && it.offerPrice !== null
          ? { price: it.offerPrice, note: it.offerNote }
          : it.isOffer
            ? { price: null, note: it.offerNote }
            : null,
      tax: it.taxCategory,
      servings: it.servings,
      choiceGroups: it.menuItemOnGroups
        .map((g) => g.modifierGroup)
        .filter((g) => g.isActive)
        .map((g) => ({
          id: g.id,
          name: g.name,
          min: g.min,
          max: g.max,
          required: g.required,
          options: g.options,
        })),
      availability: availabilityView(it.availability),
    }));

    const qtyById = new Map(sales.map((s) => [s.menu_item_id, Number(s.qty)]));
    const sections = SECTIONS.map((section) => {
      const inSection = outItems.filter((i) => i.section === section);
      const sold = inSection
        .filter((i) => qtyById.has(i.id))
        .sort((a, b) => qtyById.get(b.id)! - qtyById.get(a.id)! || (a.id < b.id ? -1 : 1));
      const popular = [...sold, ...inSection.filter((i) => !qtyById.has(i.id))]
        .slice(0, POPULAR_MAX)
        .map((i) => i.id);
      return {
        section,
        popular,
        popularFrom: sold.length > 0 ? 'SALES_14_DAYS' : 'MENU_ORDER',
        offers: inSection.filter((i) => i.offer).map((i) => i.id),
        groups: groups
          .filter((g) => g.section === section)
          .map((g) => ({
            id: g.id,
            name: g.name,
            sortOrder: g.sortOrder,
            itemIds: inSection.filter((i) => i.groupId === g.id).map((i) => i.id),
            subgroups: g.subgroups.map((s) => ({
              ...s,
              itemIds: inSection.filter((i) => i.subgroupId === s.id).map((i) => i.id),
            })),
          })),
        ungroupedItemIds: inSection.filter((i) => !i.groupId).map((i) => i.id),
      };
    });

    const body = { branchId: ctx.branchId, sections, items: outItems };
    const version = createHash('sha1').update(JSON.stringify(body)).digest('hex').slice(0, 20);
    return { version, ...body };
  }
}
