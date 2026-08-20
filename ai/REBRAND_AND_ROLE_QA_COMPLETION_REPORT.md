# Completion Report — Rebrand + Role UI QA Wave (2026-08-20)

> Canonical record for the **Aug-2026 brand rebrand landing** plus the **Waiter /
> Cashier / Supervisor live UI QA passes**. Frontend + documentation only.
> **No backend, schema, migration, seed, permission, or Postman change. No commit
> or push.** Cashier **C3** and **Manager reconstruction** remain gated.

## Context Snapshot

- Current milestone: **Rebrand + role UI QA wave — COMPLETE (2026-08-20).** The
  Aug-2026 Nimbus POS Brand Identity (designer **Andimashimwe Rhoda**) is fully
  landed in `apps/web`, and the Waiter, Cashier (within the C2 boundary), and
  Supervisor experiences have each had a full live browser QA pass at 1440×900 and
  1024×768 with canonical API matrices written or corrected.
- Previous completed milestone: **Cashier Floor-First reconstruction Prompt C2 —
  A: C2 COMPLETE / READY FOR C3 (2026-07-31)**; Supervisor Reconstruction final
  closure at **B: COMPLETE WITH KNOWN LIMITATIONS / DEMO-READY (2026-07-31)**.
- Next milestone: **Cashier Floor-First reconstruction Prompt C3 (payment/close
  execution) — NOT started, pending explicit authorization.** Manager
  reconstruction stays blocked until Cashier C6 and until the owner decisions in
  `Front End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_APPROVAL_DECISIONS.md`
  are made (all still pending).

## Summary

- **What was built:**
  1. The Aug-2026 brand identity landed end-to-end in the web app — canonical
     palette tokens, a new **alpha-channel token system**, true-vector
     steering-wheel logo assets extracted from the brand PDF, a shared
     `NimbusLogomark` component mounted in the operational header and the login
     hero, PWA/social metadata, and a new canonical `docs/BRAND_IDENTITY.md`.
  2. A set of **accessibility and consistency fixes** in shared components,
     verified in all three roles at two viewports.
  3. Three **role QA passes** (Waiter, Cashier, Supervisor) executed against a live
     local stack, each closing out with canonical API matrices and lifecycle docs.
- **What is now working:**
  - Every `token/alpha` Tailwind utility (all modal scrims) actually renders —
    this fixed a pre-existing app-wide defect where such utilities silently
    rendered fully transparent.
  - Focus rings are visible on navy surfaces (header/bottom nav) for the first
    time; the header logout control and disabled buttons now meet AA contrast.
  - Waiter has canonical docs and an API matrix for the first time; Cashier has a
    canonical API matrix; the Supervisor API matrix quick-pin path defect is fixed
    and `docs/UI_SYSTEM.md` §9 no longer contradicts the code on idle logout.

## Files Added / Changed

### Brand tokens + configuration (code)

- `apps/web/src/styles/globals.css` — **modified.** Canonical palette:
  `--color-brand-navy-950 #000024`, `--color-brand-navy-900 #000033` (canonical
  navy, RGB `0 0 51`), `--color-brand-navy-800 #1E1E52`,
  `--color-brand-silver #B3B4AF` (brand *Light Grey*),
  `--color-brand-graphite #6B6B6B` (brand *Dark Grey* — **sampled from the guide's
  swatch; the guide's printed hex is a typo**, documented in
  `docs/BRAND_IDENTITY.md`). `--color-surface-navy` and `--color-focus-ring` now
  both resolve to `var(--color-brand-navy-900)`; shadows and `::selection` follow
  `--color-brand-navy-rgb`. **New alpha-channel triplets:**
  `--color-brand-navy-950-ch`, `--color-brand-white-ch`, and
  `--color-status-{success,warning,danger,info}-ch`. **New**
  `--shadow-focus-inverse` (`rgb(var(--color-brand-white-ch) / 0.72)`).
- `apps/web/tailwind.config.ts` — **modified.** `rgb(var(…) / <alpha-value>)`
  mappings for the channel triplets, plus the `focus-inverse` shadow token.

