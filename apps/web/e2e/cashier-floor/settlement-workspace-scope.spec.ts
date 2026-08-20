import { test, expect } from "@playwright/test";

import { uiLogin } from "../supervisor-prompt3/fixtures";
import { apiCreateBill } from "./c2-fixtures";

/**
 * Settlement workspace scope.
 *
 * C2 shipped this as `settlement-workspace-readonly.spec.ts` and asserted that
 * the workspace exposed NO mutation control. **Prompt C3 (2026-08-20) supersedes
 * that premise**: payment collection, partial/split settlement and close now
 * execute here. What survives — and is asserted below — is the canonical section
 * set and the boundary that still holds after C3: no receipt, refund, transfer,
 * merge, move-items, void or discount control on the Cashier Floor path.
 */
test.describe("Cashier settlement workspace scope", () => {
  test("shows the canonical sections and no out-of-scope controls", async ({ page }) => {
    const { orderId, tableId } = await apiCreateBill();
    await uiLogin(page, "cashier");
    await page.goto(`/cashier/floor?tableId=${tableId}&orderId=${orderId}`);
    await expect(page.locator("[data-operational-workspace]")).toBeVisible({ timeout: 25_000 });

    for (const name of [/^Bill$/i, /^Totals$/i, /^Payment state$/i, /^Settlement readiness$/i, /^Settlement$/i]) {
      await expect(page.getByRole("heading", { level: 3, name })).toBeVisible();
    }
    // The C2 read-only claim is gone — the workspace must not still assert it.
    await expect(page.getByText(/^Read-only$/i)).toHaveCount(0);
    await expect(page.getByText(/This foundation is read-only/i)).toHaveCount(0);

    // Out of scope after C3 (receipt/refund land in C4; handoff/adjustment never).
    for (const name of [
      /^open refund$/i,
      /create refund/i,
      /print receipt/i,
      /reprint/i,
      /send receipt/i,
      /transfer table/i,
      /transfer server/i,
      /^merge$/i,
      /move items/i,
      /^void$/i,
      /request discount/i,
    ]) {
      await expect(page.getByRole("button", { name })).toHaveCount(0);
    }
  });
});
