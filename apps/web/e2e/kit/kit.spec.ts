import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

/**
 * U0 — the kit gallery (/kit). Needs a web build with NEXT_PUBLIC_KIT_GALLERY=1;
 * no API, no database. Run:
 *   PW_BASE_URL=http://localhost:3197 npx playwright test e2e/kit --project=vp-1440x900
 * The viewport is set per describe, so one project is enough.
 *
 * Sizes are read as layout px (offsetWidth/offsetHeight), which the gallery's
 * scale-to-fit transform does not change. Proof screenshots and the measured
 * numbers go to reports/proof/U0/.
 */
const REPO = join(__dirname, "..", "..", "..", "..");
const PROOF = join(REPO, "reports", "proof", "U0");
mkdirSync(PROOF, { recursive: true });

type Box = { w: number; h: number; radius: number };

async function open(page: Page, query = "") {
  await page.goto(`/kit${query}`);
  await page.waitForSelector('[data-kit-ready="yes"]');
}

/** The first element child of [data-m=<name>]: the kit piece itself. */
async function piece(page: Page, name: string): Promise<Box> {
  return page.evaluate((m) => {
    const holder = document.querySelector(`[data-m="${m}"]`);
    const el = holder?.firstElementChild as HTMLElement | null;
    if (!el) throw new Error(`no specimen ${m}`);
    return { w: el.offsetWidth, h: el.offsetHeight, radius: parseFloat(getComputedStyle(el).borderTopLeftRadius) };
  }, name);
}

/** The four page-wide rules: no sideways scroll, no clipped text, no target under 44, no text under 12. */
async function pageRules(page: Page) {
  return page.evaluate(() => {
    const out = { sideways: 0, clipped: [] as string[], small: [] as string[], tinyText: [] as string[], checkedText: 0, checkedTargets: 0 };
    out.sideways = document.documentElement.scrollWidth - window.innerWidth;
    const visible = (el: Element) => {
      const cs = getComputedStyle(el);
      return cs.display !== "none" && cs.visibility !== "hidden" && (el as HTMLElement).offsetParent !== null;
    };
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
      if (!visible(el)) continue;
      const ownText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== "");
      if (ownText) {
        out.checkedText += 1;
        if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) out.clipped.push(`${el.tagName} "${el.textContent?.trim().slice(0, 40)}" ${el.scrollWidth}>${el.clientWidth}`);
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 12) out.tinyText.push(`${el.tagName} "${el.textContent?.trim().slice(0, 40)}" ${fs}px`);
      }
    }
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("button, a, input, [role=tab]"))) {
      if (!visible(el)) continue;
      out.checkedTargets += 1;
      // Content taller than its control (a word wrapped over the next line) counts as clipped too.
      if (el.tagName !== "INPUT" && el.scrollHeight > el.clientHeight + 1) out.clipped.push(`${el.tagName} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}" taller ${el.scrollHeight}>${el.clientHeight}`);
      if (el.offsetWidth < 44 || el.offsetHeight < 44) out.small.push(`${el.tagName} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}" ${el.offsetWidth}x${el.offsetHeight}`);
    }
    return out;
  });
}

function expectRules(r: Awaited<ReturnType<typeof pageRules>>) {
  expect(r.checkedText, "text elements checked").toBeGreaterThan(200);
  expect(r.checkedTargets, "targets checked").toBeGreaterThan(100);
  expect(r.sideways, "sideways overflow px").toBeLessThanOrEqual(0);
  expect(r.clipped, "clipped text").toEqual([]);
  expect(r.small, "targets under 44 px").toEqual([]);
  expect(r.tinyText, "text under 12 px").toEqual([]);
}

