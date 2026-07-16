# DESIGN.md — Nimbus POS / ChefCloud Global Design System

Status: Draft v2 for Waiter MVP and future role workspaces  
Date: 2026-06-16  
Owner: Product + Design + Frontend  
Applies to: all Nimbus POS / ChefCloud client surfaces  
Companion role file: `waiter_design.md`

---

## 1. Purpose and authority

This file is the global visual, interaction, and component contract for Nimbus POS / ChefCloud.

It prevents the application from becoming inconsistent, generic, or vibe-coded as Codex begins frontend work.

Role-specific files extend this file. They must not contradict it.

### File hierarchy

1. `AGENTS.md` — agent execution rules.
2. `DESIGN.md` — global visual system, tokens, layout, accessibility, component rules.
3. `waiter_design.md` — waiter role-specific design contract.
4. `waiterui.md` — waiter screen blueprint.
5. `WAITER_LIFECYCLE.md` — waiter operational lifecycle and edge cases.
6. API docs/Postman — source of truth for callable backend behavior.

---

## 2. Product design position

Nimbus POS is a premium enterprise-grade hospitality POS. It is built for restaurants, bars, lounges, multi-branch operators, and franchise-grade F&B teams.

It is not a generic admin dashboard.

### Global mood

- Premium enterprise POS.
- Clean restaurant operations.
- Calm but fast.
- Professional enough for owners and accountants.
- Touch-friendly enough for waiters, cashiers, chefs, and bartenders.
- Reliable enough for rush periods.

### Must feel like

- professional;
- stable;
- quick;
- legible;
- premium;
- controlled;
- operational.

### Must not feel like

- a social media app;
- a playful delivery app;
- a gaming UI;
- a neon/purple SaaS dashboard;
- a glassmorphism experiment;
- a generic admin template;
- a marketing website inside POS.

---

## 3. Non-negotiable UI rules

1. No emojis in product UI labels, buttons, nav, cards, dialogs, status tags, tables, or empty states.
2. No generic purple/pink/blue gradients.
3. No glassmorphism, frosted panels, random transparency stacks, or blurred cards.
4. No hardcoded hex values inside components after tokens are implemented.
5. No mixed icon families.
6. No fake live provider states.
7. No action shown unless role and backend contract allow it.
8. No frontend-only business state that conflicts with backend state.
9. No public diner mobile-money UI that implies live MTN/Airtel checkout until provider confirmation and backend execution exist.
10. Receipt send must show pending/no live adapter until the backend has a live adapter.
11. Printer routes remain metadata-only unless backend print-driver invocation exists.
12. Terminal pairing remains stub-only unless real acquirer/card-terminal traffic exists.
13. No spinner-only full-page loading when skeletons can represent incoming content.
14. No vague error copy without recovery action.
15. No destructive action without confirmation.
16. No disabled critical action without reason.
17. No overly decorative food photography inside operational POS surfaces unless explicitly approved.
18. No table combine/uncombine UI in waiter MVP.

---

## 4. Brand palette

The current working palette was extracted from the latest Nimbus POS visual reference image. Values are production candidates and should be reviewed in Figma before final lock.

### 4.1 Core brand tokens

| Token | Value | Use |
|---|---:|---|
| `--color-brand-navy-950` | `#0B1524` | Deepest header/sidebar/background. |
| `--color-brand-navy-900` | `#101F34` | Primary brand dark, active bottom nav, key reversed actions. |
| `--color-brand-navy-800` | `#273343` | Secondary dark surface, hover on dark. |
| `--color-brand-white` | `#FFFFFF` | Primary surface and inverse text. |
| `--color-brand-silver` | `#ACABA9` | Premium neutral accent, secondary buttons, disabled fills. |
| `--color-brand-graphite` | `#616367` | Secondary text, muted status, dark grey controls. |

### 4.2 Extended neutrals

