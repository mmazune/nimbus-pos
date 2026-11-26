import { expect, test, type Page } from "@playwright/test";

import { onVenue } from "../t5/venue";
import { ensureFloorFixture } from "./floor-fixture";
import { chrome, expectRules, makePins, pageRules, pinSignIn, saveJson, shot } from "./support";

/**
 * T1 phase 1 (U1 parts b–d): the Floor on four screen sizes, signed in by PIN.
 * Needs the drawn floor (floor-fixture.ts) on a SEPARATE throwaway database:
 *   T1_FLOOR_FIXTURE=1 PW_BASE_URL=… PW_API_URL=… T1_PASSWORD=… \
 *     npx playwright test e2e/t1/floor.spec.ts --project=vp-1440x900
 * The viewport is set per test, so one project is enough.
 */
test.skip(process.env.T1_FLOOR_FIXTURE !== "1", "needs the 70-table fixture database (T1_FLOOR_FIXTURE=1)");
test.describe.configure({ mode: "serial" });

const measured: Record<string, unknown> = {};

test.beforeAll(async () => {
  measured.fixture = await ensureFloorFixture();
  await makePins();
});

test.afterAll(() => saveJson("floor-measured.json", measured));

async function floorFacts(page: Page) {
  return page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>("[data-floor-grid]");
    const space = document.querySelector<HTMLElement>("[data-floor-space]");
    const tiles = Array.from(document.querySelectorAll<HTMLElement>("[data-floor-tile] button"));
    const first = tiles[0]?.getBoundingClientRect();
    const second = tiles[1]?.getBoundingClientRect();
    const bar = Array.from(document.querySelectorAll<HTMLElement>("[data-touch-bar] nav")).find((n) => n.getBoundingClientRect().height > 0);
    const barTop = bar?.getBoundingClientRect().top ?? window.innerHeight;
    const visible = tiles.filter((t) => {
      const r = t.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= barTop;
    }).length;
    return {
      layout: document.querySelector("[data-floor-layout]")?.getAttribute("data-floor-layout"),
      fits: document.querySelector("[data-floor-layout]")?.getAttribute("data-floor-fits"),
      columns: Number(grid?.getAttribute("data-floor-columns")),
      tiles: tiles.length,
      visibleWithoutScrolling: visible,
      tile: first ? { w: Math.round(first.width), h: Math.round(first.height) } : null,
      gap: first && second ? Math.round(second.left - first.right) : null,
      spaceScrolls: space ? space.scrollHeight > space.clientHeight + 1 : false,
      states: Array.from(new Set(Array.from(document.querySelectorAll("[data-floor-tile]")).map((e) => e.getAttribute("data-floor-tile")))).sort(),
      others: tiles.filter((t) => t.querySelector(".font-kit-regular") && t.textContent?.includes(".")).length,
    };
  });
}

async function openMainHall(page: Page, who: "waiter" | "cashier" | "supervisor") {
  await pinSignIn(page, who);
  await page.goto(`/${who}/floor`);
  await expect(page.locator("[data-floor-grid]")).toBeVisible();
  if (who === "waiter") await page.getByRole("tab", { name: /^All (tables|tabs)$/ }).click();
  await page.getByRole("button", { name: /^Main hall/ }).click();
  await expect(page.locator("[data-floor-tile]")).toHaveCount(32);
}

test("waiter, 1280 × 800: Main hall is 8 × 4 roomy tiles with no scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openMainHall(page, "waiter");
  const f = await floorFacts(page);
  const c = await chrome(page);
  const r = await pageRules(page);
  measured.waiter1280 = { ...f, chrome: c, rules: r };
  expect(c.header).toBe(64);
  expect(c.bar).toBe(76);
  expect(c.sections).toEqual(["floor", "reservations", "ready", "me"]);
  expect(f.layout).toBe("roomy");
  expect(f.columns).toBe(8);
  expect(f.tile?.h).toBe(108);
  expect(f.tile?.w).toBeGreaterThanOrEqual(136);
  expect(f.gap).toBe(12);
  expect(f.spaceScrolls).toBe(false);
  expect(f.visibleWithoutScrolling).toBe(32);
  if (onVenue()) {
    // The demo venue's service has tickets at the pass and in the kitchen: Ready and Late come from the server (T5).
    expect(f.states).toEqual(expect.arrayContaining(["cleaning", "free", "reserved"]));
    expect(f.states.some((st) => ["open", "notSent", "ready", "late"].includes(st ?? ""))).toBe(true);
    for (const st of f.states) expect(["cleaning", "free", "notSent", "open", "reserved", "ready", "late"]).toContain(st);
  } else {
    expect(f.states).toEqual(["cleaning", "free", "notSent", "open", "reserved"]);
  }
  expectRules(r);
  await shot(page, "Main-1280x800-waiter.png");
});

test("waiter, 1024 × 768: the same area is compact, 7 across, with no scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await openMainHall(page, "waiter");
  const f = await floorFacts(page);
  const c = await chrome(page);
  const r = await pageRules(page);
  measured.waiter1024 = { ...f, chrome: c, rules: r };
  expect(c.header).toBe(64);
  expect(c.bar).toBe(76);
  expect(f.layout).toBe("compact");
  expect(f.columns).toBe(7);
  expect(f.tile?.h).toBe(84);
  expect(f.tile?.w).toBeGreaterThanOrEqual(124);
  expect(f.gap).toBe(10);
  expect(f.spaceScrolls).toBe(false);
  expect(f.visibleWithoutScrolling).toBe(32);
  expectRules(r);
  await shot(page, "Floor-1024x768-waiter.png");
});

