/**
 * T3 phase 1 — unit tests for the order screen's data layer (no browser, no API).
 * Run: npx playwright test e2e/order/data.spec.ts --project=vp-1440x900
 */
import { expect, test } from "@playwright/test";

import { buildMenuWorkspace, initialsOf, searchMenu, type MenuItem } from "../../src/screens/order/data/menu";
import { formatMoney, groupShillings, shillingsToMinor, toApiAmount, toMinor } from "../../src/screens/order/data/money";
import { choicesText, itemCount, linesTotal, mapLine, sentRounds } from "../../src/screens/order/data/order";
import { filledAction, rightsFor } from "../../src/screens/order/data/rights";
import { draftLine } from "../../src/screens/order/data/useOrderSession";

test.describe("money is exact", () => {
  test("parses decimal strings by string", () => {
    expect(toMinor("28000.00")).toBe(2_800_000);
    expect(toMinor("28000")).toBe(2_800_000);
    expect(toMinor("0.10")).toBe(10);
    expect(toMinor("12.5")).toBe(1250);
    expect(toMinor(98000)).toBe(9_800_000);
    expect(toMinor("abc")).toBeNull();
    expect(toMinor(null)).toBeNull();
  });
  test("formats and converts back", () => {
    expect(formatMoney(9_800_000)).toBe("UGX 98,000");
    expect(groupShillings(2_800_050)).toBe("28,000.50");
    expect(groupShillings(0)).toBe("0");
    expect(toApiAmount(10_000_000)).toBe(100000);
    expect(toApiAmount(1250)).toBe(12.5);
    expect(shillingsToMinor("100000")).toBe(10_000_000);
    expect(shillingsToMinor("")).toBe(0);
  });
  test("0.1 + 0.2 never happens: totals are integer sums", () => {
    const lines = [mapLine({ id: "a", price: "0.10", subtotal: "0.10", quantity: 1, sentAt: "x" }), mapLine({ id: "b", price: "0.20", subtotal: "0.20", quantity: 1, sentAt: "x" })];
    expect(linesTotal(lines)).toBe(30);
  });
});

const nav = [
  {
    section: "DRINKS",
    groups: [
      { id: "g-beer", name: "Beer", sortOrder: 1, subgroups: [] },
      { id: "g-pop", name: "Popular", sortOrder: 9, subgroups: [] },
      { id: "g-wh", name: "Whisky", sortOrder: 2, subgroups: [{ id: "s-sm", name: "Single malt", sortOrder: 1 }] },
    ],
  },
  { section: "FOOD", groups: [{ id: "g-mains", name: "Mains", sortOrder: 1, subgroups: [] }] },
];
const catalog = {
  categories: [
    {
      items: [
        { id: "i1", name: "Blended Scotch", price: "8000.00", browseGroup: { id: "g-wh", section: "DRINKS" }, servings: [
          { id: "s1", label: "Tot", price: "8000.00", sortOrder: 1 }, { id: "s2", label: "Double", price: "15000.00", sortOrder: 2 },
        ] },
        { id: "i2", name: "Single malt 12", price: "16000.00", browseGroup: { id: "g-wh", section: "DRINKS" }, browseSubgroup: { id: "s-sm" } },
        { id: "i3", name: "Lager 500 ml", price: "6000.00", browseGroup: { id: "g-pop", section: "DRINKS" } },
        { id: "i4", name: "Chicken wings", price: "24000.00", browseGroup: { id: "g-mains", section: "FOOD" } },
        { id: "i5", name: "Hidden", price: "1.00", isActive: false, browseGroup: { id: "g-mains", section: "FOOD" } },
      ],
    },
  ],
};

test.describe("menu source", () => {
  test("Food first, Popular first, sub-groups kept, inactive items dropped", () => {
    const menu = buildMenuWorkspace(nav, catalog);
    expect(menu.sections.map((s) => s.label)).toEqual(["Food", "Drinks"]);
    expect(menu.sections[1].groups.map((g) => g.name)).toEqual(["Popular", "Whisky"]);
    expect(menu.sections[1].groups[1].subgroups.map((s) => s.name)).toEqual(["Single malt"]);
    expect(menu.items.i5).toBeUndefined();
    expect(menu.items.i1.servings.map((s) => [s.label, s.priceMinor])).toEqual([["Tot", 800_000], ["Double", 1_500_000]]);
    expect(menu.items.i1.initials).toBe("bs");
  });
  test("search finds from three letters and from initials", () => {
    const menu = buildMenuWorkspace(nav, catalog);
    const names = (q: string) => searchMenu(menu, q).map((i) => i.name);
    expect(names("chi")).toEqual(["Chicken wings"]);
    expect(names("bs")).toEqual(["Blended Scotch"]);
    expect(names("cw")).toEqual(["Chicken wings"]);
    expect(names("malt")).toEqual(["Single malt 12"]);
    expect(names("")).toEqual([]);
    expect(initialsOf("Fish and chips")).toBe("fac");
  });
  test("a group named \u201cPopular food\u201d counts as Popular and comes first", () => {
    const m = buildMenuWorkspace([{ section: "FOOD", groups: [{ id: "a", name: "Mains", sortOrder: 0 }, { id: "b", name: "Popular food", sortOrder: 5 }] }], { categories: [{ items: [
      { id: "x", name: "Stew", price: "1", browseGroup: { id: "a", section: "FOOD" } },
      { id: "y", name: "Burger", price: "1", browseGroup: { id: "b", section: "FOOD" } },
    ] }] });
    expect(m.sections[0].groups.map((g) => g.name)).toEqual(["Popular food", "Mains"]);
  });
});

