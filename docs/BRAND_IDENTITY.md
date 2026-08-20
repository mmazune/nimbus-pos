# BRAND_IDENTITY.md — Nimbus POS brand identity

> Canonical brand reference for Nimbus POS. Source: **"Nimbus POS Brand
> Presentation — Initial Brand Identity"**, designer **Andimashimwe Rhoda**,
> August 2026. Supersedes the pre-Aug-2026 "visual reference image" palette used
> by the Front End doc packs.
> Companion to `docs/UI_SYSTEM.md` (component system), `PRODUCT.md` (product
> thesis/tone), and `Front End/waiter-ui-docs/waiter-ui-docs/DESIGN.md` (global
> design system, which consumes the values below).
> Last compiled: 2026-08-20.

---

## 1. Brand strategy summary

### Our goal

The goal of the Nimbus POS brand identity is to create a solid, bold look that
connects with our audience and amplifies confidence. Every element reflects
**control, confidence, calm, and stability**.

### Why we exist

Nimbus POS unifies selling, inventory, purchasing, staff roles, and reporting in
one system, replacing fragmented tools (paper, WhatsApp, Excel, disconnected POS
apps) with a single source of truth.

### Who we serve

Restaurant, bar, cafe, quick-service, small-hotel, and stock-heavy retail shop
owners, along with branch managers, cashiers, kitchen staff, procurement and
stock teams, and accountants — from a single location to growing multi-branch
chains.

### What we stand for

Reliability, stability, operational clarity, clean auditable data, simplicity at
speed, and minimalism.

### The steering wheel (logomark rationale)

Running a business feels chaotic — orders piling up, inventory out of sync, staff
pulled in five directions, customers waiting while the system lags. Nimbus POS
exists to give owners back a sense of control over that chaos.

The brand asked: *what does "in control" physically look like?* Not an abstract
settings icon or power button, but something with emotional connection — because
where there is emotion there is connection, and where there is connection there
is trust. The answer is the **steering wheel**: the one everyday object almost
everyone has personally held while actively making decisions — left or right,
faster or slower, this direction or that.

The logomark therefore signals being **in the driver's seat of your own
business** — steering rather than being steered.

### Brand personality (consistent with `PRODUCT.md`)

Premium, calm, fast, stable, professional, legible, controlled, operational.

---

## 2. Logo system

### 2.1 Logomark — the steering wheel

- Form drawn from a steering wheel; **solid and grounded**, echoing stability and
  calm.
- Refined into a **crisp, sharp, geometric** form — a modern software mark, not a
  literal object drawing.
- **Simplified and abstracted rather than literal.**
- Built to remain legible and recognizable **at any size, from a favicon to a
  storefront sign**.

### 2.2 Wordmark

"**Nimbus POS**" — clean and solid, reflecting stability, clarity, simplicity, and
minimalism. Set in Inter (see §4). Intended to be highly legible across all
mediums, digital and print.

**Two approved wordmark variations:**

| Variation | Form | Use |
| --- | --- | --- |
| One-line | `Nimbus POS` | Default. Horizontal space available: headers, docs, wide signage, email signatures. |
| Stacked | `Nimbus` / `POS` | Constrained or square-ish space: app tiles, social avatars, vertical/narrow lockups. |

### 2.3 Combination marks

Logomark + wordmark lockups, in the same two arrangements (mark beside the
one-line wordmark; mark above/beside the stacked wordmark). Use a combination
mark where the brand is being introduced; use the logomark alone where the brand
is already established in context (favicon, in-app header tile, PWA icon).

### 2.4 Clear space and minimum size

| Rule | Value |
| --- | --- |
| Clear space | Minimum on all sides = the width of the wordmark's cap-height "N" (≈ 25% of the logomark's height). Nothing — text, rules, image edges, other marks — enters this zone. |
| Logomark minimum size | **16px** (favicon floor). The mark must stay readable at 16px; if a detail disappears at 16px it does not belong in the mark. |
| Wordmark minimum size | 72px wide (one-line) / 44px wide (stacked). Below this, use the logomark alone. |
| Combination mark minimum | 96px wide. Below this, split into logomark-only. |

