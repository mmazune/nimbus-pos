# UI_SYSTEM.md — Nimbus POS shared operational UI

> The visual + structural system for the operational role apps (Waiter, Cashier,
> Supervisor, **Manager**). Companion to `PRODUCT.md` (product/design principles) and
> `ARCHITECTURE.md` (system shape). Code lives in `apps/web/src/components/`.

> **OWNER UI POLISH WAVE 2 — global density + fullscreen lock screen (owner-approved 2026-08-20).**
> Five owner complaints were fixed in the SHARED layer: (1) `/login` is a true fullscreen layout with
> **zero page scroll** at every terminal viewport; (2) a **global density mechanism** (§1c) makes the
> whole app enterprise-tight at laptop sizes; (3) the lock screen is brand-led (logomark + wordmark
> lockup, role-marketing copy removed); (4) the header prints a **terminal identity** ("Terminal 01")
> instead of "Service area unavailable"; (5) long floor table labels are **abbreviated** on screen
> (§5b) so card titles are one line. This wave DELIBERATELY overrides previously locked geometry —
> the 176px table card, the 80px header, and the 80px bottom nav — under the owner's explicit
> authorization. See `docs/DECISIONS.md` (2026-08-20 entries).

> **Brand rebrand (2026-08-20):** the Aug 2026 Nimbus POS Brand Identity landed in
> `apps/web/src/styles/globals.css` — brand token **values** changed (canonical navy is now
> `#000033`), token **names** did not. See §1b below and `docs/BRAND_IDENTITY.md`.

> **Supervisor final closure (2026-07-31):** the shared-first architecture below (one Floor, one
> shell, one idle handler, one icon registry across all three roles) was verified intact by
> cross-role regression specs at all four viewports in the final integrated QA pass — no shared
> component was forked or diverged. See
> `ai/SUPERVISOR_RECONSTRUCTION_FINAL_COMPLETION_REPORT.md`.

> **Prompt 5B2 (2026-07-31):** The Approvals workspace's shift-swap + anomaly detail panels gained
> decision controls (reject; acknowledge/resolve) reusing the same shared `ActionConfirmDialog` +
> `ToastProvider` — no new component families. Shift-swap deliberately exposes no Approve control
> (Outcome C), demonstrating the system's honest-affordance principle: the UI never renders an action
> it can't truthfully perform.
>
> **Prompt 5B1 (2026-07-30):** The Supervisor **Approvals** page adopts the premium master-detail
> pattern (mirroring Reservations): a queue column + a sticky detail panel that stacks on narrow
> viewports (`xl:grid-cols-[minmax(0,1fr)_460px]`, one detail workspace). It reuses shared primitives
> — `ActionConfirmDialog`, `ToastProvider`, `Badge`/`Button`/`Card`/`Skeleton`/`StatusMessage` — and
> a single identity-safe queue-row shell for all four approval domains. Scope tabs + domain filter
> use accessible `role=tablist`/`aria-pressed`; status/severity convey via labelled badges (not
> colour alone). Components: `components/supervisor/approvals/workspace/*`.

> **Manager M-P1 (2026-08-20):** the shell system now serves **four** roles. Manager consumes
> `OperationalShell` / `OperationalHeader` / `OperationalBottomNav` / `OperationalIdleLogoutHandler`
> through thin adapters in `components/manager/shell/` — no fork. Two shared additions landed:
> `OperationalHeaderContext` gained an **optional** `branchSwitcher?: ReactNode` slot (absent for
> the other three roles, which render byte-identical markup), and the icon registry gained six
> names (`overview`, `operations`, `staff`, `reports`, `settings`, `caretDown`). See
> `ai/MANAGER_P1_SHELL_COMPLETION_REPORT.md`.
>
> **Manager Track B1 (2026-08-20):** Manager's presentation converts from that bottom nav to an
> Odoo-style **top module bar** — see §3b. `OperationalShell` gained an additive
> `navigation="top" | "bottom"` prop (default `"bottom"`); `OperationalHeader`/`OperationalBottomNav`
> are untouched and still serve Waiter/Cashier/Supervisor exactly as M-P1 left them. Manager's M-P1
> `ManagerHeader.tsx`/`ManagerBottomNav.tsx` are **retired** (deleted, replaced by `ManagerTopNav.tsx`
> over the new shared `OperationalTopNav.tsx`/`OperationalTopNavDropdown.tsx`). See
> `ai/ENTERPRISE_B1_TOPNAV_COMPLETION_REPORT.md`.

## 1. Principle: shared-first

Equivalent UI concepts across roles are implemented **once** as shared primitives
and consumed via thin per-role adapters. Never fork a per-role copy of a shared
concept. When you change a shared component, verify **every** consuming role.

Four consuming roles. Three shared trees:

- `components/pos-shell/` — shell, header, bottom nav, clock, idle handler, icons.
- `components/floor/` — the table Floor (toolbar, grid, cards, status, workspace frame).
- `components/profile/` — the "Me"/profile presentation primitives.

## 1b. Brand palette & logomark

Rebranded 2026-08-20 to the **Nimbus POS Brand Identity** guide (Andimashimwe Rhoda,
Aug 2026). Canonical reference: `docs/BRAND_IDENTITY.md`.

| Token | Value | Note |
| --- | ---: | --- |
| `--color-brand-navy-950` | `#000024` | Derived shade — deepest header/scrim. |
| `--color-brand-navy-900` | `#000033` | **Canonical brand Navy Blue** (RGB 0 0 51). Primary dark, reversed actions, focus ring. |
| `--color-brand-navy-800` | `#1E1E52` | Derived tint — hover on dark, header time chip. |
| `--color-brand-white` | `#FFFFFF` | |
| `--color-brand-silver` | `#B3B4AF` | Brand Light Grey. |
| `--color-brand-graphite` | `#6B6B6B` | Brand Dark Grey (RGB 107 107 107) — sampled directly from the guide's Dark Grey swatch (p. 17); the guide's printed hex is a typo (duplicates Light Grey). `--color-status-neutral` stays `#616367` and is now decoupled from graphite. |

`--color-surface-navy` and `--color-focus-ring` now reference
`var(--color-brand-navy-900)`; shadow/selection ink composes from
`--color-brand-navy-rgb: 0, 0, 51`. Extended neutrals are **unchanged**.

