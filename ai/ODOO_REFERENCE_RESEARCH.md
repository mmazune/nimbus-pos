# Odoo Reference Research — Manager/Owner Enterprise UI

**Date:** 2026-08-20
**Source instance:** `https://marucredit.techthings.dev/odoo` — tenant **MARU CREDIT LIMITED** (Uganda, UGX/USh), Odoo 18-era web client, **dark theme**.
**Method:** live read-only exploration through the owner's authenticated Chrome session (MCP tab `2054088319`). Menus opened, list/form views opened read-only. **No record was created, edited, saved, confirmed or deleted.**
**Screenshots:** `ai/odoo-reference-screenshots/` (17 files, referenced inline below).

> **Honesty note.** Every menu item, button label and column header in this document was read off a screenshot taken during this session. Where a surface was *not* opened, it is explicitly marked **(not opened)** rather than guessed. Colour hexes are **visual approximations** from zoomed screenshots — no computed-style sampling was performed.

---

## 1. Global navigation model

### 1.1 Apps grid (home)

`/odoo` renders a full-bleed dark app launcher: a centred 6-column grid of 88×88px rounded-square icon tiles with the app name beneath, on a near-black radial-gradient background. Top-right cluster is present even here. Screenshot: `01-apps-grid.jpg`.

**All 21 installed apps** (read verbatim, row order):

| Row | Apps |
|-----|------|
| 1 | Purchase Requisitions · Discuss · Calendar · Contacts · CRM · **Maru Operations** *(custom app)* |
| 2 | Dashboards · **Accounting** · **Training Management** *(custom)* · Documents · Website · Purchase |
| 3 | Inventory · Barcode · Employees · Payroll · Appraisals · Recruitment |
| 4 | Time Off · Apps · Settings |

Notably **absent**: Point of Sale, Sales, Manufacturing, Project, Helpdesk, Field Service. This is a finance/HR-weighted install, which is exactly why the owner reads it as the "enterprise" reference.

### 1.2 Per-module top nav bar

Once inside a module the app launcher collapses to a **single 46px-tall top bar**, structured left→right:

```
[⋮⋮ app icon] [Module Name (bold)] [ menu · menu · menu … ]        [💬 5] [🕐] [✕ Studio] [COMPANY NAME] [avatar●]
```

- The **app icon at far left is the "home menu" control** (`link "Home menu" href="/odoo"`) — clicking it returns to the apps grid. It is *not* a separate hamburger; the grid icon and module name form one unit.
- Menu items are plain text, ~13px, generous horizontal padding (~16px), no separators. Active/open item gets a subtle rounded outline box.
- **Accounting** top nav: `Dashboard · Customers · Vendors · Accounting · Review · Reporting · Configuration`
- **Settings** top nav: `General Settings · Users & Companies`
- **Employees** top nav: `Employees · Departments · Learning · Reporting · Configuration`

### 1.3 Submenu behaviour

Submenus are **click-to-open dropdowns** (hover alone does not open them; once one is open, moving across the bar swaps between them). They are left-aligned under their trigger, dark panel with 1px border, ~250–330px wide, and **internally grouped by uppercase-ish muted section headers** with the actual items indented beneath. Long menus (Review, Reporting) **scroll inside the dropdown** rather than growing the page. `Escape` closes them.

### 1.4 FULL Accounting submenu tree (all 6 menus, every item)

**Customers**  *(flat, no section headers)*
- Invoices
- Credit Notes
- Payments
- Products
- Customers

**Vendors**  *(flat)*
- Bills
- Expense
- Refunds
- Payments
- Products
- Vendors

**Accounting**
- *Transactions*
  - Journal Entries
- *Assets & Liabilities*
  - Assets
  - Loans
- *Closing*
  - Reconcile
  - Tax Returns
  - Lock Dates…

**Review**  *(scrolling dropdown)*
- *Control*
  - Journal Items
  - Journal Audit
- *Audit*
  - Working Files
- *Inventory*
  - Inventory Valuation
  - Depreciation Schedule
  - Loans Analysis
- *Regularization Entries*
  - Unrealized Currencies
  - Deferred Revenues
  - Deferred Expenses
- *Purchases*
  - Bill To Receive
  - Billed Not Received
- *Logs*
  - Audit Trail

**Reporting**  *(scrolling dropdown — screenshot `03-accounting-menu-reporting.jpg`)*
- *Statement Reports*
  - Balance Sheet
  - Profit and Loss
  - Cash Flow Statement
- *Ledgers*
  - Trial Balance
  - General Ledger
