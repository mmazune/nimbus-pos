import { expect, type Page } from "@playwright/test";

/**
 * Reach a table on T1's Floor the way a person does, then tap it.
 * Terminal: if the tile is not on screen, tap each area chip until it is.
 * Phone: "All tables", then step through the areas with ›.
 */
export async function tapTable(page: Page, tableId: string, how: "click" | "tap" = "click") {
  const tile = page.locator(`[data-floor-table-id="${tableId}"]`).first();
  await expect(page.locator("[data-floor-grid]").first()).toBeVisible();
  if (!(await tile.isVisible())) {
    const chips = page.getByRole("group", { name: "Areas" }).getByRole("button");
    if ((await chips.count()) > 0) {
      for (let i = 0; i < (await chips.count()); i += 1) {
        await chips.nth(i).click();
        if (await tile.isVisible()) break;
      }
    } else {
      const all = page.getByRole("tab", { name: /^All (tables|tabs)$/ });
      if (await all.count()) await all.first().click();
      for (let i = 0; i < 12 && !(await tile.isVisible()); i += 1) {
        const next = page.getByRole("button", { name: "Next area" });
        if (!(await next.count())) break;
        await next.click();
      }
    }
  }
  await tile.scrollIntoViewIfNeeded();
  if (how === "tap") await tile.locator("button").first().tap();
  else await tile.locator("button").first().click();
}
