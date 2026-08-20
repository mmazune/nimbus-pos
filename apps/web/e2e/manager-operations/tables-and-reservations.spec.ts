import { expect, test } from "@playwright/test";

import {
  MANAGER_OPERATIONS_ROUTES,
  captureApiRequests,
  captureConsoleErrors,
  listRows,
  listTable,
  managerLogin,
  sharedFloorHeading,
  waitForApiRequest,
  waitForListSettled,
} from "./fixtures";

test.describe("Manager Operations — tables (shared floor, read-only)", () => {
  test("renders the SHARED operational floor, unforked", async ({ page }) => {
    const errors = captureConsoleErrors(page);
    await managerLogin(page);
    await page.goto(MANAGER_OPERATIONS_ROUTES.tables);

    // The shared floor's OWN data attributes — `data-operational-floor-toolbar`
    // and `data-operational-table-id` come from `components/floor/*` and exist
    // nowhere else. If Manager had forked the floor, these would be absent, so
    // this is a much stronger unforked-proof than matching on copy.
    await expect(sharedFloorHeading(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("[data-operational-floor-toolbar]")).toBeVisible();
    await expect(page.getByRole("grid").or(page.getByLabel("Operational tables"))).toBeVisible();
    expect(await page.locator("[data-operational-table-id]").count()).toBeGreaterThan(0);
    // `.first()`: the shared toolbar badge AND the Manager summary line both say
    // "N tables", which is a strict-mode ambiguity, not a duplicate control.
    await expect(page.getByText(/\d+\s*tables/).first()).toBeVisible();
    // The shared status filters (their accessible name is "All 22" — label + count).
    await expect(page.getByRole("button", { name: /^All\b/ })).toBeVisible();

    expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
  });

  test("selecting a table opens a read-only panel with no table mutation", async ({ page }) => {
    await managerLogin(page);
    await page.goto(MANAGER_OPERATIONS_ROUTES.tables);
    await expect(sharedFloorHeading(page)).toBeVisible({ timeout: 30_000 });

    const cards = page.locator("[data-operational-table-id]");
    const first = cards.first();
    await first.waitFor({ state: "visible", timeout: 30_000 });
    await first.click();

    await expect(page.locator("[data-manager-table-panel]")).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => page.url()).toContain("tableId=");

    for (const banned of [
      /mark available/i,
      /mark occupied/i,
      /seat guest/i,
      /assign server/i,
      /take payment/i,
      /close order/i,
      /new order/i,
    ]) {
      await expect(page.getByRole("button", { name: banned })).toHaveCount(0);
    }
    await expect(page.getByText(/Read-only\./)).toBeVisible();
  });

  test("discloses that there is no branch-wide tills or shifts list", async ({ page }) => {
    await managerLogin(page);
    await page.goto(MANAGER_OPERATIONS_ROUTES.tables);
    await expect(page.getByText(/no branch-wide tills or shifts/i)).toBeVisible({ timeout: 30_000 });
  });

  test("the floor snapshot is exactly three bounded, branch-scoped reads", async ({ page }) => {
    const requests = captureApiRequests(page);
    await managerLogin(page);
    await page.goto(MANAGER_OPERATIONS_ROUTES.tables);
    await expect(sharedFloorHeading(page)).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1_500);

    const floorReads = requests.filter((request) =>
      /\/api\/(tables|pos\/orders|reservations)/.test(request.url),
    );
    expect(floorReads.length, `floor reads: ${floorReads.map((r) => r.url).join(" | ")}`).toBe(3);
    for (const request of floorReads) {
      expect(request.method).toBe("GET");
      expect(request.branchId).toBeTruthy();
    }
    // Neither till nor shift route is ever called — they do not exist (MP0-02).
    expect(requests.filter((request) => /\/api\/(tills|shifts)/.test(request.url))).toHaveLength(0);
  });
});

test.describe("Manager Operations — reservations (read-only)", () => {
  test("renders the active scope with no lifecycle action", async ({ page }) => {
    const errors = captureConsoleErrors(page);
    await managerLogin(page);
    await page.goto(MANAGER_OPERATIONS_ROUTES.reservations);
    await waitForListSettled(page);

    await expect(page.getByRole("heading", { name: "Reservations" })).toBeVisible();
    await expect(page.locator('[data-manager-reservation-scope="active"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    for (const banned of [/^new$/i, /confirm/i, /seat/i, /cancel/i, /no.show/i, /assign table/i]) {
      await expect(page.getByRole("button", { name: banned })).toHaveCount(0);
    }
    expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
  });

  test("switching to history is a real server read", async ({ page }) => {
    const requests = captureApiRequests(page);
    await managerLogin(page);
    await page.goto(MANAGER_OPERATIONS_ROUTES.reservations);
    await waitForListSettled(page);

    await page.locator('[data-manager-reservation-scope="history"]').click();
    await expect.poll(() => page.url()).toContain("scope=history");

    // Wait for the REQUEST: the active-scope rows stay on screen while history
    // loads, so a settle check would return before anything was asked for.
    await waitForApiRequest(requests, /\/api\/reservations\?.*scope=history/);
  });

  test("guest contact details never reach the page", async ({ page }) => {
    const responses: string[] = [];
    page.on("response", async (response) => {
      if (!/\/api\/reservations/.test(response.url())) return;
      try {
        responses.push(await response.text());
      } catch {
        // ignore unreadable responses
      }
    });

    await managerLogin(page);
    await page.goto(MANAGER_OPERATIONS_ROUTES.reservations);
    await waitForListSettled(page);

    const rowCount = await listRows(page).count();
    test.skip(rowCount === 0, "needs at least one reservation");

    // The endpoint may send contact details; the point is that the RENDERED page
    // never shows them, because the projection drops them at the API boundary.
    const guestPhones = responses
      .flatMap((body) => Array.from(body.matchAll(/"guestPhone":"([^"]+)"/g)))
      .map((match) => match[1])
      .filter(Boolean);

    if (guestPhones.length) {
      const domText = await page.locator("body").innerText();
      for (const phone of guestPhones.slice(0, 5)) {
        expect(domText, `guest phone ${phone} must not be rendered`).not.toContain(phone);
      }
    }

    await expect(listTable(page)).toBeVisible();
  });

  test("every reservation read is bounded and branch-scoped", async ({ page }) => {
    const requests = captureApiRequests(page);
    await managerLogin(page);
    await page.goto(MANAGER_OPERATIONS_ROUTES.reservations);
    await waitForListSettled(page);

    const reads = requests.filter((request) => /\/api\/reservations\?/.test(request.url));
    expect(reads.length).toBeGreaterThan(0);
    for (const request of reads) {
      expect(request.url).toMatch(/pageSize=\d+/);
      expect(Number(new URL(request.url).searchParams.get("pageSize"))).toBeLessThanOrEqual(100);
      expect(request.branchId).toBeTruthy();
      expect(request.method).toBe("GET");
    }
  });
});