- *Partner Reports*
  - Partner Ledger
  - Aged Receivable
  - Aged Payable
- *Taxes & Fiscal*
  - Tax Report
  - Fiscal Report
- *Management*
  - Invoice Analysis
  - Analytic Report
  - Executive Summary

**Configuration**  *(screenshot `04-accounting-menu-configuration.jpg`)*
- Settings  *(ungrouped, first item)*
- *Accounting*
  - Chart of Accounts
  - Taxes
  - Journals
  - Currencies
  - Fiscal Positions
  - Multi-Ledger
  - Checks
  - Asset Models
- *Invoicing*
  - Payment Terms
  - Follow-up Levels
  - Product Categories
- *Online Payments*
  - Payment Providers
  - Payment Methods

**Total: 5 + 6 + 6 + 13 + 13 + 15 = 58 leaf menu items in one module.**

### 1.5 Control panel row (New + title + search)

Directly under the top nav, one 44px row — this is the single most re-usable pattern in the whole client:

```
[New] [Upload]  Title ⚙        [🔍 (filter-chip) (filter-chip)✕ Search… ▾]        1-6/6 ‹ ›   [▤ ▦ 🕐 ⚗ 📊 ▦]
   └ left: primary actions   └ centre: search       └ right: pager   └ far right: view switcher
```

- **Left:** purple `New` primary button, optional secondary (`Upload`), then the view **title** with a small **cog (⚙)** beside it — the view's own Actions menu.
- **Centre:** a pill-shaped search box. Applied filters render as **chips inside the box** — a funnel icon then e.g. `Favorites ✕`, `Invoices or Receipts ✕`, `Internal Users ✕`. The chip's `or`/`and` conjunction is rendered in muted italic between facet values.
- The `▾` at the right of the search box opens the **three-column mega-dropdown** (`15-search-dropdown-filters-groupby-favorites.jpg`):
  - **Filters** (funnel icon) — predefined filters separated by thin divider rules into semantic clusters; date filters carry their own `▾` sub-expander; ends with `Archived` and `Custom Filter…`
  - **Group By** (layers icon) — groupable fields; date fields expand to granularity; ends with `Properties ▾` and `Custom Group ▾`
  - **Favorites** (star icon) — `Save current search ▾`
- **Right:** pager `1-6 / 6` with prev/next chevrons, then the **view-type switcher** (icon toggle group). Employees exposes six: Kanban, List, Hierarchy, Activity, Graph, Pivot.

### 1.6 Breadcrumbs

On a record, the title area becomes a two-line breadcrumb: parent view as a **teal link** on line 1, current record name in white on line 2 with its cog beside it. Example from `06-invoice-form-view-chatter.jpg`:

```
Invoices                    ← teal link back to the list
INV/2026/00005 ⚙
```

The record pager (`1 / 5 ‹ ›`) sits far right on the same row and walks the underlying list.

### 1.7 Top-right cluster

Read from the accessibility tree and screenshots, left→right:

| Element | Detail |
|---|---|
| 💬 messaging bubble | speech-bubble icon with a **numeric counter badge** (`5`) in the top-right corner of the icon |
| 🕐 activities | clock icon — activity/scheduled-action menu |
| ✕ Odoo Studio | crossed-tools icon, `button "Odoo Studio"` — the customisation entry point |
| Company name | `button "MARU CREDIT LIMITED"` — plain uppercase text button, the company/multi-company switcher |
| Avatar | rounded-square initial tile (purple `M`) with a **green online dot** at bottom-right; opens the user menu |

---

## 2. Dashboard composition — Accounting Dashboard

Screenshot: `02-accounting-dashboard.jpg`. URL `/odoo/accounting`.

### 2.1 Grid

- **3 columns × 2 rows = 6 cards**, matching the pager `1-6 / 6` — the dashboard is literally a **kanban view of journals**, which is why it has a search bar, a `Favorites` filter chip and a pager.
- Cards are ~470px wide at 1470px viewport, ~14px gutter, ~305px tall, with ~16–20px internal padding.
- Each card has a **1px border** and a **3–4px coloured left accent bar** (violet on Sales/Purchases; the colour is per-journal).

### 2.2 Per-card anatomy

Every card follows the same skeleton:

```
Title (teal, ~17px, medium)
[Action btn] [Action btn]                right-aligned stat lines:  <teal count label>   <white amount>
                                                                    <teal count label>   <white amount>
────────────────────────── mini chart / checklist ──────────────────────────
                                                                                            [⋮ kebab]
```