test.describe("kit at 1280 × 800", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("sizes match the drawings", async ({ page }) => {
    await open(page);
    const measured: Record<string, unknown> = {};

    // Terminal bottom bar: 76 high, sections 56 high and equal, 4 and 5 sections, at 1024, 1280, 1920.
    const bars = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('[data-kit-bar="terminal"]')).map((holder) => {
        const nav = holder.firstElementChild as HTMLElement;
        const links = Array.from(nav.querySelectorAll<HTMLElement>("a"));
        return {
          width: Number(holder.dataset.kitBarWidth),
          sections: links.length,
          navW: nav.offsetWidth,
          h: nav.offsetHeight,
          sectionH: links.map((a) => a.offsetHeight),
          sectionW: links.map((a) => a.getBoundingClientRect().width),
        };
      }),
    );
    expect(bars.length).toBe(15);
    for (const w of [1024, 1280, 1920]) {
      for (const n of [4, 5]) expect(bars.some((b) => b.width === w && b.sections === n), `bar ${w} with ${n}`).toBe(true);
    }
    for (const b of bars) {
      expect(b.navW).toBe(b.width);
      expect(b.h).toBe(76);
      for (const h of b.sectionH) expect(h).toBe(56);
      expect(Math.max(...b.sectionW) - Math.min(...b.sectionW)).toBeLessThan(0.5);
    }
    measured.bottomBars = bars.map((b) => ({ frame: b.width, sections: b.sections, bar: b.h, sectionH: b.sectionH[0], sectionsEqual: true }));

    const phone = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('[data-kit-bar="phone"]')).map((holder) => {
        const nav = holder.firstElementChild as HTMLElement;
        return { w: nav.offsetWidth, h: nav.offsetHeight, sectionH: Array.from(nav.querySelectorAll<HTMLElement>("a")).map((a) => a.offsetHeight) };
      }),
    );
    expect(phone.length).toBe(4);
    for (const p of phone) {
      expect(p.w).toBe(390);
      expect(p.h).toBe(84);
      for (const h of p.sectionH) expect(h).toBe(56);
    }
    measured.phoneBars = phone;

    const want: [string, (b: Box) => void][] = [
      ["touch-header", (b) => expect(b.h).toBe(64)],
      ["order-header", (b) => expect(b.h).toBe(60)],
      ["tile-roomy", (b) => { expect(b.h).toBe(108); expect(b.radius).toBe(16); }],
      ["tile-compact", (b) => { expect(b.h).toBe(84); expect(b.radius).toBe(14); }],
      ["button-touch-filled-idle", (b) => { expect(b.h).toBe(52); expect(b.radius).toBe(14); }],
      ["button-laptop-filled-idle", (b) => { expect(b.h).toBe(44); expect(b.radius).toBe(14); }],
      ["chip-idle", (b) => expect(b.h).toBe(44)],
      ["option-48", (b) => expect(b.h).toBe(48)],
      ["option-64", (b) => expect(b.h).toBe(64)],
      ["option-96", (b) => expect(b.h).toBe(96)],
      ["item", (b) => expect(b.h).toBe(96)],
      ["order-line", (b) => expect(b.h).toBeGreaterThanOrEqual(52)],
      ["round-48-idle", (b) => { expect(b.h).toBe(48); expect(b.w).toBe(48); }],
      ["round-44-idle", (b) => { expect(b.h).toBe(44); expect(b.w).toBe(44); }],
      ["square-idle", (b) => { expect(b.h).toBe(52); expect(b.w).toBe(52); }],
      ["key", (b) => expect(b.h).toBe(100)],
      ["card", (b) => expect(b.radius).toBe(20)],
      ["pill-green", (b) => expect(b.h).toBe(24)],
      ["action-tile", (b) => expect(b.h).toBe(72)],
    ];
    for (const [name, check] of want) {
      const b = await piece(page, name);
      measured[name] = b;
      check(b);
    }

    // Segmented: each choice 44 high.
    const seg = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('[data-m="seg"] [role=tab]')).map((b) => b.offsetHeight),
    );
    expect(seg.length).toBe(2);
    for (const h of seg) expect(h).toBe(44);
    measured.segmentedButton = seg;

    // Measure buttons: 48 high and at least 76 wide.
    const measures = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('[data-m="measure-row"] button')).map((b) => ({ w: b.offsetWidth, h: b.offsetHeight })),
    );
    expect(measures.length).toBe(3);
    for (const m of measures) {
      expect(m.h).toBe(48);
      expect(m.w).toBeGreaterThanOrEqual(76);
    }
    measured.measureButtons = measures;

    writeFileSync(join(PROOF, "measured-1280.json"), JSON.stringify(measured, null, 2));
  });

  test("page rules hold at 1280 × 800", async ({ page }) => {
    await open(page);
    const r = await pageRules(page);
    writeFileSync(join(PROOF, "rules-1280.json"), JSON.stringify(r, null, 2));
    expectRules(r);
    await page.screenshot({ path: join(PROOF, "kit-1280-top.png") });
  });

  test("roomy wall: 32 tiles fit 1280 × 800 with no scrolling", async ({ page }) => {
    await open(page, "?only=wall-roomy");
    const fit = await wallFit(page, "roomy");
    expect(fit.tiles).toBe(32);
    expect(fit.columns).toBe(8);
    expect(fit.scrollW).toBeLessThanOrEqual(1280);
    expect(fit.scrollH).toBeLessThanOrEqual(800);
    expect(fit.lastTileBottom).toBeLessThanOrEqual(fit.barTop);
    expect(fit.tileH).toBe(108);
    writeFileSync(join(PROOF, "wall-roomy.json"), JSON.stringify(fit, null, 2));
    await page.screenshot({ path: join(PROOF, "wall-roomy-1280x800.png") });
    await sideBySide(page, "wall-roomy-1280x800.png", "Main.png", 1280, 800, "compare-wall-roomy-vs-Main.png");
  });
});

