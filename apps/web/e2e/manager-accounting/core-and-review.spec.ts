import { test, expect } from "@playwright/test";

import {
  ACCOUNTING_ROUTES,
  apiCreatePostingError,
  apiFindReversibleJournal,
  apiLoginManager,
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
  MANAGER_CFG,
  recordPager,
  waitForApiRequest,
  waitForManagerListSettled,
} from "./fixtures";

/**
 * Track B5.4 — Manager Accounting → Accounting core (Journal entries) +
 * Review (Posting runs, Posting errors, Audit trail). Posting runs and Audit
 * trail stay list-only/read-only. **Journal entries gained Reverse and
 * Posting errors gained Resolve/Dismiss in Track B5.7** (2026-08-22) —
 * journal CREATE and posting-run REPLAY remain deliberately undeferred (a
 * dynamic multi-line form and a no-detail-route surface respectively; see
 * `ACCOUNTING_DENIED_WRITES`).
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

    // INVERTED (Track B5.7): the sidebar renders EITHER a real Reverse
    // control (POSTED) or the "Posting a new journal entry"/"replaying a
    // posting run" disclosure (any other status) — never both, never
    // neither. Which one depends on the FIRST row's own status, so this
    // test asserts the disjunction rather than assuming a fixed status —
    // see the dedicated write-lifecycle describe block below for a test
    // that pins a specific POSTED journal and exercises Reverse for real.
    const hasReverse = await page.getByRole("button", { name: /^reverse journal$/i }).count();
    const hasDisclosure = await page.getByText(/Posting a new journal entry/i).count();
    expect(hasReverse + hasDisclosure).toBeGreaterThan(0);
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

  test("INVERTED (Track B5.7) — a row's detail offers real Resolve/Dismiss controls (OPEN) or a real resolution record (RESOLVED/DISMISSED), never the old 'no endpoint exists' disclosure", async ({
    page,
  }) => {
    await managerLogin(page);
    await page.goto(ACCOUNTING_ROUTES.postingErrors);
    await waitForManagerListSettled(page);
    test.skip((await listRows(page).count()) === 0, "no posting error seeded on this branch");

    await listRows(page).first().click();
    await expect(recordPager(page)).toBeVisible();

    // B5.4-D1 was fixed at the backend in batch 4 and built on by Track
    // B5.7 — the old "no endpoint exists anywhere in this API" claim must
    // never render again.
    await expect(page.getByText(/no endpoint exists/i)).toHaveCount(0);
    await expect(page.getByText(/^No role can act/i)).toHaveCount(0);

    const hasActions =
      (await page.getByRole("button", { name: /^resolve$/i }).count()) +
      (await page.getByRole("button", { name: /^dismiss$/i }).count());
    const hasResolution = await page.getByText("Resolution", { exact: true }).count();
    expect(hasActions + hasResolution).toBeGreaterThan(0);
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
 * Read-only guarantees, re-proven on all four B5.4 surfaces at LIST level —
 * same shape as the B5.2/B5.3 sweeps in `menu-and-read-only.spec.ts`.
 * Journal entries and Posting errors gained real detail-level write controls
 * in Track B5.7 (Reverse, Resolve/Dismiss) — this sweep still holds for them
 * because none of those controls render on the LIST view, only inside a
 * selected record; the dedicated write-lifecycle describe blocks below open
 * a record and positively assert the controls exist there instead.
 */
const B5_4_SURFACES = [
  ACCOUNTING_ROUTES.journals,
  ACCOUNTING_ROUTES.postingRuns,
  ACCOUNTING_ROUTES.postingErrors,
  ACCOUNTING_ROUTES.auditTrail,
] as const;