| Token | Value | Use |
|---|---:|---|
| `--color-page-bg` | `#F6F7F9` | App page background. |
| `--color-surface` | `#FFFFFF` | Cards, dialogs, tables, panels. |
| `--color-surface-raised` | `#FFFFFF` | Elevated panels and drawers. |
| `--color-surface-muted` | `#ECECEC` | Skeletons, toolbar background, disabled quiet areas. |
| `--color-surface-navy` | `#101F34` | Dark header, selected nav, high-emphasis bottom bar. |
| `--color-border-subtle` | `#E3E5E8` | Cards, inputs, dividers. |
| `--color-border-strong` | `#B8BCC2` | Active/selected neutral border. |
| `--color-text-primary` | `#101828` | Main text. |
| `--color-text-secondary` | `#4B5563` | Secondary text. |
| `--color-text-muted` | `#6B7280` | Metadata and disabled text. |
| `--color-text-inverse` | `#FFFFFF` | Text on navy/dark. |
| `--color-focus-ring` | `#101F34` | Keyboard focus ring. |
| `--color-skeleton-base` | `#ECECEC` | Skeleton base. |
| `--color-skeleton-highlight` | `#F7F7F7` | Skeleton shimmer. |

### 4.3 Functional status palette

The core brand palette is intentionally restrained. Functional states require approved complementary tokens.

| Token | Value | Use |
|---|---:|---|
| `--color-status-success` | `#1F8A5B` | Available, seated, paid, synced, successful. |
| `--color-status-success-surface` | `#EAF7F1` | Success badge/banner surface. |
| `--color-status-warning` | `#D19822` | Reserved, pending, bill requested, shift warning. |
| `--color-status-warning-surface` | `#FFF6DF` | Warning badge/banner surface. |
| `--color-status-danger` | `#D1495B` | Failed, destructive, denied, void/refund risk. |
| `--color-status-danger-surface` | `#FDECEF` | Danger badge/banner surface. |
| `--color-status-info` | `#2F6FBA` | In progress, sent, active service, informational. |
| `--color-status-info-surface` | `#EAF2FF` | Info badge/banner surface. |
| `--color-status-neutral` | `#616367` | Closed, inactive, secondary statuses. |
| `--color-status-neutral-surface` | `#F1F2F4` | Neutral badge/banner surface. |

### 4.4 Brand color usage rules

#### Navy

Use for:

- header;
- active bottom nav item;
- primary action;
- selected state border;
- focus ring;
- login shell identity;
- high-trust surfaces.

Do not use for:

- every icon;
- warnings;
- destructive states;
- body text on dark without contrast checks.

#### Silver and graphite

Use for:

- secondary buttons;
- metadata;
- quiet controls;
- disabled states;
- premium neutral accents.

Do not use for:

- critical statuses;
- primary action;
- long low-contrast text.

#### Amber/warning

Use for:

- Reserved;
- pending;
- bill requested;
- shift not started;
- receipt send pending.

Do not use for:

- errors;
- paid states;
- every badge.

---

## 5. Typography

### 5.1 Recommended font stack

| Role | Font |
|---|---|
| UI/body | `Inter Variable` |
| Numeric | `Inter Variable` with tabular numbers |
| Fallback | `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` |
| Monospace/debug | `IBM Plex Mono` or `ui-monospace, SFMono-Regular, Menlo, monospace` |

Reason:

- Inter is designed for computer screens, has a tall x-height, and supports tabular numbers.
- This is ideal for POS prices, timers, totals, table numbers, and dense terminal UI.
- Decorative serif headings are not allowed in waiter/cashier/KDS workspaces.

### 5.2 Type scale

| Token | Size | Weight | Line height | Use |
|---|---:|---:|---:|---|
| `text-xs` | 12px | 400/500 | 16px | Metadata, badge labels. |
| `text-sm` | 14px | 400/500 | 20px | Secondary body, helper text. |
| `text-base` | 16px | 400/500 | 24px | Default body. |
| `text-lg` | 18px | 500/600 | 28px | Card titles. |
| `text-xl` | 20px | 600 | 28px | Section headers. |
| `text-2xl` | 24px | 600/700 | 32px | Page/workflow titles. |
| `text-3xl` | 30px | 700 | 38px | Login and terminal headings. |
| `numeric-md` | 16px | 600 | 24px | Totals, quantities. |
| `numeric-lg` | 20px | 700 | 28px | Running totals. |
| `numeric-xl` | 24px | 700 | 32px | Big POS total/clock if needed. |

