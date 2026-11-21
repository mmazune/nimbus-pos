# 02 — Gaps by role, for the concert only

*21 Nov 2026. Evidence: `research/G2_frontend_build_spec.md` s6–7, `G1` s4, s8, s9. Paths are under `apps/web/src` unless marked.*

## In short

- **Cashier** is where the real work is: the Event Till screen does not exist.
- **Supervisor** and **Manager** mostly work today; their gaps are closed by scripts, not screens.
- **Organiser** uses a Manager account. **Waiter** and **Accountant** need nothing for this event.
- Verdicts: **MUST** fix before 28 Nov · **WORKAROUND** exists, named · **SKIP** not needed for the event.

## Cashier (bar and food tills)

| Needs to | Today | Verdict | How it is closed |
|---|---|---|---|
| Log in on a tablet with a PIN | Works: quick PIN, 6 or 8 digits, per branch, with a Branch ID field (`pages/login.tsx`) | WORKAROUND | Prefill the branch from `?branch=` or an `/event/setup` page per tablet (H3) |
| Stay logged in all night | Fails: 15-minute token, no refresh, 15-minute idle logout | **MUST** | EV-17 (H2 env, H3 client) |
| Open a shift and a till with a float | Works: `/cashier/me` (shift), `/cashier/till` (till) | WORKAROUND | Use as is; link from the Event Till header |
| Ring a sale | No counter sale. Only waiters create orders; cashier cannot add items | **MUST** | `/event/till` + `POST /pos/quick-sale` (H1, H3) |
| Take cash and see change | Cashier payment panel is bound to a SERVED order; not reusable | **MUST** | Cash dialog in the Event Till (H3) |
| Tag Visa / Mastercard / Other, MTN / Airtel | No such control anywhere | **MUST** | Tender bar (H3), columns (H1) |
| Keep selling with no signal | No queue, no service worker | **MUST** | EV-11, EV-21 (H3) |
| Undo the last sale | Cashier cannot void a closed order | **MUST** (small) | Supervisor PIN dialog calling the existing post-close void (EV-22) |
| Cash up at end of night | Works at `/cashier/till` reconcile, but expected cash is branch-wide | **MUST** (small) | EV-20 (H1) |
| Print a receipt | Not wired | SKIP | No receipts at the event (O8 may change this) |

## Supervisor (one or two per vendor, floating)

| Needs to | Today | Verdict | How it is closed |
|---|---|---|---|
| Exist as a user | The onboarding wizard's role picker excludes Supervisor | WORKAROUND | Created by the event setup script (H2) |
| Approve an undo with their own PIN | Post-close void exists in the API: Manager or Supervisor, own 8-digit PIN, within 15 minutes | WORKAROUND | The Event Till's undo dialog calls it (H3) |
| See what is happening | `/supervisor/floor`, `/supervisor/orders`, `/supervisor/approvals` exist, built for tables | SKIP | Not needed; use `/event/live` |
| Reconcile a cashier's till | Cannot | WORKAROUND | Cashier reconciles with the supervisor watching; counted on the paper cash-up sheet |

## Manager (Moses or a vendor lead, setup week and on the night)

| Needs to | Today | Verdict | How it is closed |
|---|---|---|---|
| Load two menus with prices | **No menu screen anywhere in the web app.** API CRUD exists under `/menu` | **MUST** | `import-event-menu.ts`, CSV keyed by SKU, with a dry run (H2) |
| Create 10–14 cashiers and their PINs | Staff onboarding works but is one person at a time, three steps, PIN shown once | WORKAROUND | Event setup script creates users and prints a PIN sheet to a gitignored file (H2) |
| Reset a forgotten PIN on the night | `/manager/staff` credential reset exists (B6.7) | WORKAROUND | Use as is; rehearse once in the dry run |
| Set currency and timezone | `/manager/settings` exists; branches default to USD and UTC | WORKAROUND | Setup script sets UGX and Africa/Kampala; verify on the settings screen |
| See live sales | `/manager/overview` polls every 60 s: sales today, payment mix, open orders. One branch at a time; no card type, top items or per-till view | **MUST** (new view) | `/event/live` (H4). Fallback if it slips: `/manager/overview` in one browser per branch |
| Export figures | `/manager/reports`: PAYMENT_MIX, TOP_ITEMS, SALES_BY_HOUR and others, CSV, per branch, summary only. CSV does not escape commas | WORKAROUND | Event reports `lines.csv` (H4); existing reports remain as a cross-check |
| Void or correct after 15 minutes | Refund flow exists | WORKAROUND | Manager refund after the event; listed in the final report |
| Accounting screens | 30 pages exist | SKIP | Event sales do not post to the ledger automatically |

## Organiser (Bwomono / Omakase) and Owner

| Needs to | Today | Verdict | How it is closed |
|---|---|---|---|
| Log in | The login page admits only waiter, cashier, supervisor and manager; Owner is blocked | WORKAROUND | A **Manager-role** account with membership in both branches (EV-9), landing on `/event/live` |
| See both vendors together, live | Nothing combines branches | **MUST** | `/event/live` + org-scoped event reports (H4) |
| See Visa share and what Visa bought | No card type anywhere | **MUST** | H1 columns, H4 report |
| Get a final report | — | **MUST** (after the event) | H5 |
| Owner module (B7) | Not started | SKIP | Not for this event |

## Waiter

Not needed. No tables, no kitchen flow at the event. Leave the waiter screens untouched.

## Accountant

Not needed. Orders and payments do not post to the general ledger automatically (no ledger call in the orders, payments or tills modules; posting is by manual replay). Event revenue can be posted after the event if the vendors want it. Leave the accounting module untouched.

## The fallback ladder

| If this slips | Use this instead |
|---|---|
| `/event/live` | `/manager/overview`, one browser per branch, plus `lines.csv` or `/manager/reports` |
| Offline queue | Paper tally sheets per till, entered afterwards through the Event Till (the `soldAt` field keeps the real time) |
| Bank report match | Till-button figures, labelled provisional, plus the bagged batch slips |
| Supervisor undo | Leave the sale; note it on the till's paper sheet; manager refunds after |

## What is still unverified

- Whether the onboarding endpoint accepts "Supervisor" (script it regardless).
- Whether the manager credential-reset flow works end to end on the rescued branch (rehearse it).
- Touch-target sizes on short tablet viewports: the root font clamp shrinks them (G2 risk 8).