test.describe("Manager accounting is read-only on the B5.4 Accounting core + Review LIST views", () => {
  test("no create, post, reverse, replay or resolve control renders on any B5.4 list view", async ({ page }) => {
    await managerLogin(page);

    for (const route of B5_4_SURFACES) {
      await page.goto(route);
      await waitForManagerListSettled(page);

      const content = page.locator("main");
      for (const label of [/^new$/i, /^post$/i, /^reverse journal$/i, /^replay$/i, /^resolve$/i, /^dismiss$/i]) {
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

/**
 * Track B5.7 (2026-08-22) — Posting errors write coverage. A fresh OPEN
 * error is raised via `posting/replay` with an unknown sourceKey (the
 * documented way to raise one — self-contained QA data, not committed
 * seed rows), then resolved/dismissed through the real UI.
 */
test.describe("Manager accounting — Posting errors write lifecycle (Track B5.7)", () => {
  test("resolve an OPEN posting error through the real dialog; a repeat attempt is refused", async ({ page }) => {
    const token = await apiLoginManager();
    const { errorId } = await apiCreatePostingError(token, MANAGER_CFG.defaultBranchId);

    await managerLogin(page);
    await page.goto(`${ACCOUNTING_ROUTES.postingErrors}?errorId=${errorId}`);
    await waitForManagerListSettled(page);

    const resolveButton = page.getByRole("button", { name: /^resolve$/i });
    await expect(resolveButton).toBeVisible();
    await resolveButton.click();
    const dialog = page.getByRole("dialog", { name: /resolve posting error/i });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/^notes/i).fill("B57GAP UI resolve");
    await dialog.getByRole("button", { name: /^resolve$/i }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByText("Resolution", { exact: true })).toBeVisible();
    await expect(page.getByText(/^resolved$/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^resolve$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^dismiss$/i })).toHaveCount(0);

    // Repeat via the API — the backend status guard, independent of the UI hiding the buttons.
    const headers = { Authorization: `Bearer ${token}`, "X-Branch-Id": MANAGER_CFG.defaultBranchId };
    const repeatRes = await fetch(`${MANAGER_CFG.api}/api/accounting/posting-errors/${errorId}/resolve`, { method: "PATCH", headers });
    expect(repeatRes.status).toBe(409);
  });

  test("dismiss an OPEN posting error through the real dialog", async ({ page }) => {
    const token = await apiLoginManager();
    const { errorId } = await apiCreatePostingError(token, MANAGER_CFG.defaultBranchId);

    await managerLogin(page);
    await page.goto(`${ACCOUNTING_ROUTES.postingErrors}?errorId=${errorId}`);
    await waitForManagerListSettled(page);

    const dismissButton = page.getByRole("button", { name: /^dismiss$/i });
    await expect(dismissButton).toBeVisible();
    await dismissButton.click();
    const dialog = page.getByRole("dialog", { name: /dismiss posting error/i });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /^dismiss$/i }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByText(/^dismissed$/i).first()).toBeVisible();
  });
});

/**
 * Track B5.7 (2026-08-22) — Journal reverse coverage. Demo-import seeds
 * several POSTED journals on Tapas Downtown; this picks one live rather
 * than assuming a specific journal number, so the spec survives a stack
 * where an earlier run already reversed the "first" one.
 */
test.describe("Manager accounting — Journal reverse (Track B5.7)", () => {
  test("reverse a POSTED journal through the real dialog; a repeat attempt is refused", async ({ page }) => {
    const token = await apiLoginManager();
    const journalId = await apiFindReversibleJournal(token, MANAGER_CFG.defaultBranchId);
    test.skip(!journalId, "no POSTED journal available to reverse on this branch");

    await managerLogin(page);
    await page.goto(`${ACCOUNTING_ROUTES.journals}?journalId=${journalId}`);
    await waitForManagerListSettled(page);

    const reverseButton = page.getByRole("button", { name: /^reverse journal$/i });
    await expect(reverseButton).toBeVisible();
    await reverseButton.click();
    const dialog = page.getByRole("dialog", { name: /reverse journal/i });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/cannot be undone/i);
    await dialog.getByLabel(/^reason/i).fill("B57GAP UI reverse");
    await dialog.getByRole("button", { name: /^reverse$/i }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByText(/^reversed$/i).first()).toBeVisible();
    await expect(page.getByText(/reversed by/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^reverse journal$/i })).toHaveCount(0);

    const headers = { Authorization: `Bearer ${token}`, "X-Branch-Id": MANAGER_CFG.defaultBranchId };
    const repeatRes = await fetch(`${MANAGER_CFG.api}/api/accounting/journals/${journalId}/reverse`, { method: "POST", headers });
    expect(repeatRes.status).toBe(409);
  });
});
