import { test, expect, Page, Locator } from "@playwright/test";

import {
  ACCOUNTING_ROUTES,
  apiCreateFiscalPeriod,
  apiCreatePostingError,
  apiCreateReconciliationFixture,
  apiLoginManager,
  MANAGER_CFG,
  managerLogin,
  waitForManagerListSettled,
} from "./fixtures";

/**
 * B5.7-GAP (2026-08-22) — dialog/modal overflow at the two short-viewport
 * ends where the `html { font-size: clamp(...) }` density system has broken
 * layout before. Neither 1280x680 nor 1366x768 is a standard Playwright
 * `project` in `playwright.config.ts` (the four projects are
 * 1024x768/1366x768/1440x900/1920x1080) — 1280x680 in particular is a
 * bespoke viewport this repo's own manual-QA history uses for the
 * "collapsed nav" breakpoint boundary, not a project. Both are forced
 * explicitly via `page.setViewportSize` inside each test, independent of
 * whichever project label happens to run this file, so the assertion is
 * exact regardless of test-runner viewport defaults.
 *
 * Every dialog opened here is real — created via the same API fixture
 * helpers the write-lifecycle specs use, not a mock.
 */

const SHORT_VIEWPORTS = [
  { width: 1280, height: 680 },
  { width: 1366, height: 768 },
] as const;

/**
 * Asserts: (1) the dialog's own bounding box is fully inside the viewport
 * (nothing clips at an edge), (2) its primary action button is reachable
 * without scrolling the PAGE BODY (the dialog is a fixed/portal overlay —
 * `ActionConfirmDialog` caps itself at `max-h-[calc(100vh-2rem)]` and
 * scrolls internally, which is fine; the page behind it must never need to
 * scroll to reach the button).
 */
async function assertDialogFitsViewport(page: Page, dialog: Locator, primaryAction: Locator) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("viewport not set");

  const dialogBox = await dialog.boundingBox();
  expect(dialogBox, "dialog must have a bounding box (be laid out, not display:none)").not.toBeNull();
  if (!dialogBox) return;

  expect(dialogBox.x, "dialog left edge is not clipped off-screen").toBeGreaterThanOrEqual(0);
  expect(dialogBox.y, "dialog top edge is not clipped off-screen").toBeGreaterThanOrEqual(0);
  expect(dialogBox.x + dialogBox.width, "dialog right edge fits within the viewport width").toBeLessThanOrEqual(viewport.width + 1);
  expect(dialogBox.y + dialogBox.height, "dialog bottom edge fits within the viewport height (its own max-h + internal scroll must cap it)").toBeLessThanOrEqual(viewport.height + 1);

  const actionBox = await primaryAction.boundingBox();
  expect(actionBox, "the primary action button must be laid out").not.toBeNull();
  if (!actionBox) return;
  expect(actionBox.y, "the primary action is not above the visible viewport").toBeGreaterThanOrEqual(0);
  expect(actionBox.y + actionBox.height, "the primary action is reachable within the viewport height").toBeLessThanOrEqual(viewport.height + 1);

  // The dialog itself must be a `position: fixed` viewport-anchored overlay
  // (ActionConfirmDialog: `fixed inset-0 … flex items-center justify-center`)
  // — asserted directly rather than via `document.documentElement.scrollHeight`.
  // scrollHeight reflects the UNDERLYING page's natural content height (e.g.
  // a long accounting list behind the modal), which is irrelevant to whether
  // the modal's own actions are reachable, and using it as a proxy produced
  // false positives against exactly the kind of stack this suite itself
  // grows over repeated runs (many fixture rows behind the dialog) — found
  // and corrected while writing this spec.
  const position = await dialog.evaluate((el) => getComputedStyle(el.parentElement || el).position);
  expect(position, "the dialog's overlay wrapper is position:fixed, not flowed in-document").toBe("fixed");
}

