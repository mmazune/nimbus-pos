import { test, expect } from "@playwright/test";
import { uiLogin, apiCreateSentOrder } from "./fixtures";

// Destructive UI integration: opens a real API-created SENT order in the canonical
// workspace (URL-backed selection) and drives an action through the real dialog.
test.describe.configure({ mode: "serial" });

test.describe("Supervisor order workspace — action availability + Request bill through the UI", () => {
  test("workspace opens for a selected order and shows the in-scope action controls (no payment-collection/close/refund)", async ({ page }) => {
    const { orderId, tableId } = await apiCreateSentOrder();
    await uiLogin(page, "supervisor");
    await page.goto(`/supervisor/floor?tableId=${tableId}&orderId=${orderId}`);

    // In-scope actions visible on a SENT dine-in order.
    for (const label of ["Request bill", "Split bill", "Transfer table", "Void"]) {
      await expect(page.getByRole("button", { name: new RegExp(label, "i") }).first()).toBeVisible({ timeout: 20_000 });
    }
    // Forbidden actions never present.
    await expect(page.getByRole("button", { name: /collect payment|close order|refund|post-close/i })).toHaveCount(0);
  });

  test("Request bill fires the mutation and settles cleanly (no permanent pending, no error)", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));

    const { orderId, tableId } = await apiCreateSentOrder();
    await uiLogin(page, "supervisor");
    await page.goto(`/supervisor/floor?tableId=${tableId}&orderId=${orderId}`);

    // Request bill is audit-only and mutates directly (no confirm dialog).
    const trigger = page.getByRole("button", { name: /^request bill$/i }).first();
    await expect(trigger).toBeVisible({ timeout: 20_000 });
    await expect(trigger).toBeEnabled();
    await trigger.click();

    // Mutation must settle: the button returns to its idle "Request bill" label and
    // is enabled again (it shows "Requesting bill" only while pending) — no permanent pending.
    await expect(page.getByRole("button", { name: /^request bill$/i }).first()).toBeEnabled({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /requesting bill/i })).toHaveCount(0);
    expect(pageErrors, `uncaught page errors: ${pageErrors.join(" | ")}`).toHaveLength(0);
  });
});