| Card | Buttons | Right-aligned stats | Body |
|---|---|---|---|
| **Sales** | `New` | `3 Unpaid` → 2,980,000 USh · `3 Late` → 2,980,000 USh | mini **bar chart**, x-axis buckets: *Due · 9 - 15 Aug · This Week · 23 - 29 Aug · 30 Aug - 5 Sep · Not Due* (labels rotated ~-20°) |
| **Purchases** | `Upload`, `New` | `2 To Pay` → 14,000,000 USh · `2 Late` → 14,000,000 USh | same 6-bucket bar chart |
| **Bank** | `Bank Setup`, `Transactions`, `2 to reconcile` | `Balance` → -3,710,080 USh · `Payments` → 1,550,000 USh | flat **line chart** with endpoint dots |
| **Petty Cash** | `Transactions` | `Balance` → 1,550,000 USh | flat line chart |
| **Tax Returns** | `Tax Returns` | — | **setup checklist**: ○ Set Company Data · ✅ Set Periods · ○ Review Chart of Accounts (done items get a green filled check, pending get a hollow grey dot; all labels are teal links) |
| **Salaries** | `New` | `2 To Validate` (count only, no amount) | empty |

Key observations for cloning:
- **Counts are teal links, amounts are plain white** — the count is the drill-in affordance, the money is data.
- Buttons are **not** all primary. `New` is purple-filled; `Upload`, `Transactions`, `Bank Setup`, `Tax Returns` are dark-grey outlined secondaries; `2 to reconcile` is a secondary **whose label is itself a live count** — an action and a KPI fused.
- A card can legitimately have **zero chart** (Salaries) or **a checklist instead of a chart** (Tax Returns). The grid does not force visual symmetry.
- Each card carries a **kebab (⋮) menu** at its bottom/top-right for journal-level actions.

### 2.3 Palette (approximate — visually sampled from `16-…png` / `17-…png`)

| Token | Approx hex | Used for |
|---|---|---|
| Page background | `#16181e` – `#1a1d24` | app canvas, behind cards |
| Surface / card | `#252932` – `#2b2f3a` | KPI cards, dropdown panels, list rows |
| Top nav bar | `#1f2229` | module bar (slightly darker than cards) |
| Row hover / alt surface | `#2f333e` | list row hover, secondary buttons |
| Border / divider | `#3a3f4b` | card borders, table rules |
| **Teal accent** | `#2ecfb0` – `#00d0a0` | card titles, links, counts, active view-switcher, status pipeline "current" |
| **Purple primary** | `#71465f` – `#7c4d6d` (Odoo brand `#714B67` family) | `New` button, avatar tile, chart bars |
| Violet accent bar | `#a663cc` | card left edge |
| Text primary | `#e8eaed` | amounts, headings |
| Text muted | `#9aa0aa` | section headers in dropdowns, secondary labels |
| Danger / overdue | `#e05c5c` | "Last month" overdue due-dates |
| Success | `#3fbf5f` | "Paid" ribbon, checklist ticks |

Type scale observed: module name ~15px semibold · nav items ~13px · card title ~17px medium · stat amount ~15px · list header ~13px semibold · list cell ~13.5px · form record title ~34px light.

---

## 3. Other modules — top-nav submenu trees

Only modules actually opened are documented.

### 3.1 Settings (`07-settings-general.jpg`, `08-…menu.jpg`)

Top nav: `General Settings · Users & Companies`.

- **Users & Companies** dropdown → `Users`, `Companies` *(2 items only)*.
- **General Settings** renders a distinctive **two-pane settings layout** not seen elsewhere:
  - **Left sidebar** = vertical list of *per-app* settings scopes, each with the app's own icon: `General Settings` (active, teal-highlighted with left bar), CRM, Calendar (with nested un-iconed children `Loandisk Integration`, `Vehicle Tracking`), Website, Purchase, Inventory, Accounting, Employees, Appraisal, Payroll, Documents, Recruitment.
  - **Right pane** = scrolling stack of **full-width section header bands** (lighter surface, e.g. `Users`, `Languages`, `Companies`) each containing a 2-column grid of setting blocks.
  - Control panel here swaps `New` for **`Save` / `Discard`** — settings is a giant dirty-state form.

### 3.2 Employees (`12-employees-kanban.jpg`)

Top nav: `Employees · Departments · Learning · Reporting · Configuration`.