### Brand assets (new — `apps/web/public/brand/`, 20 files)

Steering-wheel logomark and lockups extracted as **true vectors** from the brand
PDF (not raster traces):

- `logomark.svg`, `logomark-white.svg`
- `wordmark.svg`, `wordmark-white.svg`, `wordmark-stacked.svg`,
  `wordmark-stacked-white.svg`
- `combination-mark.svg`, `combination-mark-white.svg`,
  `combination-mark-stacked.svg`, `combination-mark-stacked-white.svg`
- `favicon.svg`, `favicon-16.png`, `favicon-32.png`, `favicon-48.png`
- `apple-touch-icon.png` (180×180), `icon-192.png`, `icon-512.png`,
  `icon-512-maskable.png`
- `og-image.png` (1200×630)
- `manifest.webmanifest`

Also: `apps/web/public/favicon.svg` — **replaced** with the new mark.

### Brand components + mounts (code)

- `apps/web/src/components/pos-shell/NimbusLogomark.tsx` — **new.** The Nimbus
  steering-wheel brand mark as an inline SVG React component using
  `currentColor`. **Deliberately NOT part of the canonical icon registry** — it is
  a brand mark, not a UI icon (see §13 of `CLAUDE.md` / `CODEX.md`).
- `apps/web/src/components/pos-shell/BranchContextLabel.tsx` — **modified.**
  Renders `NimbusLogomark` in a 44px header brand tile.
- `apps/web/src/pages/login.tsx` — **modified.** 56px hero brand tile rendering
  `NimbusLogomark`, replacing the previous generic `LockKey` glyph.
- `apps/web/src/pages/_app.tsx` — **modified.** `theme-color #000033`, web
  manifest link, apple-touch-icon link, Open Graph image/meta, updated
  description.

### Accessibility / consistency fixes (shared components, code)

- `apps/web/src/components/ui/Button.tsx` — **modified.** New **`inverse`**
  variant (for navy surfaces) + `disabled:text-text-primary`; disabled-state
  contrast **3.62:1 → 8.51:1**. The `inverse` variant consumes the new
  `focus-inverse` shadow token.
- `apps/web/src/components/pos-shell/OperationalHeader.tsx` — **modified.** Logout
  control switched to the `inverse` variant: contrast **2.71:1 → 20.48:1**, and
  its previously off-palette hover is now `navy-800`.
- `apps/web/src/components/pos-shell/OperationalBottomNav.tsx` — **modified.**
  Wired to `--shadow-focus-inverse`; the focus ring was previously navy-on-navy
  (effectively invisible on the header/nav surfaces).
- `apps/web/src/components/pos-shell/ActionConfirmDialog.tsx`,
  `apps/web/src/components/cashier/floor/CashierFindBillDialog.tsx`,
  `apps/web/src/components/supervisor/floor/SupervisorFindOrderDialog.tsx`,
  `apps/web/src/components/supervisor/reservations/SupervisorCreateReservationDialog.tsx`
  — **modified.** Scrims moved from `bg-black/40` to `bg-brand-navy-950/40` (which
  only became functional once the alpha-channel tokens existed).
- `apps/web/src/components/cashier/checkout/CashierPaymentMethodSelector.tsx` —
  **modified.** Fixed a selected-tile class conflict that rendered the selected
  method label at **1.18:1** (effectively invisible) on the legacy queue route.
- `apps/web/src/components/cashier/queue/CashierCheckoutPreview.tsx` —
  **modified.** `text-white` → `text-text-inverse`.

### Documentation (new)

- `docs/BRAND_IDENTITY.md` — **new canonical brand document.** Palette (with the
  graphite-typo note), logo system and clear-space rules, typography, and the full
  asset inventory. Supersedes every pre-Aug-2026 palette table in the `Front End/`
  doc packs.