### 2.5 Do not

- Do not recolor the mark outside the brand palette (§3).
- Do not rotate, skew, stretch, outline, add gradients, drop shadows, or
  glassmorphism to the mark.
- Do not place the mark on a busy photograph or a low-contrast background.
- Do not reconstruct the mark in a different typeface — the wordmark is Inter.

### 2.6 Current asset status

| Asset | Status |
| --- | --- |
| Steering-wheel logomark (vector) | **Shipped.** Extracted as a true vector from the brand PDF: `apps/web/public/brand/logomark.svg` + `logomark-white.svg` (viewBox 349.5×232.13, aspect ≈ 1.506:1). |
| In-app logomark component | **Shipped.** `apps/web/src/components/pos-shell/NimbusLogomark.tsx` — inline SVG, `currentColor`-driven, deliberately **not** in the operational icon registry. Mounted at both lockup sites: `BranchContextLabel.tsx` (44px header tile, replaced the Phosphor Storefront stand-in) and `pages/login.tsx` (56px hero tile, replaced the LockKey stand-in). |
| `apps/web/public/favicon.svg` | **Shipped.** The brand favicon (64 navy `#000033` rounded tile + white steering-wheel mark), replacing the interim "N" placeholder. Identical copy at `apps/web/public/brand/favicon.svg`. |
| `<meta name="theme-color">` | Live — `#000033` in `apps/web/src/pages/_app.tsx`. |
| `_app.tsx` head links | Live — SVG favicon + 32px PNG fallback, `apple-touch-icon`, `manifest`, `og:title`/`og:description`/`og:image`. |
| `apps/web/public/brand/` | **Exists** — full asset set shipped; inventory in §5. |

---

## 3. Color

### 3.1 Brand colors (from the brand guide)

| Name | Token | HEX | RGB | CMYK |
| --- | --- | ---: | --- | --- |
| Navy Blue *(canonical)* | `--color-brand-navy-900` | `#000033` | 0 0 51 | 94 89 43 65 |
| White | `--color-brand-white` | `#FFFFFF` | 255 255 255 | 0 0 0 0 |
| Light Grey | `--color-brand-silver` | `#B3B4AF` | 179 180 175 | 31 24 28 0 |
| Dark Grey | `--color-brand-graphite` | `#6B6B6B` | 107 107 107 | — (see note) |

Navy and white are the primary pair — they echo control, stability, and trust.
Light grey and dark grey are supporting accents that reinforce the premium,
minimal feel while keeping the look clean, calm, and controlled.

> **Dark Grey note (resolved).** The brand PDF's text layer lists **the same hex
> as Light Grey (`b3b4af`) for Dark Grey** — a duplication/typo in the deck, not a
> real value; a "dark grey" cannot equal the light grey. The resolved value is
> **`#6B6B6B`** (RGB 107 107 107), **sampled directly from the Dark Grey swatch on
> page 17 of the Brand Identity guide**; `--color-brand-graphite` in
> `apps/web/src/styles/globals.css` carries it. Do not "correct" graphite to
> `#B3B4AF`, and do not trust the guide's printed hex for Dark Grey. Note:
> `--color-status-neutral` **remains `#616367`** and is now **decoupled** from
> graphite (the two tokens used to share a value; they no longer do).

### 3.2 Derived navy ramp

The brand supplies one navy. The product needs three dark steps to keep the
dark-surface hierarchy honest (deepest header/scrim vs. primary dark vs.
hover-on-dark), so 950 and 800 are derived from the canonical 900:

| Token | HEX | Derivation | Use |
| --- | ---: | --- | --- |
| `--color-brand-navy-950` | `#000024` | Shade of canonical navy | Deepest header / sidebar / scrim. |
| `--color-brand-navy-900` | `#000033` | **Canonical brand navy** | Primary brand dark, active bottom nav, reversed/key actions, focus ring. |
| `--color-brand-navy-800` | `#1E1E52` | Tint of canonical navy | Secondary dark surface, hover on dark, header time chip. |