**Status ink — contrast pass (owner-approved 2026-08-20).** The four status ink
tokens were darkened so each clears WCAG AA (4.5:1) as text on **both** its own
`-surface` token **and** `#FFFFFF`, and so white text on the solid fill (the
`Button` `danger` variant) clears AA. Surface tokens and token names are
unchanged; hue is preserved.

| Token | Before | After | On own surface | On `#FFFFFF` | White on solid |
| --- | ---: | ---: | ---: | ---: | ---: |
| `--color-status-success` | `#1F8A5B` | **`#11774E`** | 3.94 → **5.06** | 4.33 → **5.57** | 4.33 → **5.57** |
| `--color-status-warning` | `#D19822` | **`#8A6410`** | 2.37 → **4.99** | 2.55 → **5.37** | 2.55 → **5.37** |
| `--color-status-danger` | `#D1495B` | **`#B7384C`** | 3.83 → **5.00** | 4.36 → **5.70** | 4.36 → **5.70** |
| `--color-status-info` | `#2F6FBA` | **`#2B69B2`** | 4.54 → **4.95** | 5.12 → **5.58** | 5.12 → **5.58** |

`--color-status-neutral` `#616367` is unchanged (5.37 / 6.02). Tailwind resolves
`text-status-*` / `bg-status-*` through the **`--color-status-*-ch` channel
triplets**, not the hexes — edit both together (success `17 119 78`, warning
`138 100 16`, danger `183 56 76`, info `43 105 178`).

**Role accents — re-derived from brand navy (owner-approved 2026-08-20).** The
`--color-role-*` tokens sit in one navy family derived from `#000033` (OKLCH
hue 264) on a 30° hue ladder: waiter steel-blue (232), supervisor on the brand hue
(264), cashier indigo (294), and — added by Manager M-P1 — **manager plum (324)**.
The old cashier accent was amber (hue 62) and read as a warning colour.

| Token | Before | After | Renders | White on solid |
| --- | --- | --- | ---: | ---: |
| `--color-role-waiter` | `oklch(0.39 0.055 190)` | **`oklch(0.4 0.062 232)`** | `#1F4D63` | **9.13:1** |
| `--color-role-waiter-soft` | `oklch(0.965 0.018 190)` | **`oklch(0.965 0.015 232)`** | `#EAF6FC` | — |
| `--color-role-cashier` | `oklch(0.42 0.07 62)` | **`oklch(0.365 0.062 294)`** | `#40385C` | **10.83:1** |
| `--color-role-cashier-soft` | `oklch(0.97 0.022 72)` | **`oklch(0.965 0.015 294)`** | `#F4F2FD` | — |
| `--color-role-supervisor` | `oklch(0.4 0.065 253)` | **`oklch(0.325 0.085 264)`** | `#1D325F` | **12.55:1** |
| `--color-role-supervisor-soft` | `oklch(0.965 0.018 253)` | **`oklch(0.965 0.015 264)`** | `#EEF4FE` | — |
| `--color-role-manager` | *(new, M-P1)* | **`oklch(0.36 0.06 324)`** | `#4D324F` | **11.18:1** |
| `--color-role-manager-soft` | *(new, M-P1)* | **`oklch(0.965 0.015 324)`** | `#F9F0F9` | — |

`text-primary` on each soft is ≥16:1. Consumed only via `roleAccentMap` in
`lib/profile/profile-model.ts` (`bg-role-*` / `bg-role-*-soft` / `text-role-*`),
rendered by `components/profile/RoleProfileHero.tsx`. Full derivation and the
complete contrast tables live in `docs/BRAND_IDENTITY.md` §3.4–§3.5.

**Tokenization rule:** brand colors are consumed only via the CSS variables in
`apps/web/src/styles/globals.css` (and their Tailwind mappings). Never hard-code a
hex in a component. The only exceptions are static assets that can't read CSS vars —
the favicon/PWA/OG files under `apps/web/public/` and `<meta name="theme-color">`
in `pages/_app.tsx` (`#000033`).

**Lockup sites (two, both white tile + navy mark):**

- `components/pos-shell/BranchContextLabel.tsx` — 44×44 header tile
  (`h-11 w-11`, `bg-brand-white` + `text-brand-navy-900`).
- `pages/login.tsx` — 56×56 login hero tile (`h-14 w-14`, same treatment).

