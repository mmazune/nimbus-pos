# DESIGN.md — Nimbus POS Manager Workspace Design System Extension

Status: Draft v1  
Date: 2026-07-06  
Extends: global Nimbus POS `DESIGN.md`  
Role: Manager  
Primary surface: **desktop-first branch-management POS console**

## 1. Purpose

This file extends the global Nimbus POS design system for Manager-specific branch operations, reports, staff, approvals, settings, and device metadata workflows.

The Manager UI has more breadth than Waiter, Cashier, and Supervisor. It must be dense and powerful without becoming noisy, admin-like, or financially unsafe.

## 2. Manager mood

Manager workspace should feel:

- premium;
- executive-operational;
- branch-aware;
- calm under pressure;
- financially credible;
- privacy-conscious;
- fast for high-frequency actions;
- strict around approvals and HR operations.

Manager workspace should not feel:

- playful;
- generic SaaS dashboard;
- accountant ledger;
- payroll system;
- Owner/Admin portal;
- checkout terminal;
- waiter floor clone;
- fake hardware simulator.

## 3. Palette usage

Use global tokens only.

| UI area | Token usage |
|---|---|
| Header | `--color-brand-navy-950` |
| Active bottom nav / primary action | `--color-brand-navy-900` |
| Page background | `--color-page-bg` |
| Cards/panels/drawers | `--color-surface`, `--color-surface-raised` |
| Secondary controls | `--color-surface-muted`, graphite text |
| Sales / positive KPI | success tokens, but not overused |
| Warnings / pending approvals / low stock | warning tokens |
| Denied / anomaly / variance / failed export | danger tokens |
| Deferred / stub / metadata-only | neutral tokens |
| Branch context | info/neutral tokens |

No arbitrary colors. No rainbow dashboards.

## 4. Typography

Use Inter Variable or existing app fallback. Use tabular numbers for:

- UGX totals;
- sales;
- net/gross values;
- order counts;
- till balances;
- cash variance;
- refund/discount totals;
- report counts;
- attendance counts;
- device counts;
- branch IDs where shown;
- times/dates.

| Element | Guidance |
|---|---|
| Page title | `text-2xl`, 600/700 |
| Dashboard KPI value | numeric-xl, 700 |
| Card title | `text-sm` or `text-base`, 600 |
| Dense table cell | `text-sm`, 500 |
| Detail drawer headings | `text-base`, 700 |
| Caveats/blocked reasons | `text-sm`, 500/600 |
| Financial warnings | clear, medium weight, not tiny |

No thin weights. No decorative serif fonts. No giant dashboard typography that wastes POS screen space.

## 5. Layout principles

Manager pages are data-rich. Use:

- two-column layouts at desktop when helpful;
- sticky filters only when valuable;
- dense tables for operational lists;
- cards for KPI summaries;
- side drawers for details;
- modals only for risky confirmations;
- collapsible sections for high-density secondary data;
- route-level skeletons that match final layout.

Desktop target:

- 1280×800 minimum usable;
- 1440×900 preferred;
- shared POS terminal with touch/mouse.

Mobile/narrow fallback:

- responsive card stacks;
- bottom nav remains usable;
- branch switcher remains accessible;
- dense tables collapse into cards.

## 6. Interaction laws and principles

Apply these because Manager actions affect money, staff, and branch settings:

- **Fitts’s Law**: risky action buttons are easy to target but separated from safe controls.
- **Hick’s Law**: nav stays to 6 core areas; secondary actions live inside page sections.
- **Proximity**: metrics, filters, and detail panels group by operational domain.
- **Jakob’s Law**: use familiar enterprise POS patterns: dashboard cards, operational lists, side drawers, confirmations.
- **Tesler’s Law**: backend complexity must surface as clear states, not fake success.
- **Error prevention**: confirm approval, refund, void, branch setting, Quick PIN, and device writes.
- **Recognition over recall**: status chips and caveat cards explain what actions mean.
- **Immediate feedback**: every write shows in-flight, success, and failure.

## 7. Manager shell layout

Header height: 64–72px. Bottom nav height: 78–86px. Main padding: 20–24px desktop, 14–16px narrow.

Header:

- left: brand/logo and workspace label `Manager`;
- branch selector;
- organization/branch chips;
- active branch status;
- optional current time;
- right: Manager avatar/name, session status, logout.

