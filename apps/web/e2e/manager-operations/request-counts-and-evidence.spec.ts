import { expect, test } from "@playwright/test";

import {
  MANAGER_OPERATIONS_ROUTES,
  MANAGER_STAFF_ROUTES,
  captureApiRequests,
  captureConsoleErrors,
  managerLogin,
  waitForListSettled,
} from "./fixtures";

/**
 * Track B3 — per-surface request-count discipline (CLAUDE.md §15) and the
 * screenshot evidence set.
 *
 * The budget below counts EVERY `/api/` request a cold load of the surface makes,
 * including the shell's own reads:
 *
 *   1 × `/auth/me`  +  2 × shell readiness (`/reports/catalog`, `/devices`)
 *   + the surface's own reads.
 *
 * A regression here is exactly the kind the performance-hardening rules exist to
 * catch — a per-row fan-out, a duplicated `/auth/me`, or a responsive double
 * mount — so the ceilings are deliberately tight.
 *
 * ⚠️ The measurement is a RELOAD of the already-open surface, not the first
 * navigation after login. Attaching the capture straight after `managerLogin`
 * catches the tail of the landing page's own `/auth/me` and reports it as this
 * surface's duplicate, which is a measurement artifact rather than a finding —
 * confirmed live while writing these specs (a reload of the orders list issues
 * exactly one `/auth/me`).
 */
const SURFACE_BUDGETS = [
  { name: "operations-orders", url: MANAGER_OPERATIONS_ROUTES.orders, max: 4 },
  { name: "operations-tables", url: MANAGER_OPERATIONS_ROUTES.tables, max: 6 },
  { name: "operations-reservations", url: MANAGER_OPERATIONS_ROUTES.reservations, max: 4 },
  { name: "staff-directory", url: MANAGER_STAFF_ROUTES.directory, max: 4 },
  { name: "staff-quick-pin", url: MANAGER_STAFF_ROUTES.quickPin, max: 4 },
  { name: "staff-leave", url: MANAGER_STAFF_ROUTES.leave, max: 4 },
  { name: "staff-shift-swaps", url: MANAGER_STAFF_ROUTES.shiftSwaps, max: 4 },
  { name: "staff-onboarding", url: MANAGER_STAFF_ROUTES.onboarding, max: 3 },
] as const;

test.describe("Manager B3 — request-count discipline", () => {
  // Each case logs in, lands, reloads and then holds still to prove nothing polls;
  // that sequence does not fit the 60s default on the heavier surfaces.
  test.describe.configure({ timeout: 150_000 });

  for (const surface of SURFACE_BUDGETS) {
    test(`${surface.name} loads within ${surface.max} API requests`, async ({ page }) => {
      await managerLogin(page);
      // Land on the surface first, and let the login-landing page's own reads
      // finish, so the measurement below is this surface's cold load alone.
      await page.goto(surface.url);
      await waitForListSettled(page).catch(() => {
        // The onboarding form is not a list; it has no list to settle.
      });
      await page.waitForTimeout(2_000);

      const requests = captureApiRequests(page);
      await page.reload();
      await waitForListSettled(page).catch(() => {});
      await page.waitForTimeout(2_500);

      const urls = requests.map((request) => new URL(request.url).pathname);
      expect(
        requests.length,
        `${surface.name} issued ${requests.length} requests: ${urls.join(", ")}`,
      ).toBeLessThanOrEqual(surface.max);

      // No duplicate identity read — the hardening rule this most often breaks.
      expect(urls.filter((path) => path.endsWith("/auth/me")).length).toBeLessThanOrEqual(1);

      // Nothing polls: a second window with no interaction must add no traffic.
      const settled = requests.length;
      await page.waitForTimeout(3_000);
      expect(requests.length, `${surface.name} does not poll`).toBe(settled);
    });
  }
});

test.describe("Manager B3 — screenshot evidence", () => {
  const SHOTS = [
    { name: "operations-orders-list", url: MANAGER_OPERATIONS_ROUTES.orders },
    { name: "operations-tables-floor", url: MANAGER_OPERATIONS_ROUTES.tables },
    { name: "operations-reservations", url: MANAGER_OPERATIONS_ROUTES.reservations },
    { name: "staff-directory-kanban", url: MANAGER_STAFF_ROUTES.directory },
    { name: "staff-directory-list", url: `${MANAGER_STAFF_ROUTES.directory}?view=list` },
    { name: "staff-onboarding-step1", url: MANAGER_STAFF_ROUTES.onboarding },
    { name: "staff-quick-pin", url: MANAGER_STAFF_ROUTES.quickPin },
    { name: "staff-leave-review", url: MANAGER_STAFF_ROUTES.leave },
    { name: "staff-shift-swaps", url: MANAGER_STAFF_ROUTES.shiftSwaps },
  ] as const;

  for (const shot of SHOTS) {
    test(`captures ${shot.name}`, async ({ page }, testInfo) => {
      const errors = captureConsoleErrors(page);
      await managerLogin(page);
      await page.goto(shot.url);
      await waitForListSettled(page).catch(() => {});
      await page.waitForTimeout(1_200);

      await page.screenshot({
        path: `e2e/.evidence/manager-b3/${testInfo.project.name}/${shot.name}.png`,
        fullPage: true,
      });

      expect(errors, `console errors on ${shot.name}: ${errors.join(" | ")}`).toEqual([]);
    });
  }
});