**Logomark status: live.** The brand logomark is a **steering wheel** ("in the driver's
seat of your business"), extracted as a true vector from the brand PDF. In-app it renders
via `components/pos-shell/NimbusLogomark.tsx` (inline SVG, `currentColor`-driven), mounted
at both lockup sites above (`BranchContextLabel.tsx` 44px header tile, `pages/login.tsx`
56px hero tile). `apps/web/public/favicon.svg` is now the brand favicon (navy rounded tile
+ white mark — the interim "N" is gone), and the full `apps/web/public/brand/` asset set is
shipped (logomark/wordmark/combination-mark SVGs, favicon PNGs, apple-touch-icon, PWA icons
192/512/512-maskable, og-image, `manifest.webmanifest` — all linked from `_app.tsx`; see
`docs/BRAND_IDENTITY.md` §5). The logomark is **not** an `OperationalIconName` and must
never be added to the icon registry in §4.

## 1c. Global density mechanism (owner-approved 2026-08-20)

The operational app is a **fullscreen terminal**: it must FIT the viewport rather
than scroll it. Instead of per-component breakpoint tuning, density is driven by
**one systematic mechanism plus a small set of targeted px fixes**.

**(a) Viewport-scaled root font size.** `apps/web/src/styles/globals.css`:

```css
html { font-size: clamp(13.5px, calc(0.625vh + 9.25px), 16px); }
```

| Viewport | Root font size | Header | Bottom nav | Table card min-h |
| --- | ---: | ---: | ---: | ---: |
| 1280 × 680 | **13.50px** | 54px | 55px | 128px |
| 1366 × 768 | **14.05px** | 56px | 57px | 133px |
| 1440 × 900 | **14.88px** | 60px | 61px | 141px |
| 1920 × 1080 | **16.00px** (ceiling) | 64px | 65px | 152px |

(Header/nav/card figures are live-measured; the nav is 1px taller than the header
because of its top border.) The scale is **height-driven** because vertical fit is
what actually overflows on a laptop with browser chrome. At the 16px ceiling every
metric equals its pre-density value, so 1920×1080 is unchanged.

**(b) Rem-normalized spacing scale.** `--space-1 … --space-12` in `globals.css`
were absolute px (4…48). They are now the equivalent **rem** values, so the
Tailwind spacing keys they back (`1,2,3,4,5,6,8,10,12` — the only keys this repo
overrides) follow the root font size. Every other Tailwind utility this app uses
(type scale, default spacing keys, radii) is already rem-based and scales for free.

**(c) Targeted non-scaling fixes.** Raw px values do NOT follow rem, so these were
re-tuned once, in one place each:

| What | Before | After | Where |
| --- | --- | --- | --- |
| Icon registry sizes | 18 / 24 / 32 | **16 / 20 / 28** | `pos-shell/role-icon-config.ts` (`compactAction` / `bottomNavigation` / `pageState`) |
| Table card min height | `min-h-[176px]` | **`min-h-[9.5rem]`** | `floor/OperationalTableCard.tsx`, grid skeleton |
| Table grid track | `minmax(220px,1fr)` | **`minmax(13rem,1fr)`** | `floor/OperationalTableGrid.tsx` |

**(d) Shared-region metrics** (resolved at the 16px ceiling; see
`pos-shell/layout.ts`, which documents the rem class for each):

| Region | Before | After | Class |
| --- | ---: | ---: | --- |
| Header | 80px | **64px** | `h-16` |
| Header brand tile | 44px | **36px** | `h-9 w-9` |
| Header identity tile | 44px | **36px** | `h-9 w-9` |
| Readiness strip | 44px | **36px** | `top-16` + `h-9` |
| Main top padding | 160px | **116px** | `pt-[7.25rem]` |
| Bottom nav | 80px | **64px** | `h-16` (items `h-full`) |
| Main bottom clearance | 112px | **80px** | `pb-[calc(5rem+env(safe-area-inset-bottom))]` |
| `PageShell` title | `text-2xl` | **`text-xl`** | `ui/PageShell.tsx` |
| Table card title | `text-xl`, `break-words` | **`text-lg`, `truncate`** | `floor/OperationalTableCard.tsx` |

**Rules when editing components under this mechanism:**

1. Prefer rem/Tailwind utilities — they scale automatically.
2. Never introduce a raw px arbitrary value for **vertical** rhythm; use rem.
3. Icon geometry is re-tuned **only** through the registry tokens in §4.
4. The mechanism is global and role-agnostic: it applies identically to Waiter,
   Cashier, Supervisor and Manager. Verify all four after touching it.

## 1d. Lock screen (`/login`) — fullscreen, brand-led (owner-approved 2026-08-20)

`pages/login.tsx` is a **true `h-screen` layout with `overflow-hidden`**. There is
never a page-level scrollbar; if the sign-in card ever exceeds the available
height, the CARD scrolls internally (`overflow-y-auto`), not the document.

Verified live (`document.documentElement.scrollHeight` vs `window.innerHeight`):
680/680, 768/768, 900/900, 1080/1080 — **equal at all four viewports**.

Content is minimal and brand-led:

- **Lockup** — the brand combination mark: white logomark tile (`h-11 w-11`,
  ≈41px at 1440) beside a one-line "Nimbus **POS**" wordmark set inline in Inter
  ExtraBold (crisper than an `<img>` at terminal sizes; the visible spans are
  `aria-hidden` with one `sr-only` "Nimbus POS" so it is announced once).
- **"Service terminal"** heading.
- **Three compact status chips** — Workstation (the terminal label, §2b), Time
  (shared `CurrentTime`), API.
- **REMOVED**: the role-marketing paragraph ("Shared desktop access for waiter
  service, cashier settlement, …") and the footer sentence ("Owner and accountant
  accounts can authenticate here, …"). The **truthful blocked-account behaviour is
  unchanged** — a real failed role still raises the `StatusMessage` warning
  "This frontend currently supports waiter, cashier, supervisor, and manager
  workspaces only." It is now shown only when it is actually true.

The PIN pad, card padding and type scale down with the root font size (keys are
`h-11`, i.e. 44px at 1920 and 37px at 1280×680).

## 2. Shared operational shell

`OperationalShell` is a fixed-region layout: fixed header (top), a readiness strip
below it, a scrolling `main` with a `pt-[7.25rem]` top padding and a
`pb-[calc(5rem+env(safe-area-inset-bottom))]` bottom pad so content clears the fixed
bottom nav, and a fixed `OperationalBottomNav`. Max content width `1600px`.
**All region heights are rem-based since the 2026-08-20 density pass** — see §1c(d)
and `pos-shell/layout.ts` for the canonical numbers.

Each role shell (`WaiterShell`/`CashierShell`/`SupervisorShell`/`ManagerShell`) wraps a
role `SessionGuard` around `OperationalShell` and injects four slots: `header`,
`readiness`, `bottomNavigation`, `idleHandler`. `ManagerShell` additionally mounts
`ManagerBranchProvider` outside its guard, because Manager is the only multi-branch
role and the guard, header switcher, and pages must share one selected branch.
Since Track B1 (2026-08-20), `OperationalShell` also accepts an additive
`navigation="top" | "bottom"` prop (default `"bottom"`) — `ManagerShell` is the only
`navigation="top"` consumer today: it passes no `bottomNavigation` and its `header`
slot renders `ManagerTopNav` instead of `ManagerHeader`. The other three roles pass
neither prop and render exactly the markup they always have — see §3b.

- **Header** (`OperationalHeader`): role identity, branch/workstation/service-area
  context (`BranchContextLabel`, `RoleIdentity`), shared `CurrentTime`, and the
  shared logout. Role headers are thin adapters. Since Manager M-P1 the header also
  accepts an **optional** `branchSwitcher` node rendered immediately before the clock;
  when a role passes nothing (Waiter, Cashier, Supervisor) the header renders exactly
  the markup it did before the slot existed.
- **Bottom nav** (`OperationalBottomNav`): renders the role's nav items from
  `getOperationalRoleNavigation(role)`; active item uses the `fill` icon weight,
  inactive uses `bold`.
- **Clock** (`CurrentTime`): shared, updates on an interval (coarse granularity is
  intentional).

### 2b. Terminal identity (owner-approved 2026-08-20)

The header's second context slot used to print a dead fallback — "Service area
unavailable" (Waiter) / "Workstation unavailable" (Cashier, Supervisor). The API
exposes **no** service-area or workstation entity for a POS terminal, so instead of
an unavailable-state the shell now shows a deterministic **station label**:

`components/pos-shell/station.ts`

1. `localStorage["nimbus.stationTerminalLabel"]` if an installer/operator set one
   for this physical station, else
2. the constant `DEFAULT_TERMINAL_LABEL` = **"Terminal 01"**.

`useStationTerminalLabel()` is hydration-safe (server render and first client
render both emit the constant; any override is applied in an effect). This is
**honestly a station label, not backend data** — the module says so, and every
render site is commented. When a real workstation contract lands, replace the
fallback inside the hook; no render site changes.

Consumed by all four roles: `WaiterHeader` (`contextKind="service-area"`) and
`useCashierContext().workstationLabel` / `useSupervisorContext().workstationLabel` /
`useManagerContext().workspaceLabel` (`contextKind="workstation"`), so the Cashier
Till toolbar and the Cashier/Supervisor Me screens read the same label.

## 3. Navigation (locked)

Nav is registered centrally in `pos-shell/role-navigation.ts`, sourced from each
role's `lib/<role>/routes.ts`:

| Role | Tabs |
| --- | --- |
| Waiter | **Floor · Reservations · Me** (Floor stays active on `/waiter/orders*`) |
| Cashier | **Floor · Till · Me** (Prompt C1+C2, 2026-07-31; default `/cashier/floor`) |
| Supervisor | **Floor · Reservations · Approvals · Me** |
| Manager | ~~**Overview · Operations · Staff · Reports · Settings · Me** (bottom nav, M-P1, 2026-08-20)~~ → **Odoo-style TOP NAV BAR, IMPLEMENTED Track B1 (2026-08-20)** (see §3b). The six surfaces survive as the first six top-nav menus; landing stays `/manager/overview`. |

There is **no Orders tab** for Waiter or Supervisor. Legacy Orders routes are
redirect-only.

✅ **Manager is the fourth registry consumer (M-P1, 2026-08-20).** The six tabs above are locked by
the owner decision register; approvals appear as counts on Overview and as domain reviews inside
Operations/Staff, never as a tab. The **branch switcher** is the one genuinely new shell
affordance: a native `<select>` in the header's optional slot, sourced from `me.memberships` (no
extra request), persisted at `nimbus.managerBranchId` (deliberately NOT the station key
`nimbus.stationBranchId`, which seeds the terminal's Quick-PIN branch field), driving `X-Branch-Id`
through the existing `apiRequest({ branchId })` parameter, and invalidating **only** the
`["manager", …]` query namespace on change — never `queryClient.clear()`, never auth/profile. M-P1
pages render honest foundation states with no live data; Manager **Me** is real and built solely
from the already-fetched `/api/auth/me`.

✅ **Cashier is Floor-first (Prompt C1+C2 implemented 2026-07-31):** the visible nav is
**Floor · Till · Me** (Queue/Receipts removed from the nav), default route `/cashier/floor`
(with `/cashier` redirecting there), and Cashier is the **third shared-`OperationalFloor`
consumer** alongside Waiter/Supervisor. The Floor tab uses the same canonical `floor` icon.
**C2** added, behind a table selection, table→bill resolution (zero/one/multiple, fail-closed, no
silent first-pick), ONE **read-only** `CashierSettlementWorkspace` reusing the checkout primitives,
canonical `?tableId=&orderId=` URL state, and a Cashier-only **Find bill** sibling above the shared
Floor (payment/close execution is C3). Queue/Receipts survive only as **hidden compatibility
routes** (direct URL, retire C4/C5). See `docs/cashier-ui-docs/CASHIER_ARCHITECTURE.md`,
`ai/CASHIER_FLOOR_RECONSTRUCTION_DECISION.md`, and
`ai/CASHIER_FLOOR_RECONSTRUCTION_C2_BILL_RESOLUTION_COMPLETION_REPORT.md`.

### 3b. Management top nav (owner-approved 2026-08-20 — IMPLEMENTED Track B1, 2026-08-20)

**Decision:** `docs/DECISIONS.md` **D-MGRTOPNAV**. **Plan:** `ai/ENTERPRISE_UI_ROADMAP.md`
Track B **B1**. **Reference:** `ai/ODOO_REFERENCE_RESEARCH.md` §1.2/§1.3/§1.5/§1.6/§1.7 and
components C1/C2/C3/C15 (17 screenshots in `ai/odoo-reference-screenshots/`). **Completion
record:** `ai/ENTERPRISE_B1_TOPNAV_COMPLETION_REPORT.md`.

Manager (and later Owner) navigation converts from the M-P1 **bottom nav** to an **Odoo-style top
module bar**, shipped as `components/pos-shell/OperationalTopNav.tsx` (shared, so a future Owner
variant reuses it unforked per OD-1/OD-5) consumed by the thin `components/manager/shell/ManagerTopNav.tsx`
adapter. The retired M-P1 `ManagerHeader.tsx`/`ManagerBottomNav.tsx` are deleted (not dead code):

- a single module bar (`h-16`, `bg-brand-navy-950`) — the `NimbusLogomark` brand tile doubles as the
  home control (→ `/manager/overview`); `role="menubar"` with **roving-tabindex** Left/Right/Home/End
  keyboard traversal; Overview and Me are **direct-action** menu items (no dropdown); Operations,
  Staff, Reports and Settings are **click-to-open** dropdown triggers grouped by muted section
  headers, scrolling inside the panel, `Escape` closes and returns focus to the trigger, outside
  click closes, and a Next.js route change closes any open dropdown. A top-right cluster carries the
  **existing** branch switcher (unchanged from M-P1), the shared `CurrentTime`, and an
  identity/logout dropdown ("My profile" → `/manager/me`, "Logout").
- **The dropdown mechanics are generic** (`OperationalTopNavDropdown.tsx`) and reused for both the
  grouped menus and the identity menu: `ArrowDown`/`ArrowUp`/`Home`/`End` move focus among
  `role="menuitem"` rows inside an open panel, opening focuses the first item.
- **The B1 menu tree is honest, not fabricated.** Each of Operations/Staff/Reports/Settings' dropdown
  carries ONE real, clickable link (today's M-P1 foundation page) plus the roadmap's named tree items
  rendered as **inert `aria-disabled` rows** tagged with the phase that ships them (e.g. "Orders — B3")
  — never a link to a page that does not exist. Accounting is **not** added as a seventh menu (OD-3
  stays open, gated on B5).
- **Manager chrome primitives** (`components/manager/chrome/`) — `ManagerControlPanel` (title +
  optional New/secondary action + actions-cog + chip search + server-backed pager + view switcher,
  every slot optional and omitted, never disabled, when a surface has nothing to back it),
  `ManagerSearchFilterMenu` (the three-column Filters/Group-By/Favorites dropdown; Favorites is
  explicitly labelled "saved on this terminal only" per **OD-7**, localStorage-only, no save-search
  endpoint exists), `ManagerContentShell` (layout wrapper, no nested scroll owner), and
  `ManagerBreadcrumbs` (parent link + record identity + cog + record pager). B1 mounts
  `ManagerControlPanel`/`ManagerContentShell` on every Manager page with **title only** — no B1
  surface has a create action, record menu, searchable list, or real pager yet, so those slots stay
  empty rather than faked. `ManagerSearchFilterMenu` and `ManagerBreadcrumbs` are built and exported
  but **not mounted anywhere in B1** (no surface has filterable/record data yet) — first consumed
  from B3 onward, same precedent as the roadmap set for breadcrumbs.
- The pager type (`ManagerControlPanelPager`) requires an explicit `{ from, to, total }` — it
  structurally cannot be fed a client-side array length.

**Frontline roles keep bottom nav, byte-identical.** `OperationalShell` gained an additive
`navigation="top" | "bottom"` prop (default `"bottom"`) and `bottomNavigation` became optional;
Waiter/Cashier/Supervisor pass neither a `navigation` prop nor an empty `bottomNavigation`, so their
markup is unchanged. Verified live: `e2e/manager-shell/shell-parity.spec.ts` screenshots + assertions
across all four viewport projects.

**OD-4 answered — sub-desktop collapse breakpoint is `xl` (1280px), not the roadmap-suggested `lg`
(1024px).** Layout measurement showed the full bar (brand lockup + six menus + branch switcher +
clock + identity) does not reliably fit at the tightest supported project (1024×768); collapsing
there too preserves the existing "no horizontal overflow at 1024×768" invariant. Below `xl`, the
module bar is replaced by a single "Menu" control opening the same dropdown mechanism with a flat,
already-expanded tree — **never** the frontline bottom nav.

**Carried forward from M-P1 unchanged:** Manager as the fourth shared-system consumer;
`ManagerShell`/`ManagerSessionGuard`; the branch switcher (source `me.memberships`, persistence
`nimbus.managerBranchId`, `X-Branch-Id` plumbing, narrow `["manager", …]` invalidation);
`lib/manager/permissions.ts` as a **surface allow-list, not a permission check**; the honest
foundation pages and the real Manager **Me**; and the readiness strip's "three verified chips only,
never faked" rule.

**Do not port Odoo's dark palette.** The reference's hexes are a *layout and hierarchy* guide only —
Nimbus stays navy/silver/graphite per `docs/BRAND_IDENTITY.md`, and the §1c density mechanism applies
to every new management surface (verified: no hard-coded hex in any new B1 file).

**OD-3 remains open** (whether Accounting becomes a seventh top-level module — gated on B5).

### 3c. Management dashboard card (IMPLEMENTED Track B2, 2026-08-20)

**Plan:** `ai/ENTERPRISE_UI_ROADMAP.md` Track B **B2**. **Reference:** `ai/ODOO_REFERENCE_RESEARCH.md`
§2.1/§2.2, component **C10**, screenshots `02-accounting-dashboard.jpg` / `16-zoom-kpi-card-palette.png`.
**Completion record:** `ai/ENTERPRISE_B2_DASHBOARD_COMPLETION_REPORT.md`.

The canonical management KPI card is `components/manager/dashboard/ManagerDashboardCard.tsx`, with
its content primitives in the same file and its marks in `ManagerDashboardCharts.tsx`. Every future
management dashboard card — including the Owner variant (B7) — composes these rather than forking a
second card.

**Anatomy** (cloned from the observed Odoo journal card):

```
▌ [icon] Title                                    [action] [action]
▌ PRIMARY KPI (2xl, tabular)
▌ PRIMARY LABEL (xs, uppercase, tracked)
▌ <count label — the drill-in LINK>        <amount — plain data>
▌ <count label>                            <amount>
▌ ─── mini mark OR checklist OR nothing ───
▌ ─────────────────────────────────────────
▌ provenance footnote (xs, muted, pinned to the card foot)
```

**Rules:**

- **A 4px coloured left accent bar** (`accent`: `brand | info | success | warning | danger`) — the
  Odoo card's per-journal edge, rotated onto Nimbus's own tone tokens.
- **Counts are links, amounts are plain data.** `ManagerCardStatList` links the *label*, never the
  value. Every linked count targets the surface that owns it.
- **Mixed-weight actions.** At most one filled button per surface (the control-panel action); card
  actions are outlined secondaries (`ManagerCardActionLink`).
- **A card may legitimately have no mark**, or a checklist instead of one (`ManagerCardChecklist`,
  the Odoo Tax-Returns pattern). The grid does **not** force visual symmetry.
- **Four exclusive states**, each carrying `data-manager-card-state`: `loading` (skeleton), `error`,
  `empty`, `ready`. The error state is **fail-closed — it renders no figure at all**, not a stale one
  and never a zero. A zero on a money surface is a claim, not a fallback.
- **Every KPI must be registered.** `ManagerCardPrimaryKpi`/`ManagerCardStatList` take a `kpiKey`
  resolved through `MANAGER_KPI_BINDINGS` (`lib/manager/dashboard-model.ts`), which binds it to a
  verified endpoint field and a drill-in target. An unregistered key **throws**. A KPI with no drill-in
  must record a written `noDrillInReason`.
- **Provenance footnote.** Where a number is capped, derived, or bounded by a backend limit, the card
  says so in product copy (e.g. the 50-row open-orders preview, MP0-09).

**Marks** (`ManagerDashboardCharts.tsx`) are hand-rolled SVG — the app has **no charting
dependency**, and `manager-b2-assertions.ts` fails if one is added:

- `ManagerDonutChart` — part-of-whole, only where the endpoint returns the total itself.
- `ManagerBarSeries` — bucketed counts derived from real returned rows. **Never a synthetic series:**
  nothing interpolates, smooths, or back-fills, and a bucket with no data renders as a real zero
  against a visible baseline.
- `ManagerRatioMeter` — one value against its own threshold; an unreadable pair renders an empty
  track plus an explicit "unavailable" label, never a bar at zero.

Each mark is `role="img"` with a real `<title>` and `<desc>`, and the same numbers are always present
as text — colour is never the only carrier of meaning (§7).

**Chart tokens** live in `globals.css` and `tailwind.config.ts`: `--color-chart-series-1…4` is a
brand-monochrome **navy → silver** ramp (series separate by lightness as well as hue) plus
`--color-chart-track` for the unfilled remainder. Severity ramps (open-order aging) deliberately use
the existing `status-*` ink tokens instead, because there the colour *is* the semantic. **Role accent
tokens are never used as chart series** — they are role-semantic and overloading them would break
that meaning.

## 4. Canonical icon registry

Single source of truth in `pos-shell/`:

- `role-icon-config.ts` — the name constants (`operationalIconNames`), the
  `OperationalIconName` type, and canonical **sizes** (`bottomNavigation: 20`,
  `compactAction: 16`, `pageState: 28` — reduced from 24/18/32 by the 2026-08-20
  density pass; this registry is the ONLY place icon geometry may be re-tuned)
  and **weights** (`activeNavigation: "fill"`,
  `inactiveNavigation: "bold"`, `default: "bold"`, `brand: "duotone"`).
- `role-icons.ts` — maps each name → a concrete Phosphor component.

Rules: reference icons **by name** only; never import Phosphor directly in
routes/screens; always apply the registry size/weight tokens.

## 5. Shared operational Floor

`OperationalFloor` composes `OperationalFloorToolbar` + `OperationalTableGrid`;
the grid renders `OperationalTableCard`, which renders `OperationalTableStatusBadge`.
Waiter, Supervisor, **and Cashier (Prompt C1, 2026-07-31)** render the **same**
`OperationalFloor` (generic over `OperationalTableViewModel`; each role passes a
role-specific view model that extends it). **Role behaviour diverges only AFTER
table selection:** Waiter → menu/order workspace; Supervisor → read-first
table-control workspace; Cashier → a **read-only, truthful settlement boundary**
(`CashierSelectedTablePanel`, copy "Select a bill to continue.", exposing no
payment/close/split/refund/receipt action) that C2 replaces with the real
settlement workspace. Cashier's Floor reads only shared-safe data (tables + active
orders + reservations) and shows no guest name/contact/payment/receipt reference on
cards.

- **Cards** are `min-h-[9.5rem]` (rem-based since 2026-08-20 — 152px at the 16px
  root ceiling, ~141px at 1440×900, ~128px at 1280×680; the previously locked
  absolute 176px is superseded by the owner-approved density pass, §1c). They show
  the **display label** (§5b), a status badge, a status-specific middle (ready /
  reservation time / assigned staff + "Mine" / temporarily unavailable), and a
  capacity footer. Card titles are **one line** (`truncate`). Cards **never** expose
  guest names.
- **Staff names** are formatted `First L.` (e.g. "Peter M.") via
  `floor/formatters.ts` (`formatOperationalStaffName` / `formatOperationalStaffIdentity`),
  shared by both role floor models.
- **Status labels** come from the shared `operationalTableStatusLabels`.
- On table selection, both roles mount `OperationalTableWorkspaceFrame`; the frame
  is shared, the **contents differ by role** (Waiter → menu/order/reservation
  builder; Supervisor → read-first `SupervisorTableControlWorkspace`).

### 5b. Table display labels (owner-approved 2026-08-20)

Operational/demo labels can be long ("QA-P4-PASS2-1440"), which wrapped card titles
onto three lines. `floor/formatters.ts` now owns a **display-side** abbreviation.
The persisted label is **never** mutated; the full label always stays in `title`
and `aria-label`.

**Rule (deterministic):**

1. Labels of **≤ 7 characters** (`OPERATIONAL_TABLE_LABEL_MAX_CHARS`) are returned
   unchanged — "TD-01", "T-12", "BAR-3".
2. Longer labels split on `-`, `_`, `/`, `.` and whitespace.
3. If the LAST segment starts with a digit it is kept **whole** as the trailing
   number; otherwise there is no trailing number.
4. Each remaining (leading) segment collapses to its first character plus any
   digits it contains, in order: `QA→Q`, `P4→P4`, `PASS2→P2`.
5. The collapsed head is concatenated and joined to the tail with `-`.

| Full label | Display label |
| --- | --- |
| `TD-01` | `TD-01` (unchanged) |
| `QA-OPEN-01` | `QO-01` |
| `QA-P4-CLEAN-02` | `QP4C-02` |
| `QA-P4-PASS2-1440` | `QP4P2-1440` |
| `QA-PRE-BILL-01` | `QPB-01` |
| `TERRACELARGE12` (no separator) | `TER12` (≤3 leading letters + trailing digits) |

**Collision safety within one fetched set.**
`buildOperationalTableLabelMap(labels)` returns a Map keyed by the original label.
Colliding abbreviations are retried at a wider depth (2, then 3 characters per
segment); survivors are sorted ascending and the 2nd..nth get a `~n` suffix. Both
steps are order-independent, so the map is stable across re-renders. Example: with
`QA-OPEN-01` **and** `QA-OTHER-01` present, both escalate to `QAOP-01` / `QAOT-01`
rather than silently sharing `QO-01`.

`OperationalFloor` builds the map from the **full fetched set** (not the filtered
view) and passes it down through `OperationalTableGrid` → `OperationalTableCard`, so
a card's short label never changes while the operator types in the search box. All
three Floor-consuming roles get this for free.

**Other render sites** use the pure `formatOperationalTableLabel(label)`:
`waiter/floor/WaiterTableWorkspace`, `supervisor/floor/SupervisorTableControlWorkspace`,
`supervisor/floor/SupervisorTableTargetSelector`, `supervisor/floor/SupervisorSplitItemsDialog`,
`supervisor/reservations/SupervisorReservationTableSelect`,
`cashier/floor/CashierSelectedTablePanel`, `cashier/floor/CashierBillResolutionPanel`,
`cashier/floor/CashierFindBillDialog`, `cashier/resolution/CashierSplitItemsPanel`,
`cashier/resolution/CashierTransferTablePanel`.

**Invariant:** default Floor geometry (toolbar, grid, card height, breakpoints,
status/staff/label formatting) is identical across roles at every viewport. Any change
here propagates to all consuming roles by design.

## 6. Shared profile primitives

`components/profile/*` (+ `lib/profile/profile-model.ts`) provide the "Me" building
blocks: `RoleProfileHero`, `ProfileSection`, `ProfileMetaGrid`, `SessionCard`,
`ShiftStatusCard`, `OperationalStatusBadge`, `CapabilityNotice`,
`CompactUnavailableState`, plus `roleAccentMap`/`getRoleAccent`,
`getProfileInitials`, `formatProfileDateTime`. Consumed by all **four** role
`MeScreen`s (Manager joined in M-P1) — and the headers reuse `getProfileInitials`. Presentation is shared;
each role keeps its own queries/mutations/permissions. Long shifts are presented
truthfully (no fabricated durations).

## 7. States, tone, and semantics

- **Status colours** are semantic (available / occupied / reserved / blocked;
  neutral / info / success / warning / danger surfaces) via Tailwind tokens
  (`bg-status-*`, `text-text-*`, `shadow-*`). Do not hard-code hex.
- **Loading / empty / error** use shared primitives (`StatusMessage`,
  `OperationalFloorErrorState`, `CompactUnavailableState`) — keep presentation
  consistent across roles.
- **Manager-configured taxonomy** (menu navigation): honour manager order/active
  state; **never hard-code fallback categories**. An empty navigation shows an
  honest "manager configuration" empty state.
- **Currency:** UGX with zero-fraction rendering via the shared waiter currency
  formatter and branch currency context; money is Decimal strings end-to-end.

## 8. Interaction & accessibility

- Cards/buttons expose meaningful `aria-label`s (label + status + capacity) and
  `aria-pressed` for selection; visible and accessible labels must agree.
- Target a11y contrast; visible focus (`focus-visible` shadow). Respect reduced
  motion where animations are used.
- Table/order context is URL-backed so Back/Forward behave; no duplicate mounted
  responsive variants of the workspace.

## 8b. Supervisor Reservations master-detail workspace (Prompt 4B, 2026-07-28)

The old read-only Supervisor Reservations surface (six components:
`SupervisorReservationCard/List/Summary/Toolbar/DetailPanel/StatusBadge`) is
**removed** and replaced by a premium **master-detail** workspace under
`apps/web/src/components/supervisor/reservations/`. New components:

- `SupervisorReservationViewSelector` — switches the four UI **views** (Arriving,
  Seated, Attention, History; groupings, **not** new persisted statuses).
- `SupervisorReservationRow` — list row; shows the guest **name only** (no phone/
  email/raw ids — contact detail lives in the workspace/create form).
- `SupervisorReservationsDateToolbar` — operational-date + range navigation.
- `SupervisorReservationTableSelect` — bounded table picker for assign/seat.
- `SupervisorReservationWorkspace` — the detail pane (context, deposits read-only,
  lifecycle actions).
- `SupervisorCreateReservationDialog` — create form (optional `depositRequired`
  amount only; no payment/deposit capture).
- `SupervisorReservationLifecycleDialogs` — confirm/assign/seat/cancel/no-show/
  complete confirmations.

State is **URL-persisted** (view, date, page, status, from, to, selected id) so
Back/Forward/refresh are stable. Arriving/Seated/Attention derive from **one**
bounded `scope=active` query; History is a lazy `scope=history` query. Shared
shell/Floor/profile primitives and the locked nav (Floor · Reservations · Approvals
· Me) are **unchanged**; supporting logic lives in `lib/supervisor/reservations.ts`
(mutations, view grouping, attention derivation, action availability, cache
invalidation, date nav).

## 8c. Manager list / kanban / control-panel pattern (Track B3, 2026-08-20)

Track B1 shipped the Manager chrome primitives; **B3 is the first phase to mount
them**, and adds four more. All live in
`apps/web/src/components/manager/chrome/` and are **module-agnostic** — Operations
and Staff both consume them, and B4–B7 are expected to as well rather than
building their own.

### The primitives

| Component | Odoo reference | Rule it enforces |
| --- | --- | --- |
| `ManagerControlPanel` | C1 (`05`, `12`, `17`) | The pager takes an explicit `{from, to, total}`, **never an array** — a page length can never be presented as a record count. |
| `ManagerFilterChip` | C1 facet (`05`) | An applied filter is visible and removable, so a filtered list can never look like a complete one. |
| `ManagerSearchFilterMenu` | C15 (`15`) | Columns are **omitted** where the endpoint cannot back them: no Group By where the API cannot group; Favorites is labelled terminal-only (NG-11 / OD-7). |
| `ManagerListTable` | C4 (`05`) | Right-aligned numerics, status pill, optional-column gear, totals row. **No leading checkbox** — Nimbus has no bulk action, and the roadmap says omit rather than decorate. |
| `ManagerStatusPipeline` | C14 (`06`, `09`) | Stages are the **real backend lifecycle**, never a borrowed one. A record off the pipeline (voided order, terminated employee) renders an **exit chip**, not a forced stage. Presentation only — unlike Odoo's, no stage is clickable. |
| `ManagerViewSwitcher` | C1 view group (`05`, `12`) | Advertises **only renderable views**. Graph and pivot are absent, not disabled — they are impossible until `GET /api/reports/:id` returns rows (C-03 / NG-06). |
| `ManagerRecordActionsMenu` | C13 (`11`) | Renders **nothing at all** when there is no action. Disabled entries must state *why*. |
| `ManagerBreadcrumbs` | C1 record pager (`06`) | Parent link + record identity + a pager that walks the **current list page**. |

### Rules for any future Manager list surface

1. **Bound every request explicitly.** `/pos/orders`, `/hr/employees` and `/reports`
   have no server-side `@Max` (MP0-11 / C-12); the client always names its own bound.
2. **Feed the pager the endpoint's own `total`.** If the endpoint returns no total,
   the surface may not show a pager.
3. **A totals row is a PAGE total unless the endpoint returns an aggregate**, and
   the copy must say which. `sumManagerPageMoney` returns `null` when any row is
   unreadable — a partial sum shown as a total is worse than an honest gap.
4. **The chip-search box renders an input only where the endpoint has a text
   search.** Where it does not (`/pos/orders`, `/api/reservations`, `/hr/leave`,
   `/hr/shift-swaps`), the box hosts the chips and the filter menu and the input is
   **omitted, never greyed out** — a disabled search field advertises a capability
   the backend does not have.
5. **Validate every URL-borne filter against the endpoint's own enum** before
   sending it, so a hand-edited query string fails safe instead of 400-ing the page.
6. **Read-only is a property of a SURFACE, not of the workspace.** B3 removed the
   M-P1 global "Read-only oversight" badge from the readiness strip: it became false
   the moment Staff shipped a **New** button. Each read-only surface states its own
   contract in its control panel.
7. **Project list payloads at the API-client boundary**, not at render. See
   `lib/manager/staff-projection.ts` — an **allow-list**, because `/hr/leave` and
   `/hr/shift-swaps` embed full employee PII that a render-time whitelist cannot
   keep out of the React Query cache.

### Kanban (C7, screenshot `12`)

`ManagerEmployeeKanban` is a Staff-specific consumer, not a shared primitive
(nothing else has cards yet). Its rules: a deterministic avatar colour derived from
the employee code using the **four B2 chart tokens** — no new palette, no random
colour; **no photo placeholder** (Nimbus stores no employee image); and the last row
is the **hire date**, not Odoo's contract window, because contracts are excluded from
the Manager workspace.

## 8d. Rendering an API payload you did not design (Track B4, 2026-08-20)

Reports renders **~90 distinct summary keys across 24 generators** into one panel.
That is a different problem from a hand-built screen, and B4 established two rules
for it that any future surface over a generic payload must follow.

### Fail-safe value classification

A value is formatted as **money only if its key is on an explicit list** built by
reading live responses. Anything unrecognised renders as plain text with a
humanised label. The tempting alternative — a `/total|amount|sales/i` regex —
would have formatted `conversionRate` and `noShowRate` as currency.

The cost of the safe default is that a new backend field looks unpolished. The
cost of the unsafe one is a **mislabelled number**, which is the single defect
class this workspace has already shipped once (**B3-D1**) and must not ship again.

Money labels state their basis. `grossSales` → *"Sales (tax-inclusive)"*,
`netSales` → *"Sales (ex-tax)"*. **A bare "Gross"/"Net" is forbidden** anywhere in
the Manager workspace.

### Curated columns, mirroring the export

Where a payload carries an array, do **not** render "every key on the first
array". B4's first attempt did, and produced a live mislabel: `grossSales` is
`SUM(order.total)` (tax-inclusive) at the top level of a summary but
`SUM(orderItem.subtotal)` (**ex-tax**) inside `topItems[]` and `categories[]` —
the same field name with two tax bases in one payload (**B4-F2**).

So each report declares its own columns, and those columns **mirror that report's
CSV header**. Three things follow: labels can state the right basis per depth, raw
identifiers (`menuItemId`, `categoryId`) stay out because the export omits them
too, and the on-screen claim *"these rows are what the CSV contains"* is literally
true rather than approximately true.

### Never fabricate rows from a count

`rowCount` is each generator's count of the source records it aggregated — 219 for
SALES_BY_HOUR, **whose export is 24 rows**. It is labelled *"Records aggregated"*
with a sentence saying it is not the export's line count, and no table may be
derived from it.

## 9. Known UI inconsistencies (recorded, not yet fixed)

These are functional/architectural inconsistencies out of scope for a UI-polish
pass (they touch session/auth behaviour or cross-role refactors). See
`docs/KNOWN_LIMITATIONS.md` §UI.

> **2026-08-20 — this section is now empty of live issues.** Both bullets below were verified
> against the worktree during the Supervisor docs audit and are **stale**; both are struck through
> with a dated correction rather than deleted. Section heading kept as-is for stable anchors.

- ~~**Supervisor shell omits the idle-logout handler** that Waiter and Cashier both
  inject — supervisor sessions do not auto-logout on idle. (Auth-behaviour change;
  document, do not silently patch.)~~
  **RESOLVED — stale claim corrected 2026-08-20 (code wins).** `SupervisorShell`
  **does** inject the shared handler: `apps/web/src/components/supervisor/shell/SupervisorShell.tsx`
  passes `idleHandler={<OperationalIdleLogoutHandler />}` to `OperationalShell`, exactly like
  Waiter and Cashier. Supervisor sessions **do** auto-logout on idle
  (→ `/login?reason=idle_timeout`). This bullet described the pre-Prompt-3A shell and was never
  updated. It already contradicted `docs/KNOWN_LIMITATIONS.md` (which records the fix as
  *"Supervisor idle-logout parity (was SUP-RG-020)"*), `docs/supervisor-ui-docs/SUPERVISOR_LIFECYCLE.md`
  (*"Supervisor sessions share the operational idle-logout mechanism"*), and `CLAUDE.md` §11
  (*"All three roles share one idle-logout mechanism (`pos-shell/idle`)"*) — all three were
  correct; this file was the outlier.
- ~~**Cross-role idle naming**: the shared `OperationalIdleLogoutHandler` and the
  cashier handler consume waiter-namespaced constants (`WAITER_IDLE_TIMEOUT_MS`
  etc.). Behaviour-correct but a naming/coupling smell for a future rename.~~
  **RESOLVED — stale claim corrected 2026-08-20 (code wins).** The constants were renamed to the
  shared `apps/web/src/components/pos-shell/idle.ts` namespace — `OPERATIONAL_IDLE_TIMEOUT_MS`
  (15 min) and `OPERATIONAL_ACTIVITY_EVENTS` — and `OperationalIdleLogoutHandler` imports them
  from there. `WAITER_IDLE_TIMEOUT_MS` survives only as a one-line back-compat re-export in
  `lib/waiter/idle.ts`; no handler consumes a waiter-namespaced constant.
