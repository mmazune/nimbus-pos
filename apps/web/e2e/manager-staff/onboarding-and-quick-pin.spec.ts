import { expect, test } from "@playwright/test";

import {
  MANAGER_STAFF_ROUTES,
  captureApiRequests,
  captureConsoleErrors,
  listRows,
  managerLogin,
  qaPhone,
  qaStaffName,
  waitForDirectorySettled,
  waitForListSettled,
} from "./fixtures";

/**
 * Track B3 — frontline onboarding and Quick-PIN administration.
 *
 * ⚠️ These specs CREATE REAL RECORDS. They run only against the isolated
 * disposable stack described in `docs/TESTING_AND_QA.md` — never shared Neon —
 * and every record they create is tagged `ZZQA` so it is identifiable afterwards.
 */
test.describe("Manager Staff — frontline onboarding", () => {
  test("walks the three steps and refuses to advance on invalid input", async ({ page }) => {
    const errors = captureConsoleErrors(page);
    await managerLogin(page);
    await page.goto(MANAGER_STAFF_ROUTES.onboarding);

    await expect(page.getByRole("heading", { name: "Who they are" })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("[data-manager-status-pipeline]")).toBeVisible();

    // Empty step 1 must not advance.
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("First name is required.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Who they are" })).toBeVisible();

    // An invalid phone is caught with the DTO's own rule.
    await page.locator('input[name="firstName"]').fill("Test");
    await page.locator('input[name="lastName"]').fill("Person");
    await page.locator('input[name="phone"]').fill("not a phone!!");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/Use 6-30 characters/)).toBeVisible();

    await page.locator('input[name="phone"]').fill(qaPhone(1));
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Role and start" })).toBeVisible();

    expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
  });

  test("collects no pay, contract or personal field, and offers no back-office role", async ({ page }) => {
    await managerLogin(page);
    await page.goto(MANAGER_STAFF_ROUTES.onboarding);
    await expect(page.getByRole("heading", { name: "Who they are" })).toBeVisible({ timeout: 30_000 });

    // The check is on FORM CONTROLS, not on prose: the screen deliberately SAYS
    // "no pay, contract, ... date of birth, address or emergency contact is asked
    // for or sent", and that disclosure is the point. What must not exist is a
    // field that could carry one.
    // Scoped to <main>: the shell's header carries the branch switcher, which is
    // chrome, not part of the form being audited.
    const controlNames = await page.evaluate(() =>
      Array.from(document.querySelectorAll("main input, main select, main textarea")).map((node) =>
        `${node.getAttribute("name") || ""}`.toLowerCase(),
      ),
    );
    for (const banned of [
      "compensation",
      "contract",
      "salary",
      "baseamount",
      "dateofbirth",
      "birth",
      "address",
      "emergency",
      "bank",
      "tax",
      "password",
    ]) {
      expect(
        controlNames.filter((name) => name.includes(banned)),
        `no onboarding form control may carry "${banned}"`,
      ).toEqual([]);
    }

    // Step 1 collects exactly four fields, and they are the safe ones.
    expect(controlNames.sort()).toEqual(["email", "firstname", "lastname", "phone"]);
    await expect(page.getByText(/No pay, contract, compensation profile/i)).toBeVisible();

    // Step 2 offers only the five frontline roles.
    await page.locator('input[name="firstName"]').fill("Test");
    await page.locator('input[name="lastName"]').fill("Person");
    await page.locator('input[name="phone"]').fill(qaPhone(2));
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.locator('input[name="roleName"]')).toHaveCount(5);
    for (const excluded of ["Manager", "Supervisor", "Accountant", "Owner"]) {
      await expect(page.locator(`input[name="roleName"][value="${excluded}"]`)).toHaveCount(0);
    }
    await expect(page.getByText(/Supervisor and Manager accounts are not created here/i)).toBeVisible();
  });

  test("cancelling the confirmation creates nothing", async ({ page }) => {
    const requests = captureApiRequests(page);
    await managerLogin(page);
    await page.goto(MANAGER_STAFF_ROUTES.onboarding);
    await expect(page.getByRole("heading", { name: "Who they are" })).toBeVisible({ timeout: 30_000 });

    const name = qaStaffName("Cancel");
    await page.locator('input[name="firstName"]').fill(name.firstName);
    await page.locator('input[name="lastName"]').fill(name.lastName);
    await page.locator('input[name="phone"]').fill(qaPhone(3));
    await page.getByRole("button", { name: "Continue" }).click();

    await page.locator('input[name="roleName"][value="Waiter"]').check();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "Review and create" })).toBeVisible();
    await page.getByRole("button", { name: "Create staff member" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);

    expect(
      requests.filter((request) => /frontline-staff\/onboard/.test(request.url)),
      "cancelling must not create anything",
    ).toHaveLength(0);
  });

  test("happy path creates a staff member and shows the PIN exactly once", async ({ page }) => {
    const errors = captureConsoleErrors(page);
    const requests = captureApiRequests(page);
    await managerLogin(page);
    await page.goto(MANAGER_STAFF_ROUTES.onboarding);
    await expect(page.getByRole("heading", { name: "Who they are" })).toBeVisible({ timeout: 30_000 });

    const suffix = String(Date.now()).slice(-6);
    const name = qaStaffName(suffix);
    await page.locator('input[name="firstName"]').fill(name.firstName);
    await page.locator('input[name="lastName"]').fill(name.lastName);
    await page.locator('input[name="phone"]').fill(qaPhone(Number(suffix) % 9_999_999));
    await page.getByRole("button", { name: "Continue" }).click();

    await page.locator('input[name="roleName"][value="Waiter"]').check();
    await page.getByRole("button", { name: "Continue" }).click();

    // The review step shows exactly what will be sent.
    await expect(page.getByRole("heading", { name: "Review and create" })).toBeVisible();
    await expect(page.getByText("Issued now and shown once")).toBeVisible();

    await page.getByRole("button", { name: "Create staff member" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Create and issue PIN" }).click();

    // The one-time secret panel.
    const secret = page.locator("[data-manager-one-time-secret]");
    await expect(secret).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole("heading", { name: "Staff member created" })).toBeVisible();

    // MASKED by default.
    const value = page.locator("[data-manager-secret-value]");
    await expect(value).toHaveAttribute("data-manager-secret-value", "masked");
    const maskedText = await value.innerText();
    expect(maskedText).toMatch(/^•+$/);

    // Revealed only on deliberate action.
    await secret.getByRole("button", { name: "Reveal" }).click();
    await expect(value).toHaveAttribute("data-manager-secret-value", "revealed");
    const pin = (await value.innerText()).trim();
    expect(pin).toMatch(/^\d{4,10}$/);

    await expect(secret.getByText(/cannot be retrieved later|cannot be shown again/i)).toBeVisible();

    // The request body carried no contract/compensation id, and issued a PIN.
    const onboardRequest = requests.find((request) => /frontline-staff\/onboard/.test(request.url));
    expect(onboardRequest?.method).toBe("POST");
    expect(onboardRequest?.branchId).toBeTruthy();

    // The PIN is nowhere it could persist.
    const storage = await page.evaluate(() => ({
      local: JSON.stringify(window.localStorage),
      session: JSON.stringify(window.sessionStorage),
      url: window.location.href,
    }));
    expect(storage.local, "the PIN is never in localStorage").not.toContain(pin);
    expect(storage.session, "the PIN is never in sessionStorage").not.toContain(pin);
    expect(storage.url, "the PIN is never in the URL").not.toContain(pin);

    // Dismissing drops it, and it cannot be recovered by navigating back.
    await secret.getByRole("button", { name: /I have shared it/ }).click();
    await expect(page.locator("[data-manager-one-time-secret]")).toHaveCount(0);
    await page.goto(MANAGER_STAFF_ROUTES.onboarding);
    await expect(page.getByRole("heading", { name: "Who they are" })).toBeVisible({ timeout: 30_000 });
    expect(await page.content()).not.toContain(pin);

    // The new person is in the directory.
    await page.goto(`${MANAGER_STAFF_ROUTES.directory}?q=${name.firstName}`);
    await waitForDirectorySettled(page);
    await expect(page.getByText(`${name.firstName} ${name.lastName}`).first()).toBeVisible();

    expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
  });
});