Readiness strip:

- branch context;
- active tills;
- active shifts;
- pending approvals;
- report generator health if available;
- device metadata health if available.

Bottom nav:

1. Overview
2. Operations
3. Staff
4. Reports
5. Settings
6. Me

Six tabs are acceptable for Manager because this role is broader than Waiter/Cashier/Supervisor. Labels must remain short and non-wrapping.

## 8. Dashboard card rules

Dashboard cards show:

- title;
- value;
- unit/currency;
- comparison only if backend returns it;
- timestamp/source;
- branch context;
- status/caveat where needed.

Do not fake:

- historical comparisons;
- growth percentages;
- projected sales;
- forecasts;
- stale live stream success.

## 9. Tables and lists

Use tables for:

- orders;
- tills;
- shifts;
- employees;
- reports;
- approvals;
- devices.

Rules:

- sticky header where useful;
- row click opens detail drawer;
- status not color-only;
- IDs truncate safely;
- money values tabular;
- no horizontal overflow at 1280px;
- narrow viewport switches to cards.

## 10. Detail drawers

Use side drawers for:

- order detail;
- employee detail;
- approval detail;
- report run detail;
- device detail;
- branch setting detail.

Drawer width:

- 480–560px for standard details;
- 640–760px for reports and settings forms;
- full-screen fallback on narrow viewport.

Drawer must show:

- identity;
- context;
- status;
- data sections;
- action boundary;
- audit/caveat if relevant.

## 11. Confirmation patterns

Required confirmation for:

- approval decide;
- refund approve/reject;
- discount approve/reject;
- post-close void;
- leave review;
- shift swap approval;
- Quick PIN reset/disable/enable;
- employee create/update;
- report generation if costly;
- report export;
- branch settings update;
- device activate;
- printer route update;
- terminal pairing.

Confirmation must say:

- what will happen;
- branch affected;
- target entity;
- whether action can be undone;
- whether hardware/provider is stub-only.

## 12. Loading and state copy

Use skeletons for dashboard cards, operations tables, staff list, reports list, settings panels, and Me profile.

Empty examples:

- Overview: `No manager metrics are available for this branch yet.`
- Operations: `No active operations found for this branch.`
- Staff: `No staff records match this filter.`
- Reports: `No report runs found for this branch.`
- Settings: `No registered devices found for this branch.`
- Approvals: `No pending approvals for this branch.`

Blocked examples:

- `Select a branch to continue.`
- `This report generator is unavailable in the local environment.`
- `Compensation fields are excluded from Manager MVP.`
- `Terminal pairing is stub-only; no acquirer traffic will occur.`
- `Printer routes are metadata-only; no print driver is invoked.`
- `This action requires Manager permission and branch context.`

## 13. Accessibility

Minimum:

- text contrast 4.5:1;
- visible focus rings;
- 44px minimum touch targets;
- 48px preferred for primary writes;
- keyboard reachable nav, branch selector, filters, tables, drawers;
- status text plus color;
- accessible labels on icon buttons;
- reduced-motion-friendly updates;
- modals trap focus and restore focus after close;
- no content hidden by fixed nav at narrow viewport.

## 14. Icons

Use Phosphor Icons only. Icons use `currentColor`.

Suggested:

- Overview: `ChartLineUp`, `Gauge`
- Operations: `SquaresFour`, `ListChecks`, `Storefront`
- Staff: `UsersThree`, `IdentificationBadge`
- Reports: `FileText`, `ChartBar`, `DownloadSimple`
- Settings: `GearSix`, `SlidersHorizontal`
- Me: `UserCircle`
- Branch switcher: `MapPin`, `CaretDown`
- Approvals: `Stamp`, `CheckCircle`, `XCircle`
- Devices: `DesktopTower`, `Printer`, `CreditCard`
- Warning/caveat: `WarningDiamond`

No random icons. No decorative icons inside dense lists unless they improve scanning.

## 15. Safety boundaries in visual language

- Stub/hardware actions must use neutral/warning styling, never success.
- Report export unavailable must be warning/failure, never fake download.
- Pending approvals must be pending/warning until backend confirms decision.
- Compensation deferred cards must clearly state they are excluded from MVP.
- Device pairing must not look like real acquirer connectivity.
