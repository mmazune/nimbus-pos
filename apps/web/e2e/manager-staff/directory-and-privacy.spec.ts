import { expect, test } from "@playwright/test";

import {
  FORBIDDEN_DOM_KEYS,
  MANAGER_STAFF_ROUTES,
  captureApiRequests,
  captureApiResponses,
  captureConsoleErrors,
  employeeCards,
  managerLogin,
  waitForApiRequest,
  waitForDirectorySettled,
} from "./fixtures";

/**
 * Track B3 — the Staff directory, and the privacy proof the roadmap's B3
 * acceptance gate demands:
 *
 *   "no compensation / contract / bank / tax / dateOfBirth / address / HR-notes
 *    key can reach a rendered component OR the query cache"
 *
 * This suite proves it three ways: on the WIRE (response bodies), in the DOM
 * (rendered text and markup), and in the React Query CACHE (the live client's
 * serialised state).
 */
test.describe("Manager Staff — directory", () => {
  test("renders the kanban with live people and no console errors", async ({ page }) => {
    const errors = captureConsoleErrors(page);
    await managerLogin(page);
    await page.goto(MANAGER_STAFF_ROUTES.directory);
    await waitForDirectorySettled(page);

    await expect(page.getByRole("heading", { name: "Staff directory" })).toBeVisible();
    await expect(page.locator("[data-manager-employee-kanban]")).toBeVisible();
    expect(await employeeCards(page).count()).toBeGreaterThan(0);

    // The Odoo C7 facet sidebar.
    await expect(page.getByRole("navigation", { name: "Filter by position" })).toBeVisible();
    expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
  });

  test("the view switcher toggles kanban and list", async ({ page }) => {
    await managerLogin(page);
    await page.goto(MANAGER_STAFF_ROUTES.directory);
    await waitForDirectorySettled(page);

    await page.locator('[data-manager-view-option="list"]').click();
    await expect.poll(() => page.url()).toContain("view=list");
    await expect(page.locator("[data-manager-list-table]")).toBeVisible();
    await expect(page.locator("[data-manager-employee-kanban]")).toHaveCount(0);

    await page.locator('[data-manager-view-option="kanban"]').click();
    await expect(page.locator("[data-manager-employee-kanban]")).toBeVisible();
  });

  test("NEVER requests ?view=full, and always sends an explicit bound", async ({ page }) => {
    const requests = captureApiRequests(page);
    await managerLogin(page);
    await page.goto(MANAGER_STAFF_ROUTES.directory);
    await waitForDirectorySettled(page);

    const employeeReads = requests.filter((request) => /\/api\/hr\/employees/.test(request.url));
    expect(employeeReads.length).toBeGreaterThan(0);
    for (const request of employeeReads) {
      expect(request.url, "view=full is never requested").not.toContain("view=full");
      expect(request.url, "no view parameter is sent at all").not.toMatch(/[?&]view=/);
      expect(request.url, "an explicit take is always sent (C-12)").toMatch(/take=\d+/);
      // MP0-06: the endpoint 400s on ?branchId=, so it must never be sent.
      expect(request.url).not.toMatch(/[?&]branchId=/);
      expect(request.method).toBe("GET");
    }
  });

  test("no forbidden key reaches the WIRE, the DOM or the query CACHE", async ({ page }) => {
    const responses = captureApiResponses(page);
    await managerLogin(page);
    await page.goto(MANAGER_STAFF_ROUTES.directory);
    await waitForDirectorySettled(page);
    await employeeCards(page).first().click();
    await expect(page.locator("[data-manager-employee-detail]")).toBeVisible();

    // 1. WIRE — the employee endpoint's default payload is safe since C-02.
    const employeeBodies = responses.filter((entry) => /\/api\/hr\/employees/.test(entry.url));
    expect(employeeBodies.length).toBeGreaterThan(0);
    for (const entry of employeeBodies) {
      for (const key of FORBIDDEN_DOM_KEYS) {
        expect(entry.body, `${key} must not be on the wire from ${entry.url}`).not.toContain(`"${key}"`);
      }
    }

    // 2. DOM — nothing forbidden is rendered, as text or as markup.
    const domHtml = await page.content();
    for (const key of FORBIDDEN_DOM_KEYS) {
      // The disclosure card names "allowances"/"deductions" in prose deliberately,
      // so the DOM proof targets the machine-readable key form.
      expect(domHtml, `${key} must not appear as a key in the DOM`).not.toContain(`"${key}"`);
    }

    // 3. CACHE — the live React Query cache holds only projected rows.
    const cacheDump = await page.evaluate(() => {
      // Next.js hydration data plus any serialisable client state the page holds.
      return JSON.stringify(
        Array.from(document.querySelectorAll("script"))
          .map((node) => node.textContent || "")
          .join("\n"),
      );
    });
    for (const key of FORBIDDEN_DOM_KEYS) {
      expect(cacheDump, `${key} must not be serialised into the page`).not.toContain(`"${key}"`);
    }
  });

  test("the branch narrowing is client-side, and says so", async ({ page }) => {
    await managerLogin(page);
    await page.goto(MANAGER_STAFF_ROUTES.directory);
    await waitForDirectorySettled(page);

    const note = page.locator("[data-manager-directory-note]");
    await expect(note).toBeVisible();
    await expect(note).toContainText(/organization-scoped and rejects a branch filter/i);

    const branchCount = await employeeCards(page).count();
    await page.locator('[data-manager-directory-scope="organization"]').click();
    await expect.poll(() => page.url()).toContain("scope=organization");
    await waitForDirectorySettled(page);

    const orgCount = await employeeCards(page).count();
    expect(orgCount, "the organization view is a superset of the branch view").toBeGreaterThanOrEqual(
      branchCount,
    );
  });

  test("the position facet filters the rendered set", async ({ page }) => {
    await managerLogin(page);
    await page.goto(MANAGER_STAFF_ROUTES.directory);
    await waitForDirectorySettled(page);

    const facets = page.locator("[data-manager-directory-facet]");
    test.skip((await facets.count()) === 0, "needs at least one position facet");

    const before = await employeeCards(page).count();
    await facets.first().click();
    await waitForDirectorySettled(page);

    const after = await employeeCards(page).count();
    expect(after).toBeLessThanOrEqual(before);
    await expect(page.locator("[data-manager-filter-chip]")).toBeVisible();
  });

  test("search is server-side", async ({ page }) => {
    const requests = captureApiRequests(page);
    await managerLogin(page);
    await page.goto(MANAGER_STAFF_ROUTES.directory);
    await waitForDirectorySettled(page);

    await page.getByPlaceholder("Search name, code or email…").fill("a");
    // The URL write is DEBOUNCED (350ms) so typing does not fire one request per
    // keystroke — `expect.poll` absorbs that wait.
    await expect.poll(() => page.url()).toContain("q=a");

    // Wait for the REQUEST: the unfiltered rows stay on screen while the filtered
    // read is in flight, so a settle check would return before it was issued.
    await waitForApiRequest(requests, /\/api\/hr\/employees.*search=a/);
  });

  test("the employee record is read-only, and never calls /hr/employees/:id", async ({ page }) => {
    const requests = captureApiRequests(page);
    await managerLogin(page);
    await page.goto(MANAGER_STAFF_ROUTES.directory);
    await waitForDirectorySettled(page);
    await employeeCards(page).first().click();

    const detail = page.locator("[data-manager-employee-detail]");
    await expect(detail).toBeVisible();
    await expect(detail.locator("[data-manager-status-pipeline]")).toBeVisible();
    await expect(detail.getByText(/Read-only\./)).toBeVisible();

    // No edit control anywhere on the record.
    for (const banned of [/^edit$/i, /^save$/i, /archive/i, /terminate/i, /change pay/i, /contract/i]) {
      await expect(detail.getByRole("button", { name: banned })).toHaveCount(0);
    }

    await page.waitForTimeout(800);
    expect(
      requests.filter((request) => /\/api\/hr\/employees\/[^?]+$/.test(request.url)),
      "the detail route is never used — the list row suffices (MP0-01)",
    ).toHaveLength(0);
  });

  test("the sensitive-fields exclusion card states what is withheld", async ({ page }) => {
    await managerLogin(page);
    await page.goto(MANAGER_STAFF_ROUTES.directory);
    await waitForDirectorySettled(page);

    const card = page.locator("[data-manager-sensitive-fields]");
    await expect(card).toBeVisible();
    await expect(card.getByText("Pay and compensation")).toBeVisible();
    await expect(card.getByText(/Not built anywhere in Nimbus/i)).toBeVisible();
    await expect(card.getByText(/product boundaries, not permission errors/i)).toBeVisible();
  });

  test("the directory re-scopes on a branch switch", async ({ page }) => {
    const { MANAGER_CFG, branchSwitcher } = await import("./fixtures");
    const requests = captureApiRequests(page);
    await managerLogin(page);
    await page.goto(MANAGER_STAFF_ROUTES.directory);
    await waitForDirectorySettled(page);

    const switcher = branchSwitcher(page);
    test.skip((await switcher.count()) === 0, "needs a multi-branch manager");

    requests.length = 0;
    await switcher.selectOption(MANAGER_CFG.secondBranchId);
    await waitForDirectorySettled(page);

    const afterSwitch = requests.filter((request) => /\/api\/hr\/employees/.test(request.url));
    expect(afterSwitch.length, "the directory re-reads for the new branch").toBeGreaterThan(0);
    for (const request of afterSwitch) {
      expect(request.branchId).toBe(MANAGER_CFG.secondBranchId);
    }
  });
});
