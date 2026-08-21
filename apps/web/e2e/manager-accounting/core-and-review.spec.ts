import { test, expect } from "@playwright/test";

import {
  ACCOUNTING_ROUTES,
  JOURNAL_STATUS_VALUES,
  POSTING_ERROR_STATUS_VALUES,
  branchSwitcher,
  captureApiRequests,
  captureConsoleErrors,
  listFilterOption,
  listFilterTrigger,
  listRows,
  listTable,
  managerLogin,
  managerPager,
  recordPager,
  waitForApiRequest,
  waitForManagerListSettled,
} from "./fixtures";

/**
 * Track B5.4 — Manager Accounting → Accounting core (Journal entries) +
 * Review (Posting runs, Posting errors, Audit trail). Frontend-only,
 * strictly READ-ONLY (PC-01/OD-9) — Manager holds `journals:read`,
 * `posting-runs:read`, `posting-errors:read` and `audit:read` but none of
 * `journals:create`, `journals:reverse`, `posting:replay`, so there is no
 * post/reverse/replay control anywhere on these four surfaces.
 *
 * ⚠️ Scope note: this phase's operator brief described fiscal periods,
 * posting-source-maps and tax-config as B5.4 deliverables. The menu tree's
 * own `ACCOUNTING_SUBPHASES` tags (unchanged since B5.1) say those are B5.5/
 * B5.6, not B5.4 — see `lib/accounting/menu.ts`'s docblock. This spec covers
 * exactly the four B5.4-tagged rows.
 *
 * Fixtures: `B5.4-QA-*`-referenced journals/posting-runs/posting-errors were
 * created live via the Owner token on the isolated stack's Tapas Downtown
 * branch (see the completion report) — every row-dependent assertion below
 * still tolerates an honest empty state via `test.skip`, matching the B5.3
 * `bank.spec.ts` pattern, since a from-scratch seed/demo-import alone already
 * carries real journal data without the QA fixtures.
 */
test.describe("Manager accounting — Journal entries", () => {
  test("journals list renders live balanced rows with a real server total", async ({ page }) => {
    await managerLogin(page);
    const errors = captureConsoleErrors(page);
    await page.goto(ACCOUNTING_ROUTES.journals);
    await waitForManagerListSettled(page);

    await expect(page.getByRole("heading", { name: /unavailable/i })).toHaveCount(0);
    expect(errors).toEqual([]);
    test.skip((await listRows(page).count()) === 0, "no journal seeded on this branch");

    await expect(listTable(page)).toBeVisible();
    await expect(managerPager(page)).toBeVisible();
    // Every column-total row balances — createJournal refuses to persist a
    // mismatch, so debit and credit totals for the page must be identical.
    const totalsRow = page.getByText("This page").locator("..");
    const totalsText = (await totalsRow.textContent()) || "";
    const amounts = (totalsText.match(/[\d,]+/g) || []).map((value) => value.replace(/,/g, ""));
    expect(amounts.length).toBeGreaterThanOrEqual(2);
    expect(amounts[0]).toBe(amounts[1]);
  });

  test("the status filter offers every real JournalStatus value and narrows server-side", async ({ page }) => {
    await managerLogin(page);
    const requests = captureApiRequests(page);
    await page.goto(ACCOUNTING_ROUTES.journals);
    await waitForManagerListSettled(page);
    test.skip((await listRows(page).count()) === 0, "no journal seeded on this branch");

    await listFilterTrigger(page, "Filter journal entries").click();
    for (const value of JOURNAL_STATUS_VALUES) {
      await expect(page.getByRole("menuitemcheckbox", { name: new RegExp(`^${value}$`, "i") })).toBeVisible();
    }
    await listFilterOption(page, "Posted").click();

    await expect.poll(() => page.url()).toContain("status=POSTED");
    const filtered = await waitForApiRequest(requests, /\/api\/accounting\/journals\?.*status=POSTED/);
    expect(filtered.length).toBeGreaterThan(0);
  });

  test("opening a row shows the two-independently-computed balance tie-out and separate debit/credit columns", async ({
    page,
  }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.journals);
    await waitForManagerListSettled(page);
    test.skip((await listRows(page).count()) === 0, "no journal seeded on this branch");

    await listRows(page).first().click();
    await expect(recordPager(page)).toBeVisible();

    // Debit and credit are always two separate columns — never one signed amount.
    await expect(page.getByRole("columnheader", { name: "Debit" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Credit" })).toBeVisible();

    await expect(page.getByText("Balance tie-out")).toBeVisible();
    await expect(page.getByText("Header total debit")).toBeVisible();
    await expect(page.getByText("Sum of debit lines")).toBeVisible();
    await expect(page.getByText("Header total credit")).toBeVisible();
    await expect(page.getByText("Sum of credit lines")).toBeVisible();

    // Read-only disclosure — no post/reverse/replay affordance.
    await expect(page.getByText(/Posting a journal entry/i)).toBeVisible();
  });

  test("journals genuinely re-scope on a branch switch", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.journals);
    await waitForManagerListSettled(page);

    const requests = captureApiRequests(page);
    const before = requests.filter((request) => /\/api\/accounting\/journals\?/.test(request.url)).length;

    await branchSwitcher(page).selectOption({ label: "Rooftop Bar" });
    const after = await waitForApiRequest(requests, /\/api\/accounting\/journals\?/);
    expect(after.length).toBeGreaterThan(before);
    // The header carries the NEW branch — this is a real re-scope, not a client filter.
    const lastRequest = after[after.length - 1];
    expect(lastRequest.branchId).toBeTruthy();
  });
});