Derived ramp steps are **product tokens, not brand colors** — only `#000033` is
quotable as "the Nimbus navy" in brand contexts (print, signage, partner decks).

### 3.3 Derived ink

`--color-brand-navy-rgb: 0, 0, 51` is the single source for shadow and selection
ink; all `--shadow-*` tokens compose `rgba(var(--color-brand-navy-rgb), …)`.
`--color-surface-navy` and `--color-focus-ring` both reference
`var(--color-brand-navy-900)`.

### 3.4 Functional status ink (contrast pass, owner-approved 2026-08-20)

The status **ink** tokens were darkened so each one clears **WCAG 2.1 AA (4.5:1)
as text on both its own `-surface` token and plain `#FFFFFF`**, and so
white/inverse text sitting on the solid fill (e.g. `Button` `danger` variant)
clears AA too. The `-surface` tokens are **unchanged**; hue is preserved (OKLCH
hue shift < 5°), only lightness and chroma moved.

| Token | Before | After | Surface (unchanged) |
| --- | ---: | ---: | ---: |
| `--color-status-success` | `#1F8A5B` | **`#11774E`** | `--color-status-success-surface` `#EAF7F1` |
| `--color-status-warning` | `#D19822` | **`#8A6410`** | `--color-status-warning-surface` `#FFF6DF` |
| `--color-status-danger` | `#D1495B` | **`#B7384C`** | `--color-status-danger-surface` `#FDECEF` |
| `--color-status-info` | `#2F6FBA` | **`#2B69B2`** | `--color-status-info-surface` `#EAF2FF` |
| `--color-status-neutral` | `#616367` | `#616367` (unchanged) | `--color-status-neutral-surface` `#F1F2F4` |

Contrast ratios (WCAG 2.1 relative luminance):

| Token | On own surface | On `#FFFFFF` | White text **on** the solid |
| --- | ---: | ---: | ---: |
| success | 3.94 → **5.06** | 4.33 → **5.57** | 4.33 → **5.57** |
| warning | 2.37 → **4.99** | 2.55 → **5.37** | 2.55 → **5.37** |
| danger | 3.83 → **5.00** | 4.36 → **5.70** | 4.36 → **5.70** |
| info | 4.54 → **4.95** | 5.12 → **5.58** | 5.12 → **5.58** |
| neutral | 5.37 | 6.02 | 6.02 |

Before this pass **warning failed AA everywhere** (2.37:1 / 2.55:1 — the single
worst token in the system), success and danger failed on their own surfaces, and
white-on-solid failed for success, warning and danger (this is what the `Button`
`danger` variant renders). `info` technically passed at 4.54:1 but with a 0.9 %
margin; it was nudged to 4.95:1 so the four tokens share a consistent ~5:1 floor.

> **Keep the `-ch` triplets in sync.** Tailwind resolves `text-status-*` /
> `bg-status-*` through the space-separated channel triplets
> (`--color-status-*-ch`), **not** through the hex tokens above, because a bare
> hex var cannot take a Tailwind opacity modifier. Both live in
> `apps/web/src/styles/globals.css` and must be edited together:
> success `17 119 78`, warning `138 100 16`, danger `183 56 76`, info `43 105 178`.

Status colours are still **never the only signal** — every status badge, chip and
banner carries a text label and (where used) an icon.

### 3.5 Role accents (re-derived from brand navy, owner-approved 2026-08-20)

The six `--color-role-*` tokens are now **derived from the canonical brand navy**
`#000033`, which is OKLCH `L 0.145 / C 0.101 / H 264`. Supervisor sits on the
brand hue itself; waiter leans steel-blue and cashier indigo, far enough apart to
be told apart side by side but all inside one navy family. Previously the three
accents were unrelated to the brand (waiter teal H 190, cashier **orange/amber**
H 62, supervisor blue H 253) — the cashier amber in particular read as a warning
colour and as a different product.