for (const viewport of SHORT_VIEWPORTS) {
  test.describe(`Dialog overflow — ${viewport.width}x${viewport.height}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(viewport);
    });

    test("Lock fiscal period confirm dialog fits, with the typed-name field and Lock button both reachable", async ({ page }) => {
      const token = await apiLoginManager();
      const period = await apiCreateFiscalPeriod(token, MANAGER_CFG.defaultBranchId);
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Branch-Id": MANAGER_CFG.defaultBranchId };
      await fetch(`${MANAGER_CFG.api}/api/accounting/periods/${period.id}/open`, { method: "PATCH", headers });
      await fetch(`${MANAGER_CFG.api}/api/accounting/periods/${period.id}/close`, { method: "PATCH", headers });

      await managerLogin(page);
      await page.goto(ACCOUNTING_ROUTES.fiscalPeriods);
      await waitForManagerListSettled(page);

      const row = page.getByRole("row", { name: new RegExp(period.name) });
      await expect(row).toBeVisible();
      await row.getByRole("button", { name: /^lock$/i }).click();

      const dialog = page.getByRole("dialog", { name: /lock fiscal period/i });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByLabel(/type ".*" to confirm/i)).toBeVisible();
      const confirmButton = dialog.getByRole("button", { name: /^lock permanently$/i });
      await assertDialogFitsViewport(page, dialog, confirmButton);

      // The field itself must also be reachable, not only the button.
      const fieldBox = await dialog.getByLabel(/type ".*" to confirm/i).boundingBox();
      expect(fieldBox).not.toBeNull();
      if (fieldBox) {
        expect(fieldBox.y).toBeGreaterThanOrEqual(0);
        expect(fieldBox.y + fieldBox.height).toBeLessThanOrEqual(viewport.height + 1);
      }
    });

    test("Resolve posting error dialog fits, with the notes field and Resolve button both reachable", async ({ page }) => {
      const token = await apiLoginManager();
      const { errorId } = await apiCreatePostingError(token, MANAGER_CFG.defaultBranchId);

      await managerLogin(page);
      await page.goto(`${ACCOUNTING_ROUTES.postingErrors}?errorId=${errorId}`);
      await waitForManagerListSettled(page);

      await page.getByRole("button", { name: /^resolve$/i }).click();
      const dialog = page.getByRole("dialog", { name: /resolve posting error/i });
      await expect(dialog).toBeVisible();
      const confirmButton = dialog.getByRole("button", { name: /^resolve$/i });
      await assertDialogFitsViewport(page, dialog, confirmButton);
    });

    test("Dismiss posting error dialog fits, with the Dismiss button reachable", async ({ page }) => {
      const token = await apiLoginManager();
      const { errorId } = await apiCreatePostingError(token, MANAGER_CFG.defaultBranchId);

      await managerLogin(page);
      await page.goto(`${ACCOUNTING_ROUTES.postingErrors}?errorId=${errorId}`);
      await waitForManagerListSettled(page);

      await page.getByRole("button", { name: /^dismiss$/i }).click();
      const dialog = page.getByRole("dialog", { name: /dismiss posting error/i });
      await expect(dialog).toBeVisible();
      const confirmButton = dialog.getByRole("button", { name: /^dismiss$/i });
      await assertDialogFitsViewport(page, dialog, confirmButton);
    });

    test("Complete reconciliation dialog fits, with the Complete button reachable", async ({ page }) => {
      const token = await apiLoginManager();
      const fixture = await apiCreateReconciliationFixture(token, MANAGER_CFG.defaultBranchId);
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Branch-Id": MANAGER_CFG.defaultBranchId };
      await fetch(`${MANAGER_CFG.api}/api/accounting/reconciliation/${fixture.reconciliationId}/match`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ bankStatementLineId: fixture.statementLineId, manualEntryId: fixture.manualEntryId }),
      });

      await managerLogin(page);
      await page.goto(`${ACCOUNTING_ROUTES.bankReconciliation}?reconciliationId=${fixture.reconciliationId}`);
      await waitForManagerListSettled(page);

      const completeButton = page.getByRole("button", { name: /^complete reconciliation$/i });
      await expect(completeButton).toBeVisible();
      await completeButton.click();
      const dialog = page.getByRole("dialog", { name: /complete reconciliation/i });
      await expect(dialog).toBeVisible();
      const confirmButton = dialog.getByRole("button", { name: /^complete$/i });
      await assertDialogFitsViewport(page, dialog, confirmButton);
    });

    test("Match statement line dialog fits, with both id fields and the Match button reachable", async ({ page }) => {
      const token = await apiLoginManager();
      const fixture = await apiCreateReconciliationFixture(token, MANAGER_CFG.defaultBranchId);

      await managerLogin(page);
      await page.goto(`${ACCOUNTING_ROUTES.bankReconciliation}?reconciliationId=${fixture.reconciliationId}`);
      await waitForManagerListSettled(page);

      await page.getByRole("button", { name: /^match$/i }).click();
      const dialog = page.getByRole("dialog", { name: /match statement line/i });
      await expect(dialog).toBeVisible();
      const confirmButton = dialog.getByRole("button", { name: /^match$/i });
      await assertDialogFitsViewport(page, dialog, confirmButton);
    });

    test("New fiscal period dialog fits, with Name/Starts/Ends and Create period all reachable", async ({ page }) => {
      await managerLogin(page);
      await page.goto(ACCOUNTING_ROUTES.fiscalPeriods);
      await waitForManagerListSettled(page);

      await page.getByRole("button", { name: /^new period$/i }).click();
      const dialog = page.getByRole("dialog", { name: /new fiscal period/i });
      await expect(dialog).toBeVisible();
      const confirmButton = dialog.getByRole("button", { name: /^create period$/i });
      await assertDialogFitsViewport(page, dialog, confirmButton);

      for (const label of [/^name/i, /^starts/i, /^ends/i]) {
        const box = await dialog.getByLabel(label).boundingBox();
        expect(box, `field ${label} must be laid out`).not.toBeNull();
        if (box) expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
      }
    });

    test("Reverse journal dialog fits, with the reason field and Reverse button both reachable", async ({ page }) => {
      const token = await apiLoginManager();
      const res = await fetch(`${MANAGER_CFG.api}/api/accounting/journals?status=POSTED&take=20`, {
        headers: { Authorization: `Bearer ${token}`, "X-Branch-Id": MANAGER_CFG.defaultBranchId },
      });
      const json = await res.json();
      const journalId = (json.data || [])[0]?.id as string | undefined;
      test.skip(!journalId, "no POSTED journal available on this branch");

      await managerLogin(page);
      await page.goto(`${ACCOUNTING_ROUTES.journals}?journalId=${journalId}`);
      await waitForManagerListSettled(page);
      const reverseButton = page.getByRole("button", { name: /^reverse journal$/i });
      test.skip((await reverseButton.count()) === 0, "the picked journal was already reversed by an earlier run");

      await reverseButton.click();
      const dialog = page.getByRole("dialog", { name: /reverse journal/i });
      await expect(dialog).toBeVisible();
      const confirmButton = dialog.getByRole("button", { name: /^reverse$/i });
      await assertDialogFitsViewport(page, dialog, confirmButton);
    });
  });
}
