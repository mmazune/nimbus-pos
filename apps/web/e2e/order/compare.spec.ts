/**
 * Done-when 7: each drawing beside the built screen, as one image per pair in
 * reports/proof/T3/compare-<Drawing>.png. Runs only with T3_COMPARE=1, after the
 * other T3 specs have written their screenshots.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { test } from "@playwright/test";

const ROOT = join(__dirname, "../../../..");
const PROOF = join(ROOT, "reports/proof/T3");
const DRAWN = join(ROOT, "design/screens/png");

const PAIRS: Array<[string, string[]]> = [
  ["Order-Empty", ["built-Order-Empty-1280x800.png"]],
  ["Order-Terminal", ["built-Order-Terminal-1280x800.png"]],
  ["Order-Other", ["built-Order-Other-1280x800.png"]],
  ["Order-Laptop", ["built-Order-Laptop-1440x900.png"]],
  ["Order-Phone", ["built-Order-Phone-390x844.png"]],
  ["Order-Phone-Check", ["built-Order-Phone-Check-390x844.png"]],
  ["Order-Phone-Item", ["built-Order-Phone-Item-390x844.png"]],
  ["Supervisor-Table", ["evening-1-2-supervisor-table-actions.png"]],
  ["Supervisor-Void", ["evening-1-3-supervisor-void.png"]],
  ["Cashier-Pay", ["evening-1-4-cashier-pay-before.png", "evening-1-5-cashier-paid.png"]],
  ["Table-Life", ["built-Order-Empty-1280x800.png", "built-Order-Terminal-1280x800.png", "built-Order-Other-1280x800.png", "evening-1-4-cashier-pay-before.png"]],
];

const uri = (p: string) => `data:image/png;base64,${readFileSync(p).toString("base64")}`;

test.skip(!process.env.T3_COMPARE, "set T3_COMPARE=1 to compose the drawing-beside-build images");

for (const [drawing, built] of PAIRS) {
  test(`compare ${drawing}`, async ({ page }) => {
    const files = built.map((b) => join(PROOF, b)).filter(existsSync);
    const phone = drawing.includes("Phone");
    const width = phone ? 1000 : 2900;
    await page.setViewportSize({ width, height: 1200 });
    await page.setContent(`<!doctype html><html><body style="margin:0;font:600 22px Inter,system-ui,sans-serif;background:#F2F3F7">
      <div style="display:flex;gap:24px;padding:24px;align-items:flex-start">
        <figure style="margin:0;flex:1"><figcaption style="padding:0 0 8px">Drawing · ${drawing}</figcaption>
          <img src="${uri(join(DRAWN, `${drawing}.png`))}" style="width:100%;border:1px solid #ccc"></figure>
        <figure style="margin:0;flex:1"><figcaption style="padding:0 0 8px">Built · ${built.join(" + ")}</figcaption>
          <div style="display:grid;grid-template-columns:${files.length > 1 ? "1fr 1fr" : "1fr"};gap:12px">
            ${files.map((f) => `<img src="${uri(f)}" style="width:100%;border:1px solid #ccc">`).join("")}
          </div></figure>
      </div></body></html>`);
    await page.waitForTimeout(200);
    await page.screenshot({ path: join(PROOF, `compare-${drawing}.png`), fullPage: true });
  });
}