| Token | Before | After | Renders as |
| --- | --- | --- | ---: |
| `--color-role-waiter` | `oklch(0.39 0.055 190)` | **`oklch(0.4 0.062 232)`** | `#1F4D63` steel-blue navy |
| `--color-role-waiter-soft` | `oklch(0.965 0.018 190)` | **`oklch(0.965 0.015 232)`** | `#EAF6FC` |
| `--color-role-cashier` | `oklch(0.42 0.07 62)` | **`oklch(0.365 0.062 294)`** | `#40385C` indigo navy |
| `--color-role-cashier-soft` | `oklch(0.97 0.022 72)` | **`oklch(0.965 0.015 294)`** | `#F4F2FD` |
| `--color-role-supervisor` | `oklch(0.4 0.065 253)` | **`oklch(0.325 0.085 264)`** | `#1D325F` brand navy |
| `--color-role-supervisor-soft` | `oklch(0.965 0.018 253)` | **`oklch(0.965 0.015 264)`** | `#EEF4FE` |

Contrast (the solid is used as a white-text hero panel **and** as `text-role-*`
on white; the soft is a tinted panel carrying `text-primary` `#101828`):

| Role | White text on solid | Solid as text on white | `text-primary` on soft |
| --- | ---: | ---: | ---: |
| waiter | **9.13:1** | 9.13:1 | 16.13:1 |
| cashier | **10.83:1** | 10.83:1 | 16.03:1 |
| supervisor | **12.55:1** | 12.55:1 | 16.06:1 |

All three clear the 7:1 (AAA) target for white-on-solid. The hero's dimmed
labels (`text-current/75`, `/80`) still land at 5.93–8.62:1. Rendered pixels were
sampled from Chromium screenshots and match the values above exactly.

Known, unchanged limitation: `text-muted` (`#6B7280`) on a role **soft** panel is
~4.38:1 — marginally under AA. This is pre-existing (the old softs measured
4.38–4.42:1) and is a property of the muted-ink token, not of the role hue;
raising the softs enough to fix it would wash the accent out entirely. Tracked in
§7.

### 3.6 What did **not** change

- Extended neutrals (`--color-page-bg #F6F7F9`, surfaces, borders, text tokens).
- All five status **`-surface`** tokens and `--color-status-neutral`.
- Every token **name** — §3.4 and §3.5 changed values only, so no component,
  Tailwind mapping or class string moved.

### 3.7 Consumption rule (non-negotiable)

> Brand colors are consumed **only** through the CSS custom properties defined in
> `apps/web/src/styles/globals.css` (and their Tailwind mappings in
> `apps/web/tailwind.config.ts`). **Never hard-code a hex** in a component, page,
> inline style, doc example, or ad-hoc asset. A rebrand must be a one-file change.

Exceptions, and only these: static assets that cannot read CSS variables — the
favicon/PWA/OG image files under `apps/web/public/`, and the
`<meta name="theme-color">` value in `_app.tsx`. Those are listed in §5 so they
can be updated together.

---

## 4. Typography

**Inter is the only type family.** Unlike brands that rely on multiple typefaces,
Nimbus POS keeps Inter alone to reinforce simplicity. Inter was kept because —
like navy and white — it embodies clarity, stability, and control: clean,
geometric, consistent proportions.

| Weight | Use |
| --- | --- |
| **Inter ExtraBold** | Display and brand statements, wordmark, hero headings, high-emphasis numerics. |
| **Inter Regular** | Body, labels, dense operational text. |

Product-side rules (see the global `DESIGN.md` type scale) remain in force:
tabular numbers for prices, totals, timers, and table numbers; no decorative
serif headings in operational workspaces.

