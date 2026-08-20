import { expect, test } from "@playwright/test";

import {
  FORBIDDEN_DOM_KEYS,
  MANAGER_STAFF_ROUTES,
  captureApiRequests,
  captureApiResponses,
  captureConsoleErrors,
  listRows,
  managerLogin,
  waitForListSettled,
} from "./fixtures";

/**
 * Track B3 — leave review and shift-swap review.
 *
 * ⚠️ The decision specs MUTATE REAL RECORDS. They run only against the isolated
 * disposable stack described in `docs/TESTING_AND_QA.md` — never shared Neon.
 */
test.describe("Manager Staff — leave review", () => {
  test("renders the queue, and the nested employee PII never lands", async ({ page }) => {
    const errors = captureConsoleErrors(page);
    const responses = captureApiResponses(page);
    await managerLogin(page);
    await page.goto(MANAGER_STAFF_ROUTES.leave);
    await waitForListSettled(page);

    await expect(page.getByRole("heading", { name: "Leave requests" })).toBeVisible();

    // The endpoint DOES embed a full employee object. The proof is that the
    // projection dropped it before it could be rendered.
    const leaveBodies = responses.filter((entry) => /\/api\/hr\/leave/.test(entry.url));
    const wireHadPii = leaveBodies.some((entry) =>
      FORBIDDEN_DOM_KEYS.some((key) => entry.body.includes(`"${key}"`)),
    );

    const domHtml = await page.content();
    for (const key of FORBIDDEN_DOM_KEYS) {
      expect(domHtml, `${key} must not reach the DOM (wire carried PII: ${wireHadPii})`).not.toContain(
        `"${key}"`,
      );
    }

    expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
  });

  test("every leave read is bounded and branch-scoped", async ({ page }) => {
    const requests = captureApiRequests(page);
    await managerLogin(page);
    await page.goto(MANAGER_STAFF_ROUTES.leave);
    await waitForListSettled(page);

    const reads = requests.filter((request) => /\/api\/hr\/leave\?/.test(request.url));
    expect(reads.length).toBeGreaterThan(0);
    for (const request of reads) {
      expect(request.url).toMatch(/take=\d+/);
      expect(Number(new URL(request.url).searchParams.get("take"))).toBeLessThanOrEqual(100);
      expect(request.branchId).toBeTruthy();
      expect(request.method).toBe("GET");
    }
  });

  test("a decided request is read-only", async ({ page }) => {
    await managerLogin(page);
    await page.goto(`${MANAGER_STAFF_ROUTES.leave}?status=APPROVED`);
    await waitForListSettled(page);

    const rowCount = await listRows(page).count();
    test.skip(rowCount === 0, "needs at least one decided leave request");

    await listRows(page).first().click();
    const detail = page.locator("[data-manager-leave-detail]");
    await expect(detail).toBeVisible();
    await expect(detail.getByText(/cannot be reviewed again/i)).toBeVisible();
    await expect(detail.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await expect(detail.getByRole("button", { name: "Reject" })).toHaveCount(0);
  });

  test("cancelling a decision changes nothing", async ({ page }) => {
    const requests = captureApiRequests(page);
    await managerLogin(page);
    await page.goto(`${MANAGER_STAFF_ROUTES.leave}?status=PENDING`);
    await waitForListSettled(page);

    const rowCount = await listRows(page).count();
    test.skip(rowCount === 0, "needs at least one pending leave request");

    await listRows(page).first().click();
    await page.locator("[data-manager-leave-detail]").getByRole("button", { name: "Approve" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // The confirmation makes NO payroll or roster claim — it says the opposite.
    await expect(dialog.getByText(/does NOT create a payroll entry/i)).toBeVisible();
    await expect(dialog.getByText(/does NOT reassign their shifts/i)).toBeVisible();

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    expect(requests.filter((request) => /\/review$/.test(request.url))).toHaveLength(0);
  });

  test("approving a pending request records the decision", async ({ page }) => {
    const requests = captureApiRequests(page);
    await managerLogin(page);
    await page.goto(`${MANAGER_STAFF_ROUTES.leave}?status=PENDING`);
    await waitForListSettled(page);

    const rowCount = await listRows(page).count();
    test.skip(rowCount === 0, "needs at least one pending leave request");

    await listRows(page).first().click();
    await page.locator("[data-manager-leave-detail]").getByRole("button", { name: "Approve" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.locator("textarea").fill("ZZQA approved by the B3 e2e suite.");
    await dialog.getByRole("button", { name: "Approve leave" }).click();

    await expect(dialog).toHaveCount(0, { timeout: 45_000 });

    const decision = requests.find((request) => /\/api\/hr\/leave\/[^/]+\/review$/.test(request.url));
    expect(decision?.method).toBe("PATCH");
    expect(decision?.branchId).toBeTruthy();

    // The list re-read from the server rather than mutating in place.
    await expect
      .poll(() => requests.filter((request) => /\/api\/hr\/leave\?/.test(request.url)).length, {
        timeout: 30_000,
      })
      .toBeGreaterThan(1);
  });

  test("rejecting a pending request records the decision", async ({ page }) => {
    const requests = captureApiRequests(page);
    await managerLogin(page);
    await page.goto(`${MANAGER_STAFF_ROUTES.leave}?status=PENDING`);
    await waitForListSettled(page);

    const rowCount = await listRows(page).count();
    test.skip(rowCount === 0, "needs at least one pending leave request");

    await listRows(page).first().click();
    await page.locator("[data-manager-leave-detail]").getByRole("button", { name: "Reject" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.locator("textarea").fill("ZZQA rejected by the B3 e2e suite.");
    await dialog.getByRole("button", { name: "Reject leave" }).click();
    await expect(dialog).toHaveCount(0, { timeout: 45_000 });

    const decision = requests.find((request) => /\/api\/hr\/leave\/[^/]+\/review$/.test(request.url));
    expect(decision?.method).toBe("PATCH");
  });
});

test.describe("Manager Staff — shift swaps (Outcome C: reject only)", () => {
  test("renders the honest no-roster-change notice and NO approve control", async ({ page }) => {
    const errors = captureConsoleErrors(page);
    await managerLogin(page);
    await page.goto(MANAGER_STAFF_ROUTES.shiftSwaps);
    await waitForListSettled(page);

    await expect(page.getByRole("heading", { name: "Shift swaps" })).toBeVisible();
    await expect(page.locator("[data-manager-shift-swap-notice]")).toBeVisible();
    await expect(page.getByText(/Published rosters are read-only across the whole API/i)).toBeVisible();
    await expect(page.getByText("Reject only")).toBeVisible();

    // No approve control anywhere on the surface, in any state.
    await expect(page.getByRole("button", { name: /^approve/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^accept/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /grant/i })).toHaveCount(0);

    expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
  });

  test("a pending swap offers Decline only", async ({ page }) => {
    await managerLogin(page);
    await page.goto(`${MANAGER_STAFF_ROUTES.shiftSwaps}?status=PENDING`);
    await waitForListSettled(page);

    const rowCount = await listRows(page).count();
    test.skip(rowCount === 0, "needs at least one pending shift swap");

    await listRows(page).first().click();
    const detail = page.locator("[data-manager-shift-swap-detail]");
    await expect(detail).toBeVisible();
    await expect(detail.getByRole("button", { name: "Decline swap" })).toBeVisible();
    await expect(detail.getByRole("button", { name: /approve/i })).toHaveCount(0);
    await expect(detail.getByText(/There is no Approve action/i)).toBeVisible();
  });

  test("cancelling a decline changes nothing", async ({ page }) => {
    const requests = captureApiRequests(page);
    await managerLogin(page);
    await page.goto(`${MANAGER_STAFF_ROUTES.shiftSwaps}?status=PENDING`);
    await waitForListSettled(page);

    const rowCount = await listRows(page).count();
    test.skip(rowCount === 0, "needs at least one pending shift swap");

    await listRows(page).first().click();
    await page.getByRole("button", { name: "Decline swap" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/No roster row changes/i)).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();

    expect(requests.filter((request) => /shift-swaps\/[^/]+\/approve$/.test(request.url))).toHaveLength(0);
  });

  test("declining sends REJECTED and never APPROVED", async ({ page }) => {
    const bodies: Array<{ url: string; body: string | null }> = [];
    page.on("request", (request) => {
      if (!/shift-swaps\/[^/]+\/approve$/.test(request.url())) return;
      bodies.push({ url: request.url(), body: request.postData() });
    });

    await managerLogin(page);
    await page.goto(`${MANAGER_STAFF_ROUTES.shiftSwaps}?status=PENDING`);
    await waitForListSettled(page);

    const rowCount = await listRows(page).count();
    test.skip(rowCount === 0, "needs at least one pending shift swap");

    await listRows(page).first().click();
    await page.getByRole("button", { name: "Decline swap" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.locator("textarea").fill("ZZQA declined by the B3 e2e suite.");
    await dialog.getByRole("button", { name: "Decline swap" }).click();
    await expect(dialog).toHaveCount(0, { timeout: 45_000 });

    expect(bodies.length, "the decision reached the API").toBe(1);
    expect(bodies[0].body, "the payload rejects").toContain("REJECTED");
    expect(bodies[0].body, "the payload can never approve").not.toContain("APPROVED");
  });
});