test.describe("order lines", () => {
  test("rounds group by Send, newest first; voided lines leave the total", () => {
    const lines = [
      mapLine({ id: "1", price: "28000", subtotal: "28000", quantity: 1, sentAt: "2026-11-26T19:42:00Z", menuItem: { id: "m1", name: "Beef burger" } }),
      mapLine({ id: "2", price: "24000", subtotal: "24000", quantity: 1, sentAt: "2026-11-26T19:42:00Z", voidedAt: "2026-11-26T20:30:00Z", menuItem: { id: "m2", name: "Chicken wings" } }),
      mapLine({ id: "3", price: "6000", subtotal: "12000", quantity: 2, sentAt: "2026-11-26T20:15:00Z", menuItem: { id: "m3", name: "Lager" } }),
      mapLine({ id: "4", price: "3000", subtotal: "3000", quantity: 1, menuItem: { id: "m4", name: "Cola" } }),
    ];
    expect(lines.map((l) => l.state)).toEqual(["sent", "voided", "sent", "unsent"]);
    expect(sentRounds(lines).map((r) => r.lines.map((l) => l.name))).toEqual([["Lager"], ["Beef burger", "Chicken wings"]]);
    expect(linesTotal(lines)).toBe(4_300_000);
    expect(itemCount(lines)).toBe(4);
  });
  test("choices read as drawn", () => {
    expect(choicesText({ servingLabel: "Double", choices: [{ groupId: "g", groupName: "Mixer", optionId: "o", optionName: "Cola", priceDeltaMinor: 0 }], note: "" })).toBe("Double · Cola");
    expect(choicesText({ servingLabel: null, choices: [
      { groupId: "a", groupName: "How cooked", optionId: "m", optionName: "Medium", priceDeltaMinor: 0 },
      { groupId: "b", groupName: "Leave out", optionId: "o", optionName: "Onions", priceDeltaMinor: 0 },
    ], note: "" })).toBe("Medium · No onions");
  });
  test("a draft line prices its serving and choices", () => {
    const menu = buildMenuWorkspace(nav, catalog);
    const item: MenuItem = menu.items.i1;
    const line = draftLine({ item, serving: item.servings[1], choices: [{ groupId: "g", groupName: "Mixer", optionId: "c", optionName: "Cola", priceDeltaMinor: 0 }], note: "", quantity: 2 });
    expect(line.unitMinor).toBe(1_500_000);
    expect(line.lineMinor).toBe(3_000_000);
    expect(line.servingLabel).toBe("Double");
    expect(line.state).toBe("unsent");
  });
});

test.describe("rights and the one filled button (R5)", () => {
  const all = ["pos:orders:write", "pos:orders:close", "pos:order:item:void", "pos:discount:request", "pos:orders:void"];
  test("waiter: Send, then Print bill; never void or pay", () => {
    const r = rightsFor("waiter", ["pos:orders:write"]);
    expect(r.canVoidLine).toBe(false);
    expect(r.canPay).toBe(false);
    expect(filledAction(r, 3, true, false)).toBe("send");
    expect(filledAction(r, 0, true, false)).toBe("printBill");
    expect(filledAction(r, 0, false, false)).toBe("send");
    expect(filledAction(r, 0, true, true)).toBe("printBill");
    expect(filledAction(r, 0, false, true)).toBe("none");
  });
  test("cashier and manager take payment; supervisor prints the bill", () => {
    expect(filledAction(rightsFor("cashier", ["pos:orders:write", "pos:orders:close"]), 0, true, false)).toBe("takePayment");
    expect(filledAction(rightsFor("manager", all), 0, true, false)).toBe("takePayment");
    const sup = rightsFor("supervisor", all);
    expect(sup.canPay).toBe(false);
    expect(sup.canVoidLine).toBe(true);
    expect(filledAction(sup, 0, true, false)).toBe("printBill");
  });
});