### 5.3 Typography rules

1. Use sentence case for UI labels.
2. Use tabular numbers for all operational numerics.
3. Do not use thin weights in POS workspaces.
4. Do not use all caps for long labels.
5. Never rely on color alone for status.
6. Use short labels for frontline roles.

---

## 6. Icon system

Nimbus uses **Phosphor Icons** for all new frontend work.

### Rules

- Use `@phosphor-icons/react` or a single approved Iconify Phosphor mapping.
- Use `currentColor`.
- Default weight: `regular`.
- Active nav weight: `fill` or `duotone`, chosen consistently.
- Empty/success/failure illustrations may use `duotone`.
- Do not mix icon families.
- Do not use emojis as icons.

### Icon sizes

| Context | Size |
|---|---:|
| Metadata icon | 16px |
| Inline icon | 18px |
| Button leading icon | 20px |
| Header icon | 20–22px |
| Bottom nav icon | 24px |
| POS touch action icon | 24px |
| Empty/failure/success state | 56–96px |

---

## 7. Layout system

### 7.1 Desktop targets

| Target | Size |
|---|---:|
| Base design canvas | 1440 × 900 |
| Minimum supported desktop | 1280 × 800 |
| Large desktop | 1920 × 1080 |
| POS terminal mode | Fullscreen browser/window |
| Minimum touch target | 44 × 44px |
| Preferred POS touch target | 48 × 48px |

### 7.2 Global shell patterns

#### Backoffice shell

Use:

- left sidebar;
- top app bar;
- page header;
- cards/tables/forms.

#### Frontline POS shell

Use:

- fixed top header;
- main operational canvas;
- fixed bottom nav;
- large touch targets;
- reduced administrative chrome.

#### KDS shell

Use:

- fullscreen board;
- large tickets;
- urgency-first display.

---

## 8. Spacing scale

| Token | Value | Use |
|---|---:|---|
| `space-1` | 4px | Micro gap. |
| `space-2` | 8px | Chips, icon gaps. |
| `space-3` | 12px | Compact padding. |
| `space-4` | 16px | Default padding. |
| `space-5` | 20px | POS card content. |
| `space-6` | 24px | Page padding. |
| `space-8` | 32px | Section spacing. |
| `space-10` | 40px | Major layout gaps. |
| `space-12` | 48px | Login/empty states. |

---

## 9. Radius and elevation

### Radius

| Token | Radius | Use |
|---|---:|---|
| `radius-xs` | 4px | Tiny badges. |
| `radius-sm` | 8px | Inputs, chips. |
| `radius-md` | 12px | Buttons, menu cards. |
| `radius-lg` | 16px | Table cards, panels. |
| `radius-xl` | 20px | Dialogs, drawers. |
| `radius-2xl` | 24px | Login container only. |
| `radius-full` | 999px | Pills, avatar, nav active pill. |

### Elevation

| Token | Use |
|---|---|
| `shadow-none` | Tables, flat panels. |
| `shadow-subtle` | Table cards/menu cards on light background. |
| `shadow-panel` | Order panel, sticky toolbar. |
| `shadow-overlay` | Dialogs, drawers, sheets. |

No heavy random shadows.

---

## 10. Navigation rules

### Bottom nav

Use only for frontline workflows.

Rules:

- 3–5 items maximum.
- Icon + label.
- Active item uses navy selected state.
- No nested hidden menus.
- No Menu tab for waiter MVP.
- No badges unless operationally meaningful.

### Tabs/filter chips

Use for local status filters only, for example:

- table filters;
- order filters;
- reservation filters.

---

## 11. Buttons

### Types