- **Reporting** → *Skills*: `Skills Inventory`, `Certifications`.
- **Configuration** → `Settings`; *Employee*: `Onboarding / Offboarding`, `Work Locations`, `Working Schedules`, `Departure Reasons`, `Skill Types`; *Recruitment*: `Job Positions`, `Contract Templates`, `Employment Types`.
- `Employees`, `Departments`, `Learning` are **direct actions, not dropdowns** (clicking `Employees` navigated rather than opening a panel).
- Default view is **Kanban** with a **left search panel** (facet sidebar): `DEPARTMENT` → `All`, `▸ Administration 3`, plus a collapse toggle. Cards show a large colour-block avatar (initial letter) on the left and stacked icon+value rows (job title, email, phone, contract dates) on the right, with an activity clock in the card footer and a status dot top-right.

### 3.3 Not opened

`Maru Operations`, `Training Management`, `Dashboards`, `Payroll`, `Time Off`, `Appraisals`, `Recruitment`, `Purchase`, `Purchase Requisitions`, `Inventory`, `Barcode`, `Documents`, `Contacts`, `CRM`, `Website`, `Discuss`, `Calendar`, `Apps` — **(not opened)**, listed here only because their tiles appear in the apps grid.

---

## 4. Settings / administration surfaces

### 4.1 General Settings → Users block (`07-settings-general.jpg`)

- **Invite New Users**: a bare email input with placeholder `Enter an email` and a purple **`Invite`** button — one-field, zero-ceremony onboarding.
- **2 Active Users** with a `?` help tooltip, and a `→ Manage Users` deep link.
- **Languages**: `1 Language`, `→ Add Languages`.
- **Companies**: current company card (`MARU CREDIT LIMITED` / `Uganda`) with `→ Update Info`; `1 Company` with `→ Manage Companies`; plus `Document Layout` ("Choose the layout of your documents") and `Email Templates` ("Customize the look and feel of automated emails").

### 4.2 Users list (`Users & Companies → Users`)

Control panel: `New` + title `Users ⚙` + search with a **saved-filter chip `Internal Users ✕`** + pager `1-2 / 2` + List/Kanban switcher.
Columns: **Name** (with avatar tile) · **Login** · **Role** (rendered as a pill badge, e.g. `Administrator`) · optional-column gear at far right.

### 4.3 User form — the onboarding/credential surface Nimbus Manager must match

Screenshots `09-user-form-access-rights.jpg`, `10-user-form-security-tab.jpg`, `11-user-actions-cog-password.jpg`.

- **Statusbar (right):** `Invited ▸ Confirmed` pipeline — an invited-but-not-accepted user is a first-class state.
- **Statusbar (left):** `Create employee` — one-click promotion of a login into an HR employee record.
- **Smart button:** `[👤 Contact]` — links to the partner record.
- **Header:** large avatar with hover **pencil / trash** overlays, name as an inline-editable H1, then email and phone with leading icons.
- **Tabs:** `Access Rights` · `Preferences` · `Calendar` · `Security`.
  - **Access Rights** — `ROLES: Role ( ) User (•) Administrator` radio, then a 2-column grid of per-app permission dropdowns under uppercase section headers: `MASTER DATA` (Products → *Create*, Contact → *Creation*, Export → *Allowed*), `SALES` (Sales → *Administrator*), `PURCHASE REQUISITION`, `WEBSITE`, … Each right is a **named level, not a checkbox** — the enterprise pattern is "pick a tier per domain".
  - **Security** — a label/description ↔ action-button table:
    | Label | Description | Control |
    |---|---|---|
    | Change Password | "Update if compromised." | `Change password` |
    | Two-factor Authentication | "Recommended for extra security." | `Enable 2FA` |
    | API Keys | "Connect external services." | `Add API Key` |
    | Passkeys | "Recommended for extra security." | `Add Passkey` |
    | Devices | "Check if they are yours." | device rows (`Macos Chrome ● 1 minute ago / 104.22.45.118`) each with `Log out`, plus `Log out from all devices` |
- **Record cog (⚙) → Actions menu** (`11-…jpg`): `Duplicate` · `Archive` · `Delete` (red) — divider — `Change Password` · `Disable two-factor authentication` · `Send Password Reset Instructions` · `Privacy Lookup`.

**The admin credential model in one line:** *invite by email → user sets own password → admin can force-change, email a reset link, disable 2FA, revoke devices, archive (never hard-delete by default).* This is the bar Nimbus Manager's frontline-onboarding + Quick-PIN admin is being compared against.

---

## 5. Component inventory for cloning

