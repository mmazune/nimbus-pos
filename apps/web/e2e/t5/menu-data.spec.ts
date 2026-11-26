import { expect, test } from "@playwright/test";

import { applyAvailability, buildFromWorkspace, toAvailability } from "../../src/screens/order/data/menu";
import { evenShares } from "../../src/screens/order/data/seating";

/** T5 phase 2 — the workspace answer as the order screen reads it (no browser, no API). */
const ws = {
  version: "v1",
  sections: [
    {
      section: "FOOD",
      popular: ["lamb", "chips"],
      offers: ["wings"],
      groups: [
        { id: "gp", name: "Popular food", sortOrder: 0, itemIds: ["burger"], subgroups: [] },
        { id: "gg", name: "Grill", sortOrder: 2, itemIds: ["lamb", "wings"], subgroups: [] },
        { id: "gs", name: "Sides", sortOrder: 3, itemIds: ["chips"], subgroups: [] },
      ],
      ungroupedItemIds: ["loose"],
    },
  ],
  items: [
    { id: "lamb", name: "Lamb chops", section: "FOOD", groupId: "gg", price: "45000.00", availability: { state: "LOW", left: 2 } },
    { id: "wings", name: "Chicken wings", section: "FOOD", groupId: "gg", price: "24000", offer: { price: "20000", note: "Happy hour" } },
    { id: "chips", name: "Chips", section: "FOOD", groupId: "gs", price: "8000", availability: { state: "SOLD_OUT", left: 0, since: "2026-11-26T16:40:00.000Z" } },
    { id: "burger", name: "Beef burger", section: "FOOD", groupId: "gp", price: "28000", choiceGroups: [{ id: "c", name: "How cooked", min: 1, max: 1, required: true, options: [{ id: "m", name: "Medium", priceDelta: "0" }] }] },
    { id: "loose", name: "Bread roll", section: "FOOD", price: "2000" },
  ],
};

test("Popular: the manager's pinned group first, then the server's list; Offers from the server; More for loose items", () => {
  const m = buildFromWorkspace(ws);
  const groups = m.sections[0].groups;
  expect(groups.map((g) => g.name)).toEqual(["Popular", "Offers", "Grill", "Sides", "More"]);
  expect(groups[0].itemIds).toEqual(["burger", "lamb", "chips"]);
  expect(groups[1].itemIds).toEqual(["wings"]);
  expect(m.version).toBe("v1");
});

test("an offer prices the tile and keeps the usual price; choices come with the menu", () => {
  const m = buildFromWorkspace(ws);
  expect(m.items.wings.priceMinor).toBe(2_000_000);
  expect(m.items.wings.normalPriceMinor).toBe(2_400_000);
  expect(m.items.burger.choices?.[0].options[0].name).toBe("Medium");
});

test("availability: a number reads N left; sold out says since when; a change is applied once", () => {
  expect(toAvailability({ state: "LOW", left: 2 })).toEqual({ state: "low", left: 2 });
  expect(toAvailability({ state: "AVAILABLE", left: 9 })).toEqual({ state: "low", left: 9 });
  expect(toAvailability({ state: "AVAILABLE", left: null })).toEqual({ state: "available" });
  expect(toAvailability({ state: "SOLD_OUT", since: "x" })).toEqual({ state: "soldOut", since: "x" });
  const m = buildFromWorkspace(ws);
  const n = applyAvailability(m, [{ menuItemId: "lamb", availability: { state: "SOLD_OUT", since: "t" } }]);
  expect(n.items.lamb.availability).toEqual({ state: "soldOut", since: "t" });
  expect(m.items.lamb.availability).toEqual({ state: "low", left: 2 });
  expect(applyAvailability(n, [{ menuItemId: "lamb", availability: { state: "SOLD_OUT", since: "t" } }])).toBe(n);
});

test("even shares in whole shillings, the first takes the remainder (Split-Even: 98,000 by 3)", () => {
  expect(evenShares(9_800_000, 3)).toEqual([3_266_800, 3_266_600, 3_266_600]);
  expect(evenShares(9_800_000, 2)).toEqual([4_900_000, 4_900_000]);
});
