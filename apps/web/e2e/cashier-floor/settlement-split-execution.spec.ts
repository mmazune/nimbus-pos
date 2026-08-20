import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { apiBillState, apiCreateServedBill, apiEnsureCashierShift } from "./c3-fixtures";

/**
 * Prompt C3 — split settlement executes from the Floor workspace through the
 * existing split primitives, with a truthful parent/child representation:
 *
 *  - split-bill records an ALLOCATION on the parent (metadata only, no child
 *    orders, payments still attach to the parent);
 *  - one allocation group can then be collected as a partial payment;
 *  - the Floor path offers split allocation only — merge / move-items /
 *    transfer-table are not cashier settlement actions.
 */
test.describe("Cashier settlement — split execution", () => {
  test("an equal split records a truthful allocation the cashier can then part-pay", async ({ page }) => {
    test.slow();
    const shiftReady = await apiEnsureCashierShift();
    test.skip(!shiftReady, "cashier shift readiness unavailable on this stack");

    const bill = await apiCreateServedBill(3);
    test.skip(!bill, "could not build a SERVED QA bill on this stack");
    if (!bill) return;

    await uiLogin(page, "cashier");
    await page.goto(`/cashier/floor?tableId=${bill.tableId}&orderId=${bill.orderId}`);
    await expect(page.locator("[data-operational-workspace]")).toBeVisible({ timeout: 25_000 });

    // Split allocation is offered; handoff actions are not.
    await expect(page.getByRole("heading", { name: /split bill allocation/i })).toBeVisible();
    await expect(page.getByText(/It does not create separate child orders/i)).toBeVisible();
    for (const name of [/transfer table/i, /^merge$/i, /move items/i]) {
      await expect(page.getByRole("button", { name })).toHaveCount(0);
    }

    const saveSplit = page.getByRole("button", { name: /^save split$/i });
    await expect(saveSplit).toBeEnabled({ timeout: 20_000 });
    await saveSplit.click();

    const dialog = page.locator('div[aria-labelledby="cashier-resolution-confirm-title"]');
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /^save split$/i }).click();

    await expect(page.getByText(/Split bill recorded\./i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Recorded split allocation/i)).toBeVisible();

    // Canonical persisted allocation — parent order is unchanged financially.
    const state = await apiBillState(bill.orderId);
    expect(state.status).toBe("SERVED");
    const splitBill = (state.metadata as Record<string, unknown> | null)?.splitBill as
      | { mode?: string; groups?: unknown[]; allocated?: string }
      | undefined;
    expect(splitBill?.mode).toBe("EQUAL");
    expect(Array.isArray(splitBill?.groups)).toBe(true);
    expect((splitBill?.groups || []).length).toBeGreaterThanOrEqual(2);
    expect(Number(splitBill?.allocated)).toBeCloseTo(bill.total, 2);
    expect(Number(state.total)).toBeCloseTo(bill.total, 2);
    expect(Number(state.totalPaid)).toBe(0);
  });
});