- Primary filled.
- Secondary outlined.
- Tertiary/text.
- Danger.
- Icon button.
- Button group/filter chips.

### Sizes

| Context | Height |
|---|---:|
| Compact | 36px |
| Standard | 40px |
| POS primary action | 48px |
| POS confirm/destructive | 48–56px |
| Icon button | 40×40px |
| POS icon button | 48×48px |

Rules:

- One primary action per focused panel.
- Destructive actions must not use navy or amber.
- Disabled actions must show a reason.
- POS primary actions need visible text labels.

---

## 12. Cards, lists, and tables

### Cards

Use for:

- table cards;
- menu item cards;
- order cards;
- reservation cards;
- status/empty/failure cards.

Card rule:

- one clear purpose per card;
- no mini-dashboard cards inside waiter screens.

### Lists

Use for:

- orders;
- reservations;
- receipt history;
- Me utilities.

List row rule:

- clear title;
- metadata;
- status;
- primary click/tap behavior.

### Tables

Use in backoffice. Avoid dense data tables in waiter MVP.

---

## 13. Drawers, dialogs, sheets, menus

### Drawers

Use for:

- receipt detail;
- order detail if launched from a list;
- blocked info panels where helpful.

### Dialogs

Use for:

- confirmation;
- blocked reason;
- destructive action.

### Sheets/panels

Use for:

- modifiers;
- item note/edit;
- request bill;
- leave/swap request.

---

## 14. Loading and feedback

Skeletons are default.

Use skeletons for:

- table grid;
- order list;
- menu grid;
- receipt drawer;
- reservation list;
- Me profile card.

Use inline progress for:

- sending order;
- starting shift;
- requesting bill;
- reprinting receipt;
- seating guest.

Avoid full-page spinners.

---

## 15. Required state screens

Every major surface must handle:

- loading;
- empty;
- success;
- failure;
- blocked;
- offline/degraded.

Blocked state examples:

- shift not open;
- order owned by another waiter;
- permission denied;
- maintenance active;
- receipt send pending;
- unsupported action.

---

## 16. Accessibility

Minimum requirements:

- normal text contrast: 4.5:1;
- large text contrast: 3:1;
- component boundaries: 3:1;
- visible keyboard focus;
- accessible labels on icon buttons;
- status not color-only;
- 44px minimum touch target;
- reduced motion support;
- readable on 1280×800 shared terminal.

---

## 17. Caveat tags

These exact caveat labels must exist globally:

| Label | Use |
|---|---|
| `PENDING — no live email/SMS/WhatsApp adapter` | Receipt send. |
| `Metadata only — no print-driver invocation` | Printer route configuration. |
| `STUB — no live hardware traffic` | Terminal pairing. |
| `CRITICAL — PENDING MTN/AIRTEL PROVIDER CONFIRMATION` | Public diner mobile-money execution. |
| `Training mode` | Simulated operations. |
| `Maintenance` | Blocked writes. |

---

## 18. Component naming conventions

Global:

- `AppShell`
- `RoleRouter`
- `PermissionGate`
- `StatusBadge`
- `SkeletonGrid`
- `EmptyStateCard`
- `FailureStateCard`
- `BlockedStatePanel`
- `ReceiptDrawer`

Waiter:

- `WaiterShell`
- `WaiterHeader`
- `WaiterBottomNav`
- `WaiterTableCard`
- `WaiterOrderBuilder`
- `WaiterOrderPanel`
- `WaiterReceiptDrawer`
- `WaiterReservationsScreen`
- `WaiterMeScreen`

---

## 19. Acceptance criteria

The design system is acceptable when:

1. All colors use tokens.
2. Waiter MVP uses the brand navy/silver/white/graphite palette.
3. Functional status colors are tokenized.
4. Inter is used for UI and tabular numeric data.
5. Phosphor icons are used consistently.
6. No emojis, generic gradients, glassmorphism, or mixed icon families appear.
7. All states have loading/empty/failure/blocked patterns.
8. Every visible action is backed by backend permission and state.