> **Current app font stack — RESOLVED (2026-08-20). Inter is now self-hosted.**
> `apps/web/src/pages/_app.tsx` imports **`@fontsource-variable/inter`** (v5.3.0,
> a devDependency-free runtime dependency of `@nimbus-pos/web`), which ships the
> variable Inter `woff2` subsets plus their `@font-face` rules
> (`font-weight: 100 900`, `font-display: swap`). Next bundles them into the app's
> own `_next/static/media/…woff2` output, so brand typography no longer depends on
> a terminal-installed Inter and there is **no external font CDN request**.
>
> - **Mechanism:** self-hosted webfont from npm. `next/font/google` was tried first
>   and is **not** usable here — the build/sandbox network blocks
>   `fonts.googleapis.com` (HTTPS proxy returns 403), which would fail the build.
>   `@fontsource-variable/inter` uses the npm registry instead and produces the
>   same self-hosted outcome as `next/font/local` without vendoring binaries.
> - **Exposed family name is `"Inter Variable"`**, so the CSS stack is
>   `"Inter Variable", Inter, ui-sans-serif, system-ui, -apple-system,
>   BlinkMacSystemFont, "Segoe UI", sans-serif` — bundled variable Inter first, a
>   system-installed plain `Inter` second, then the system stack. This stack is
>   duplicated in exactly two places and **must be kept aligned**:
>   `apps/web/src/styles/globals.css` (`body`) and `apps/web/tailwind.config.ts`
>   (`theme.extend.fontFamily.sans`).
> - **Verified live (2026-08-20):** on `/login` and `/waiter/floor`,
>   `document.fonts` reports `Inter Variable 100 900 normal` with
>   `status: "loaded"`, `document.fonts.check('16px "Inter Variable"')` is `true`,
>   and the only webfont network request is
>   `200 /_next/static/media/inter-latin-wght-normal.<hash>.woff2` (same origin).

---

## 5. Asset inventory and required sizes

All brand raster/vector assets live under **`apps/web/public/brand/`** (shipped —
extracted from the brand PDF as true vectors, plus rasters derived from them).
`favicon.svg` also stays at the public root for the conventional path.

| Asset | Size(s) | Path | Status |
| --- | --- | --- | --- |
| Logomark (vector) | Any size; viewBox 349.5×232.13 (aspect ≈ 1.506:1) | `apps/web/public/brand/logomark.svg`, `logomark-white.svg` | **Shipped** |
| Wordmark, one-line ("Nimbus POS") | Vector | `apps/web/public/brand/wordmark.svg`, `wordmark-white.svg` | **Shipped** |
| Wordmark, stacked | Vector | `apps/web/public/brand/wordmark-stacked.svg`, `wordmark-stacked-white.svg` | **Shipped** |
| Combination mark, horizontal | Vector | `apps/web/public/brand/combination-mark.svg`, `combination-mark-white.svg` | **Shipped** |
| Combination mark, stacked | Vector | `apps/web/public/brand/combination-mark-stacked.svg`, `combination-mark-stacked-white.svg` | **Shipped** |
| Favicon (vector) | Any size; `viewBox="0 0 64 64"` — navy rounded tile + white mark | `apps/web/public/favicon.svg` (root, replaced the interim "N") and `apps/web/public/brand/favicon.svg` | **Shipped** |
| Favicon PNG fallbacks | 16×16, 32×32, 48×48 | `apps/web/public/brand/favicon-16.png`, `-32.png`, `-48.png` | **Shipped** |
| Apple touch icon | 180×180 | `apps/web/public/brand/apple-touch-icon.png` | **Shipped** (linked from `_app.tsx`) |
| PWA icon | 192×192 | `apps/web/public/brand/icon-192.png` | **Shipped** |
| PWA icon | 512×512 | `apps/web/public/brand/icon-512.png` | **Shipped** |
| PWA maskable icon | 512×512 (safe zone ≥ 80%) | `apps/web/public/brand/icon-512-maskable.png` | **Shipped** |
| Open Graph / social image | 1200×630 | `apps/web/public/brand/og-image.png` | **Shipped** (linked as `og:image` from `_app.tsx`) |
| Web app manifest | — | `apps/web/public/brand/manifest.webmanifest` | **Shipped** (linked from `_app.tsx`) |
| In-app logomark component | `currentColor`-driven inline SVG | `apps/web/src/components/pos-shell/NimbusLogomark.tsx` | **Shipped** — not an icon-registry entry |
| In-app brand tile — header lockup | 44×44 (`h-11 w-11`) | `components/pos-shell/BranchContextLabel.tsx` (mounts `NimbusLogomark`, replaced the Phosphor Storefront stand-in) | **Shipped** |
| In-app brand tile — login hero | 56×56 (`h-14 w-14`) | `pages/login.tsx` (mounts `NimbusLogomark`, replaced the LockKey stand-in) | **Shipped** |