| # | Component | Observed detail | Screenshot | Maps to Nimbus manager surface |
|---|---|---|---|---|
| C1 | **Control panel row** | `New`[+`Upload`] · title+cog · search-with-chips · pager · view switcher, all on one 44px row | `05`, `12` | The shared shell header for **every** manager page — Overview, Operations, Staff, Reports, Settings |
| C2 | **Search / filter dropdown** | 3 columns: Filters (divider-grouped, `Custom Filter…`), Group By (`Custom Group ▾`), Favorites (`Save current search ▾`) | `15` | Report parameter + list filtering across Operations/Staff/Reports; saved views for recurring manager queries |
| C3 | **Filter chips in the search box** | funnel glyph + facet label + `✕`; multi-value facets join with muted italic `or` | `05`, `07` | Active branch / date-window / status filter display |
| C4 | **List view** | Header row: `Number · Customer · Invoice Date · Due Date · Tax Excluded · Total · Status`; right-aligned numerics; leading checkbox column; **optional-column gear at far right of the header**; overdue dates in red; status as coloured pill (`Paid` green, `Posted` grey, `In Payment` teal); **column totals row** under the last record; pager `1-5 / 5` | `05` | Orders list, Staff roster, Report-runs list, Devices list, Alert deliveries |
| C5 | **Form view** | Statusbar action buttons left (`Send · Print · Preview · Credit Note · Reset to Draft`) + status pipeline right (`Draft ▸ Posted`, current segment teal chevron); smart-button strip (`Payments 1`); huge record title; 2-column field block; **inner notebook tabs** (`Invoice Lines · Journal Items · Other Info`) over an editable line grid with drag handles and its own optional-column gear; totals block bottom-right; corner **ribbon** (`PAID`, diagonal green) | `06` | Order detail, Employee detail, Report run detail, Device detail |
| C6 | **Chatter** | Right rail, ~40% width: `Send message · Log note · Activity` buttons + search/attachment/follower-count icons; then a date-grouped feed of avatar + author + timestamp + **tracked-field diffs** rendered as `old → new (Field Name)` | `06` | The **audit timeline** surface (`GET /api/audit/timeline`) — Nimbus already has the data, this is the presentation |
| C7 | **Kanban cards** | Colour-block avatar panel + stacked icon/value rows + footer activity clock + status dot; grouped by an optional **left search-panel facet sidebar** | `12` | Staff directory, Devices by branch, Alert rules by domain |
| C8 | **Graph view** | Toolbar: `Measures ▾` · `Insert in Spreadsheet` · chart-type toggle (bar/line/pie) · stacked/cumulative toggles · sort asc/desc; single-metric legend top-right | `13` | Reports module charting; `/api/dash/*` KPI trends |
| C9 | **Pivot view** | Toolbar: `Measures ▾` · `Insert in Spreadsheet` · flip-axis · expand-all · **download** ; expandable `⊟/⊞` row & column headers with a `Total` spine | `14` | Report drill-down over the 24 generators; export entry point |
| C10 | **KPI card grid** | See §2.2 — title, mixed-weight buttons, right-aligned count→amount pairs, optional mini chart *or* checklist, kebab | `02` | Manager **Overview** — the single highest-fidelity target |
| C11 | **Settings two-pane** | icon sidebar of scopes + banded section stack + `Save`/`Discard` control panel | `07` | Manager **Settings** (devices, printers, terminals, alert rules, sync) |
| C12 | **Security/action table** | label + one-line description ↔ single action button per row | `10` | Quick-PIN admin (reset / disable / enable), device revocation |
| C13 | **Record cog Actions menu** | Duplicate/Archive/Delete + domain actions (`Change Password`, `Send Password Reset Instructions`) | `11` | Staff record actions; report-run actions |
| C14 | **Statusbar pipeline** | `Invited ▸ Confirmed`, `Draft ▸ Posted` — chevron segments, current one teal | `06`, `09` | Order lifecycle, approval lifecycle, report-run status |
| C15 | **Breadcrumb + record pager** | teal parent link over white record title; `1 / 5 ‹ ›` walks the parent list | `06` | Every drill-in from a manager list |

---

## 6. What this instance does *not* have

Stated so the gap analysis is not built on assumptions:

- **No Point of Sale app** — there is no Odoo-side reference for cashier/waiter/floor UI in this instance.
- **No Sales app** — quotations/sales-orders are absent; "Sales" on the dashboard is the *sales journal*, not a CRM pipeline.
- The Accounting **Reporting** menu items were enumerated but **the reports themselves were not opened** — their internal layout (the Odoo "account report" engine with its comparison/date pickers and hierarchical expandable lines) is **not documented here**.
- `Multi-Ledger`, `Checks`, `Asset Models`, `Loans`, `Working Files`, `Audit Trail` were seen as menu entries only — **(not opened)**.