async function wallFit(page: Page, density: "roomy" | "compact") {
  return page.evaluate((d) => {
    const grid = document.querySelector<HTMLElement>(`[data-kit-wall-grid="${d}"]`)!;
    const tiles = Array.from(grid.children) as HTMLElement[];
    const bar = document.querySelector<HTMLElement>('nav[aria-label="Main"]')!;
    const cols = new Set(tiles.map((t) => Math.round(t.getBoundingClientRect().left))).size;
    return {
      tiles: tiles.length,
      columns: cols,
      tileH: tiles[0].offsetHeight,
      scrollW: document.documentElement.scrollWidth,
      scrollH: document.documentElement.scrollHeight,
      lastTileBottom: Math.max(...tiles.map((t) => t.getBoundingClientRect().bottom)),
      barTop: bar.getBoundingClientRect().top,
      barH: bar.offsetHeight,
    };
  }, density);
}

/** Our screenshot beside the approved drawing, one image, for the report. */
async function sideBySide(page: Page, ours: string, drawing: string, w: number, h: number, out: string) {
  const a = readFileSync(join(PROOF, ours)).toString("base64");
  const b = readFileSync(join(REPO, "design", "screens", "png", drawing)).toString("base64");
  await page.setViewportSize({ width: w * 2 + 72, height: h + 72 });
  await page.setContent(
    `<body style="margin:0;background:#ddd;font:16px sans-serif;display:flex;gap:24px;padding:12px 24px">
      <figure style="margin:0"><figcaption>Built · /kit?only=…</figcaption><img src="data:image/png;base64,${a}" width="${w}" height="${h}"></figure>
      <figure style="margin:0"><figcaption>Drawing · design/screens/png/${drawing}</figcaption><img src="data:image/png;base64,${b}" width="${w}" height="${h}"></figure>
    </body>`,
  );
  await page.screenshot({ path: join(PROOF, out) });
}

test.describe("compact wall at 1024 × 768", () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test("35 compact tiles fit 1024 × 768 with no scrolling", async ({ page }) => {
    await open(page, "?only=wall-compact");
    const fit = await wallFit(page, "compact");
    expect(fit.tiles).toBe(35);
    expect(fit.columns).toBe(7);
    expect(fit.scrollW).toBeLessThanOrEqual(1024);
    expect(fit.scrollH).toBeLessThanOrEqual(768);
    expect(fit.lastTileBottom).toBeLessThanOrEqual(fit.barTop);
    expect(fit.tileH).toBe(84);
    writeFileSync(join(PROOF, "wall-compact.json"), JSON.stringify(fit, null, 2));
    await page.screenshot({ path: join(PROOF, "wall-compact-1024x768.png") });
    await sideBySide(page, "wall-compact-1024x768.png", "Floor-1024.png", 1024, 768, "compare-wall-compact-vs-Floor-1024.png");
  });
});

test.describe("kit at 390 × 844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("page rules and phone sizes hold at 390 × 844", async ({ page }) => {
    await open(page);
    const r = await pageRules(page);
    writeFileSync(join(PROOF, "rules-390.json"), JSON.stringify(r, null, 2));
    expectRules(r);
    const phone = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('[data-kit-bar="phone"]')).map((holder) => {
        const nav = holder.firstElementChild as HTMLElement;
        return { h: nav.offsetHeight, sectionH: Array.from(nav.querySelectorAll<HTMLElement>("a")).map((a) => a.offsetHeight) };
      }),
    );
    for (const p of phone) {
      expect(p.h).toBe(84);
      for (const h of p.sectionH) expect(h).toBe(56);
    }
    for (const [name, h] of [["tile-compact", 84], ["button-touch-filled-idle", 52], ["chip-idle", 44], ["item", 96]] as const) {
      expect((await piece(page, name)).h).toBe(h);
    }
    await page.screenshot({ path: join(PROOF, "kit-390-top.png") });
    for (const id of ["tabbars", "sheets", "tiles"]) {
      await page.locator(`#${id}`).screenshot({ path: join(PROOF, `kit-390-${id}.png`) });
    }
  });
});