test("supervisor, 1920 × 1080: All areas is 12 across", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await pinSignIn(page, "supervisor");
  await page.goto("/supervisor/floor");
  await expect(page.locator("[data-floor-grid]")).toBeVisible();
  await expect(page.getByRole("button", { name: /^All areas/ })).toHaveAttribute("aria-pressed", "true");
  const f = await floorFacts(page);
  const c = await chrome(page);
  const r = await pageRules(page);
  measured.supervisor1920 = { ...f, chrome: c, rules: r };
  expect(c.header).toBe(64);
  expect(c.bar).toBe(76);
  expect(c.sections).toEqual(["floor", "reservations", "approvals", "me"]);
  expect(f.columns).toBe(12);
  expect(f.tiles).toBeGreaterThanOrEqual(70);
  expectRules(r);
  await shot(page, "Floor-1920x1080-supervisor.png");
});

test("waiter, 390 × 844: the phone floor, tab bar 84, three across, Tab 3 fits", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await pinSignIn(page, "waiter");
  await page.goto("/waiter/floor");
  await expect(page.locator("[data-floor-grid]").first()).toBeVisible();
  const c = await chrome(page);
  expect(c.bar).toBe(84);
  expect(c.sections).toEqual(["floor", "reservations", "ready", "me"]);
  const yours = await page.evaluate(() => document.querySelector("[data-floor-grid]")?.getAttribute("data-floor-columns"));
  expect(yours).toBe("3");
  const r1 = await pageRules(page);
  expectRules(r1);
  await shot(page, "Floor-Phone-390x844-waiter.png");
  // the Tabs area, three across: "Tab 3" shows "Tab" small above a large 3
  await page.getByRole("tab", { name: /^All (tables|tabs)$/ }).click();
  for (let i = 0; i < 6; i += 1) {
    if ((await page.getByRole("button", { name: /^Tabs/ }).count()) > 0) break;
    await page.getByRole("button", { name: "Next area" }).click();
  }
  await expect(page.getByRole("button", { name: /^Tabs/ })).toBeVisible();
  const tab3 = page.getByRole("button", { name: /^Tab 3,/ });
  await expect(tab3).toBeVisible();
  const r2 = await pageRules(page);
  measured.phone = { chrome: c, rules: [r1, r2] };
  expectRules(r2);
  await shot(page, "Floor-Phone-390x844-tabs.png");
});

test("tapping a table opens what it opened before, for each role", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const who of ["waiter", "cashier", "supervisor"] as const) {
    await openMainHall(page, who);
    const state = who === "waiter" ? "free" : "open";
    // An occupied table: "open", or on the demo venue the server's Ready, Late or Not sent (T5).
    const tile = (state === "open"
      ? page.locator('[data-floor-tile="open"], [data-floor-tile="ready"], [data-floor-tile="late"], [data-floor-tile="notSent"]')
      : page.locator(`[data-floor-tile="${state}"]`)).first();
    const tableId = await tile.getAttribute("data-floor-table-id");
    await tile.locator("button").click();
    await expect(page.locator("[data-order-screen]")).toBeVisible();
    await shot(page, `tap-${who}-1280x800.png`);
    if (who === "waiter") {
      // a free table tapped and backed out of saves nothing (R2): it is still free
      await page.goBack();
      await expect(page.locator("[data-order-screen]")).toHaveCount(0);
      await page.reload();
      await page.getByRole("tab", { name: /^All (tables|tabs)$/ }).click();
      await page.getByRole("button", { name: /^Main hall/ }).click();
      await expect(page.locator(`[data-floor-table-id="${tableId}"]`)).toHaveAttribute("data-floor-tile", "free");
    }
  }
});

test("cashier and supervisor Floor at 1280 × 800 and 390 × 844, and the search sheet open", async ({ page }) => {
  for (const who of ["cashier", "supervisor"] as const) {
    for (const [w, h] of [[1280, 800], [390, 844]] as const) {
      await page.setViewportSize({ width: w, height: h });
      await pinSignIn(page, who);
      await page.goto(`/${who}/floor`);
      await expect(page.locator("[data-floor-grid]").first()).toBeVisible();
      const r = await pageRules(page);
      measured[`${who}-${w}`] = { chrome: await chrome(page), rules: r };
      expectRules(r);
      await shot(page, `Floor-${who}-${w}x${h}.png`);
    }
  }
  // the search sheet, as a waiter would use it
  for (const [w, h] of [[1280, 800], [390, 844]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await pinSignIn(page, "waiter");
    await page.goto("/waiter/floor");
    await page.getByRole("button", { name: /find a table/i }).first().click();
    const sheet = page.getByRole("dialog", { name: "Find a table" });
    await sheet.getByLabel(/table number/i).fill("12");
    // the drawn floor calls it "Table 12"; the demo venue's Main hall number 12 is "M12"
    const twelve = sheet.getByRole("button", { name: onVenue() ? /^M12,/ : /^Table 12,/ });
    await expect(twelve).toBeVisible();
    const r = await pageRules(page);
    measured[`search-${w}`] = r;
    expectRules(r);
    await shot(page, `Floor-search-${w}x${h}.png`);
    await twelve.click();
    await expect(page.locator("[data-order-screen]")).toBeVisible();
  }
});