- `docs/waiter-ui-docs/README.md`, `docs/waiter-ui-docs/WAITER_API_MATRIX.md`,
  `docs/waiter-ui-docs/WAITER_LIFECYCLE.md` — **new canonical Waiter docs
  directory.** Waiter previously had **no canonical docs directory at all** and
  **no API matrix anywhere** in the repo.
- `docs/cashier-ui-docs/CASHIER_API_MATRIX.md` — **new canonical Cashier API
  matrix** (32 endpoints, 19 live-verified). Supersedes the legacy pack matrix in
  `Front End/cashier_ui_docs_pack/docs/cashier-ui-docs/CASHIER_API_MATRIX.md`.
- `ai/REBRAND_AND_ROLE_QA_COMPLETION_REPORT.md` — **this file.**

### Documentation (updated / annotated)

- `docs/DOCUMENT_INDEX.md` — brand-palette provenance section; new rows for
  `docs/BRAND_IDENTITY.md`, the Waiter docs directory, and the Cashier API matrix;
  supersession/rebrand annotations across the affected packs.
- `docs/UI_SYSTEM.md` — rebranded token tables; **§9 idle-logout claims
  corrected** (the doc said Supervisor did not inject the shared idle handler; the
  code shows it **does** — code wins).
- `docs/supervisor-ui-docs/*` (7 docs) — dated rebrand/verification annotations.
  **`SUPERVISOR_API_MATRIX.md`** live-verified: **68 rows = 24 live + 3 probes +
  41 static**, and its **quick-pin path defect fixed** (the real route is
  `auth/quick-pin-login`).
- `docs/cashier-ui-docs/README.md`, `docs/REPOSITORY_MAP.md`, `PRODUCT.md`,
  `AGENTS.md`, `README.md`, `apps/web/README.md` — rebrand notes / index updates.
- `Front End/**` design packs — live packs rebranded in place; historical packs
  given supersession banners (bodies untouched).
- `PROGRESS.md`, `ai/AI_STATUS.md`, `CLAUDE.md`, `CODEX.md`, `repo file tree.txt`
  — updated by this closeout pass.

## Database

- Prisma models added/changed: **none.**
- Migration name: **none — no migration was created, applied, or deployed.**
- Indexes / constraints: **none.**
- Seed updates: **none.**
- Notes: the **only** change under `packages/db/` is a single generator line in
  `packages/db/prisma/schema.prisma` —
  `previewFeatures = ["driverAdapters"]` — required by the **local WASM-Prisma QA
  harness** to run the API against a Docker-free local Postgres. It adds no model,
  field, enum, index, or migration and changes no persisted data shape. It is a
  **QA-harness artifact, not a product schema change**, it lives only in the
  cloud QA workspace, and it was **deliberately NOT synced to the canonical
  repository** — the canonical `schema.prisma` is untouched.

## API

- Modules added/changed: **none.**
- Endpoints added/updated: **none.**
- Guards applied: **none changed.** No permission, role mapping, or RBAC row was
  added, removed, or altered.
- Audit coverage: **unchanged.**
- Idempotency coverage: **unchanged.**

## Tests

- Unit tests: none added (the web package still has no automated unit-test
  harness; its `test` script remains a stub).
- e2e tests: no new spec files were committed for this wave. QA was executed as a
  **Playwright-driven live visual/functional pass** over the existing harness.
- Commands run (final run **2026-08-20**):
  - `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck`
  - `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint`
  - `corepack pnpm@8.15.0 --filter @nimbus-pos/web build`
  - `git diff --check`
- Results: **typecheck PASS · lint PASS · production build PASS.**
  `git diff --check` **clean except pre-existing markdown whitespace warnings**
  (not introduced by this wave).

### Live QA environment

- **Isolated local QA stack, Docker-free:** local **Postgres 16** + a
  **WASM-Prisma harness** driving the API, API on **:3001**, web dev server on
  **:3000**.
- **Shared Neon was never touched.** No destructive QA was run against shared
  Neon at any point in this wave.