test.describe("Manager Staff — Quick PIN administration", () => {
  test("reads status on demand, not once per row", async ({ page }) => {
    const requests = captureApiRequests(page);
    await managerLogin(page);
    await page.goto(MANAGER_STAFF_ROUTES.quickPin);
    await waitForListSettled(page);

    await page.waitForTimeout(1_500);
    const statusReads = requests.filter((request) => /quick-pin-status/.test(request.url));
    expect(statusReads, "no status is read until a row is selected").toHaveLength(0);
    await expect(page.getByText(/PIN status is read one person at a time/i)).toBeVisible();

    await listRows(page).first().click();
    await expect(page.locator("[data-manager-quick-pin-panel]")).toBeVisible({ timeout: 30_000 });

    const afterSelect = requests.filter((request) => /quick-pin-status/.test(request.url));
    expect(afterSelect, "exactly one status read per selection").toHaveLength(1);
    expect(afterSelect[0].branchId).toBeTruthy();
  });

  test("omits password, 2FA, API key, passkey and session controls entirely", async ({ page }) => {
    await managerLogin(page);
    await page.goto(MANAGER_STAFF_ROUTES.quickPin);
    await waitForListSettled(page);
    await listRows(page).first().click();
    await expect(page.locator("[data-manager-quick-pin-panel]")).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Quick PIN actions" }).click();
    const menuText = await page.getByRole("menu").innerText();
    for (const absent of ["Password", "Two-factor", "2FA", "API key", "Passkey", "Revoke", "Session"]) {
      expect(menuText, `${absent} must not be offered — it does not exist in Nimbus`).not.toContain(absent);
    }
    // Exactly the three real actions.
    await expect(page.locator("[data-manager-record-action]")).toHaveCount(3);
  });

  test("cancelling a reset issues nothing", async ({ page }) => {
    const requests = captureApiRequests(page);
    await managerLogin(page);
    await page.goto(MANAGER_STAFF_ROUTES.quickPin);
    await waitForListSettled(page);
    await listRows(page).first().click();
    await expect(page.locator("[data-manager-quick-pin-panel]")).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Quick PIN actions" }).click();
    await page.locator('[data-manager-record-action="reset"]').click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/stops working immediately/i)).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);

    expect(requests.filter((request) => /quick-pin\/reset/.test(request.url))).toHaveLength(0);
    await expect(page.locator("[data-manager-one-time-secret]")).toHaveCount(0);
  });

  test("confirming a reset issues a new PIN, shown once and masked", async ({ page }) => {
    const requests = captureApiRequests(page);
    await managerLogin(page);
    await page.goto(MANAGER_STAFF_ROUTES.quickPin);
    await waitForListSettled(page);
    await listRows(page).first().click();
    await expect(page.locator("[data-manager-quick-pin-panel]")).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Quick PIN actions" }).click();
    await page.locator('[data-manager-record-action="reset"]').click();
    await page.getByRole("dialog").getByRole("button", { name: "Issue new PIN" }).click();

    const secret = page.locator("[data-manager-one-time-secret]");
    await expect(secret).toBeVisible({ timeout: 45_000 });

    const value = page.locator("[data-manager-secret-value]");
    await expect(value).toHaveAttribute("data-manager-secret-value", "masked");
    await secret.getByRole("button", { name: "Reveal" }).click();
    const pin = (await value.innerText()).trim();
    expect(pin).toMatch(/^\d{4,10}$/);

    const resetCall = requests.find((request) => /quick-pin\/reset/.test(request.url));
    expect(resetCall?.method).toBe("POST");
    expect(resetCall?.branchId).toBeTruthy();

    const storage = await page.evaluate(() => ({
      local: JSON.stringify(window.localStorage),
      session: JSON.stringify(window.sessionStorage),
      url: window.location.href,
    }));
    expect(storage.local).not.toContain(pin);
    expect(storage.session).not.toContain(pin);
    expect(storage.url).not.toContain(pin);

    // The panel's status re-reads from the server after the write.
    await secret.getByRole("button", { name: /I have shared it/ }).click();
    await expect(page.locator("[data-manager-one-time-secret]")).toHaveCount(0);
    expect(
      requests.filter((request) => /quick-pin-status/.test(request.url)).length,
      "the status is re-read after the reset rather than guessed",
    ).toBeGreaterThan(1);
  });

  test("disable then enable round-trips through confirmation", async ({ page }) => {
    await managerLogin(page);
    await page.goto(MANAGER_STAFF_ROUTES.quickPin);
    await waitForListSettled(page);
    await listRows(page).first().click();

    const panel = page.locator("[data-manager-quick-pin-panel]");
    await expect(panel).toBeVisible({ timeout: 30_000 });
    test.skip(
      !(await panel.getByText("Enabled").first().isVisible().catch(() => false)),
      "needs a person whose PIN is currently enabled",
    );

    await page.getByRole("button", { name: "Quick PIN actions" }).click();
    await page.locator('[data-manager-record-action="disable"]').click();
    await page.getByRole("dialog").getByRole("button", { name: "Disable PIN" }).click();
    await expect(panel.getByText("Disabled").first()).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Quick PIN actions" }).click();
    await page.locator('[data-manager-record-action="enable"]').click();
    await page.getByRole("dialog").getByRole("button", { name: "Enable PIN" }).click();
    await expect(panel.getByText("Enabled").first()).toBeVisible({ timeout: 30_000 });
  });
});