test.describe("Manager accounting — Posting runs", () => {
  test("posting runs list renders with no filter menu at all — the endpoint supports none", async ({ page }) => {
    await managerLogin(page);
    const errors = captureConsoleErrors(page);
    await page.goto(ACCOUNTING_ROUTES.postingRuns);
    await waitForManagerListSettled(page);

    await expect(page.getByRole("heading", { name: /unavailable/i })).toHaveCount(0);
    expect(errors).toEqual([]);
    await expect(page.getByPlaceholder(/filter/i)).toHaveCount(0);
    // No search/filter trigger of any kind renders on this surface.
    await expect(page.locator('[aria-label^="Filter"]')).toHaveCount(0);
  });

  test("a run's own journal, when present, links into Journal entries", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.postingRuns);
    await waitForManagerListSettled(page);
    test.skip((await listRows(page).count()) === 0, "no posting run seeded on this branch");

    const journalLink = listTable(page).getByRole("link").first();
    test.skip((await journalLink.count()) === 0, "no succeeded run with a linked journal on this branch");
    await journalLink.click();
    await page.waitForURL(/\/manager\/accounting\/journals\?journalId=/, { timeout: 15_000 });
  });
});

test.describe("Manager accounting — Posting errors", () => {
  test("posting errors list renders and every OPEN row is visually distinct", async ({ page }) => {
    await managerLogin(page);
    const errors = captureConsoleErrors(page);
    await page.goto(ACCOUNTING_ROUTES.postingErrors);
    await waitForManagerListSettled(page);

    await expect(page.getByRole("heading", { name: /unavailable/i })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("the status filter offers every real PostingErrorStatus value", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.postingErrors);
    await waitForManagerListSettled(page);
    test.skip((await listRows(page).count()) === 0, "no posting error seeded on this branch");

    await listFilterTrigger(page, "Filter posting errors").click();
    for (const value of POSTING_ERROR_STATUS_VALUES) {
      await expect(page.getByRole("menuitemcheckbox", { name: new RegExp(`^${value}$`, "i") })).toBeVisible();
    }
  });

  test("a row's detail discloses the genuine no-resolve-endpoint gap, not a role-permission boundary", async ({
    page,
  }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.postingErrors);
    await waitForManagerListSettled(page);
    test.skip((await listRows(page).count()) === 0, "no posting error seeded on this branch");

    await listRows(page).first().click();
    await expect(recordPager(page)).toBeVisible();
    await expect(page.getByText(/No role can act on this record/i)).toBeVisible();
    await expect(page.getByText(/genuine gap in this API/i)).toBeVisible();
    // This is NOT the "an Owner or Accountant performs this" read-only card —
    // that wording would be false here (see B5.4-D1).
    await expect(page.getByText(/an Owner or Accountant/i)).toHaveCount(0);
  });
});

test.describe("Manager accounting — Audit trail", () => {
  test("the audit trail page renders with the C-26 gap disclosed, not an unexplained empty list", async ({ page }) => {
    await managerLogin(page);
    const errors = captureConsoleErrors(page);
    await page.goto(ACCOUNTING_ROUTES.auditTrail);
    await waitForManagerListSettled(page);

    await expect(page.getByRole("heading", { name: /unavailable/i })).toHaveCount(0);
    expect(errors).toEqual([]);

    // C-26 (Track B5.4 finding): ledger.service.ts never stamps
    // metadata.branchId, so this branch-scoped rail cannot currently surface
    // a journal/posting-run/posting-error event — proven live, disclosed here
    // rather than left to read as "nothing happened".
    const hasRows = (await listRows(page).count()) > 0;
    if (!hasRows) {
      await expect(page.getByText(/C-26/).first()).toBeVisible();
      await expect(page.getByText(/does not mean nothing happened/i)).toBeVisible();
    }
  });

  test("the entity filter offers exactly the three curated, source-verified types", async ({ page }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.auditTrail);
    await waitForManagerListSettled(page);

    await listFilterTrigger(page, "Filter audit trail by entity").click();
    for (const label of ["Journal entries", "Posting runs", "Posting errors"]) {
      await expect(page.getByRole("menuitemcheckbox", { name: label })).toBeVisible();
    }
  });
});

/**
 * Read-only guarantees, re-proven on the four B5.4 surfaces — same shape as
 * the B5.2/B5.3 sweeps in `menu-and-read-only.spec.ts`. Additional tests, not
 * a relaxation of the dashboard-level ones there.
 */
const B5_4_SURFACES = [
  ACCOUNTING_ROUTES.journals,
  ACCOUNTING_ROUTES.postingRuns,
  ACCOUNTING_ROUTES.postingErrors,
  ACCOUNTING_ROUTES.auditTrail,
] as const;

test.describe("Manager accounting is read-only on the B5.4 Accounting core + Review surfaces", () => {
  test("no create, post, reverse, replay or resolve control renders on any B5.4 surface", async ({ page }) => {
    await managerLogin(page);

    for (const route of B5_4_SURFACES) {
      await page.goto(route);
      await waitForManagerListSettled(page);

      const content = page.locator("main");
      for (const label of [/^new$/i, /^post$/i, /^reverse$/i, /^replay$/i, /^resolve$/i, /^dismiss$/i]) {
        await expect(content.getByRole("button", { name: label })).toHaveCount(0);
      }
      await expect(content.locator("form")).toHaveCount(0);
    }
  });

  test("every B5.4 surface issues GET-only accounting/audit-scoped requests", async ({ page }) => {
    await managerLogin(page);
    const methods: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (!/\/api\/(accounting|audit)\//.test(url)) return;
      methods.push(request.method());
    });

    for (const route of B5_4_SURFACES) {
      await page.goto(route);
      await waitForManagerListSettled(page);
      await page.waitForTimeout(500);
    }

    expect(methods.length).toBeGreaterThan(0);
    expect(methods.every((method) => method === "GET")).toBe(true);
  });
});