- **Harness caveat (important):** the WASM-Prisma adapter path is a QA convenience,
  not the product's runtime. Two apparent "500 defects" observed early in the pass
  — `GET` receipts and the add-item `POST` — were traced to a **Decimal class
  identity mismatch inside the WASM-Prisma harness**, not to product code. The
  harness was fixed and both endpoints **re-verified 200 / 201**. **These were
  never product bugs and must not be recorded as such.**
- **Evidence:** Playwright-driven visual QA produced **~180 screenshots** across
  the three roles at **1440×900** and **1024×768**.

### Per-role QA outcomes

- **WAITER — complete.** All surfaces visually QA'd on the live stack at both
  viewports: floor, workspace/order builder, reservations, me, receipt drawer,
  login. Functional flows confirmed; **zero console errors**. **37 endpoints
  verified** (20 GETs + 11 writes exercised live; the remainder statically
  verified). New canonical `docs/waiter-ui-docs/*`.
- **CASHIER — complete within the C2 boundary.** All surfaces QA'd live including
  **zero / one / multiple** bill resolution (**fail-closed confirmed**, **bounded
  queries confirmed**, **URL state confirmed**), Till, Me, and the hidden
  Queue/Receipts compatibility routes (confirmed still rendering). **C3 was NOT
  started and nothing gated behind C3 was implemented** — no payment, split,
  close, receipt, or refund execution exists. New canonical
  `docs/cashier-ui-docs/CASHIER_API_MATRIX.md` (32 endpoints, **19 live-verified**)
  + README update; the legacy pack matrix is superseded.
- **SUPERVISOR — complete.** All surfaces QA'd live: floor (action dialogs opened
  and cancelled), reservations (all 4 views + create), approvals (all 4 domains
  including the reject-only shift-swap path), me. The reservations **one bounded
  query** design was confirmed in flight; the legacy `/supervisor/orders` redirect
  was confirmed. `SUPERVISOR_API_MATRIX.md` live-verified (**68 rows: 24 live + 3
  probes + 41 static**) with its quick-pin path defect fixed; **7 supervisor docs
  annotated**.

## Postman

- Collection added/updated: **none.**
- Variables/tests added: **none.**
- Manual checklist executed: **n/a — no API contract changed, so no collection
  required editing.** All 56 collections are untouched by this wave.

## Docs

- ROADMAP status impact: **none.** No milestone number opened, closed, or
  renumbered. This wave is a frontend brand + QA wave layered on the existing
  Cashier C2 / Supervisor-closed state.
- Files updated: see **Files Added / Changed** above. Canonical closeout targets:
  `PROGRESS.md`, `ai/AI_STATUS.md`, `CLAUDE.md` §1/§6/§10/§13, `CODEX.md`,
  `repo file tree.txt`, and this report.

## DONE Checks

- `pnpm lint` → **PASS** (`@nimbus-pos/web` lint, no warnings or errors).
- `pnpm typecheck` → **PASS** (`tsc --noEmit`).
- `pnpm build` → **PASS** (`next build`, production build, final run 2026-08-20).
- `pnpm test` → **n/a** (web `test` script is still a stub; no web unit harness).
- `pnpm db:migrate` → **NOT RUN — deliberately.** No migration exists in this wave.
- `pnpm db:seed` → **NOT RUN — deliberately.** No seed change in this wave.
- `git diff --check` → **clean**, except pre-existing markdown whitespace warnings.
- Local run: isolated Postgres 16 + WASM-Prisma harness + API `:3001` + web `:3000`;
  Playwright-driven visual QA, ~180 screenshots, 1440×900 and 1024×768.

## Decisions / Deviations

- **Graphite hex is sampled, not printed.** `--color-brand-graphite` is `#6B6B6B`,
  sampled from the brand guide's Dark Grey swatch. The guide's *printed* hex for
  that swatch is a typo and was deliberately not used. Recorded in
  `docs/BRAND_IDENTITY.md`.
- **`NimbusLogomark` is exempt from the canonical icon registry.** It is a brand
  mark, not a UI icon, so it does not live in `pos-shell/role-icon-config.ts` /
  `role-icons.ts`. This is the single documented exception to §13's registry rule
  and must not be generalised into a licence to import glyphs directly.