### Icon registry sizes (for reference — product icons, not brand assets)

From `docs/UI_SYSTEM.md` §4, the canonical Phosphor icon sizes are
`compactAction: 18`, `bottomNavigation: 24`, `pageState: 32`. The logomark is
**not** part of the icon registry and must never be registered as an
`OperationalIconName`.

---

## 6. Application rules

- **Navy header + navy bottom nav on a white/near-white page.** Dark chrome, light
  workspace. `--color-brand-navy-950` for the deepest chrome, `-900` for the
  active/primary layer, `-800` for hover-on-dark and the header time chip.
- **Lockup treatment:** a **white tile with the navy mark inside it** — never a
  navy mark directly on navy. This is already the shipped pattern at both lockup
  sites (44×44 header tile, 56×56 login hero), both `bg-brand-white` +
  `text-brand-navy-900`.
- **Light grey (`--color-brand-silver`)** is the premium quiet accent: secondary
  buttons, disabled fills, quiet dividers and metadata chrome. Never for critical
  status or primary action.
- **Dark grey (`--color-brand-graphite`)** is secondary text, muted status, and
  dark-grey controls. Never for long low-contrast body copy.
- **Contrast:** white-on-navy and navy-on-white both clear WCAG 2.2 AA at body
  sizes; light grey on white does **not** — never use silver for text that must be
  read. See `PRODUCT.md` (Accessibility & Inclusion) for the full target.
- **No gradients, no glassmorphism, no neon, no decorative shadows.** Elevation is
  the four `--shadow-*` tokens only. Status is never communicated by color alone.
  (Aligns with the global `DESIGN.md` anti-references and `PRODUCT.md`.)
- **No emoji, no mixed icon families**, no marketing-site flourishes inside
  operational surfaces.

---

## 7. Open items

1. **`text-muted` on role-soft panels** measures ~4.38:1 (marginally under AA).
   Pre-existing and independent of the role hues; fixing it means changing
   `--color-text-muted` or promoting those labels to `text-secondary`
   (6.84:1) — a text-token decision, not a role-accent one. See §3.5.
2. **`text-status-warning/80`** on `--color-status-warning-surface` measures
   3.41:1 (up from 1.97:1 after §3.4, still under AA). One site only — the
   "+N more reasons" overflow counter in
   `components/supervisor/reservations/SupervisorReservationRow.tsx`. Dropping
   the `/80` opacity modifier takes it to 4.99:1; deferred as a component change
   outside the token pass.

Resolved (kept for the record): **Inter is now self-hosted** — the former
"Inter not self-hosted" open item is **RESOLVED** as of 2026-08-20 via the
bundled `@fontsource-variable/inter` webfont (see the §4 note for the mechanism
and live verification); the steering-wheel SVG and the full §5 asset set
are **shipped** (extracted from the brand PDF); the Dark Grey hex is **resolved**
to `#6B6B6B`, sampled from the guide's page-17 swatch (the printed hex is a typo —
see §3.1); the **role accent colors are RESOLVED** — owner approved re-deriving
`--color-role-*` from the brand navy on **2026-08-20**, new values and contrast
numbers in §3.5; the **status ink contrast pass is RESOLVED** — owner approved on
**2026-08-20**, new values and contrast numbers in §3.4.