- **Status tokens were deliberately left unchanged by the rebrand.** The rebrand
  moved the brand navy/grey family only; `--color-status-*` values were not
  restyled. Their contrast consequences are recorded as an **open finding (b)**
  for the owner rather than fixed unilaterally.
- **The alpha-token system was a defect fix, not a feature.** Before it, every
  `token/alpha` utility (e.g. `bg-brand-navy-950/40`) resolved to full
  transparency — so every modal scrim in the app was invisible. This was a
  **pre-existing app-wide defect** surfaced by the rebrand, not caused by it.
- **`docs/UI_SYSTEM.md` §9 was corrected against the code, not the reverse.** The
  code shows Supervisor **does** inject the shared idle handler.
- **No commit and no push occurred.** The dirty worktree remains the source of
  truth, per the standing governance rule.

## Known Issues

Open findings recorded for the owner. **None of these were implemented — they are
recorded decisions/defects awaiting owner direction.**

- **(a) Cashier cold-start till deadlock.** The Cashier UI has **no shift-open
  control**, while `tills.service` requires an actor-owned **active shift** — so a
  cold-start cashier cannot open a till unaided. Compounding it, `/shifts/active`
  and `/tills/active` key on **different fields**, producing contradictory
  readiness chips. Documented as **M1** in
  `docs/cashier-ui-docs/CASHIER_API_MATRIX.md`.
- **(b) Status-token contrast.** `status-warning` on a warning surface measures
  **2.37:1** (below AA); `status-success` **3.94:1** and `status-danger` **3.83:1**
  are also short of 4.5:1. Status tokens were deliberately not changed by the
  rebrand — **owner decision pending.**
- **(c) Off-brand role accents.** Six `--color-role-*` oklch accents (the
  teal/brown/blue profile heroes) read off-brand against the new navy — **owner
  decision pending.**
- **(d) Neutral/graphite decoupling.** `--color-status-neutral #616367` is now
  decoupled from `--color-brand-graphite #6B6B6B`; they are no longer the same
  grey.
- **(e) Untruthful zero-bill copy.** The zero-bill "closed bills" list reuses
  `CashierBillSelector` copy ("N payable bills are open") — untruthful for a list
  of *closed* bills. **Fix belongs in C3/C4**, not here.
- **(f) Internal jargon leak.** The Supervisor discount dialog placeholder leaks
  internal jargon: "Prompt 3B3A discount validation".
- **(g) Toolbar wrap at 1024×768.** The `OperationalFloor` toolbar wraps awkwardly
  at 1024×768 — a layout issue affecting **all roles** (shared component).
- **(h) Missing waiter Quick PIN.** No waiter Quick PIN is seeded for
  `waiter@nimbus.demo`, although the docs advertise **246810**.
- **(i) Inter webfont not bundled.** The app still falls back to system fonts;
  the brand's Inter webfont is not bundled.

**Not a defect (recorded to prevent re-litigation):** the two "500 defects" first
seen on receipts `GET` and add-item `POST` were **QA-harness artifacts** (WASM
Prisma Decimal class identity), fixed in the harness and re-verified **200/201**.

## Next Step

- **Cashier Floor-First reconstruction Prompt C3 (payment/close execution) —
  pending explicit owner authorization.** Do not implement payment collection,
  partial/split execution, order close, receipt print/reprint/deliver, or refund
  execution; do not delete or redirect Queue/Receipts; do not fork the shared
  Floor for Cashier; do not change any Cashier permission — without that
  authorization. Findings **(a)** and **(e)** are natural C3/C4 inputs.
- **Manager reconstruction — still NOT STARTED and gated.** It stays blocked until
  Cashier C6 closes, and the owner decisions in
  `Front End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_APPROVAL_DECISIONS.md`
  are **all still pending**.
- **Owner decisions requested:** findings **(b)** status-token contrast and
  **(c)** role accent palette. Both are deliberate non-changes, not oversights.
