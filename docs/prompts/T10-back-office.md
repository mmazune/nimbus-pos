# T10 — Back office: manager, owner and accountant, on a laptop and a phone

Read `docs/prompts/LONG-RUN-RULES.md` first. It binds you.
Branch: `t10/back-office`, cut from `rebuild/main`. Then `git merge --no-edit` in this order: `origin/t5/join-up`, `origin/t6/engines-2`, `origin/t7/drawings` (a trial showed all three merge clean). Track T8 starts from the same merges and owns the touch screens.
You own: in `apps/web/src`: new `screens/{backoffice,manager,owner,accountant}/**`; `components/manager/**`; `components/pos-shell/OperationalTopNav*`; pages `manager/**`, new `owner/**` and `accounting/**`; `lib/manager/**` and new `lib/backoffice/**`; new kit files under `components/kit/laptop/**` exported from their own `components/kit/laptop/index.ts` (never edit `components/kit/index.ts`, `sections.ts`, `globals.css` or `tailwind.config.ts`: T8 owns them; if you need a token they lack, write it in your report for T8); e2e folders `manager-*` and new `t10`. Also `reports/**` and the Status cells of your rows in `design/screens/SCREENS-2.md`.
You never touch: T8's folders (see `T8-touch-screens.md`), `apps/api/**`, `packages/db/**`, `design/screens/html|png|kit.css`. The manager's floor and order screen are T3's and T5's screens mounted under `/manager`: keep them mounted and working, change nothing in `screens/floor` or `screens/order`.

## Why

- "Design each screen for mobile… for different people in the administration, the owners." (Moses, 26 Nov 2026)
- "Who creates tables and with what permission… menu item creation, sold individually or has recipes… the accountant sees the same items and assigns costs." (Moses, 25 Nov 2026)
- "Hide developer-facing clutter… remove junk code." (Moses, 25 Nov 2026)

The real case: the manager's screens today are the Odoo-style pages from August: 47 pages under `/manager`, a top bar of seven menus, settings that show permission keys and "stub" wording (`docs/direction/research/A2_frontend_as_built.md`). The engines behind the back office now exist: menu, offers and sold out (T2), areas and tabs (T2), staff onboarding with a setup token (T6), approvals (T6), stock, stores, deliveries, purchase orders and counts (T6), the rights matrix (T6). The drawings exist: `Order-Laptop`, `Manager-Item`, `Manager-Floor`, `Accountant-Costs`, `Manager-Phone-Today`, `Manager-Phone-Approve`, `Owner-Phone-Today`, `Accountant-Phone-Costs`, `Manager-Waste-Report`, and T7's groups 8 to 11. Launching this track is the owner's approval of the drawings you build from. Reports and day close wait for track T9's engine: build their screens only where an endpoint answers today.

## Read first

`reports/T6_REPORT.md` (endpoints), `reports/T2_REPORT.md` (endpoints), `reports/T7_REPORT.md` and its decisions on the manager's and owner's bars, `design/screens/SCREENS-2.md`, `OVERVIEW.md`, `docs/direction/01-decisions.md` (R13, R14), `05-reports.md`, `10-people-and-access.md`, `docs/direction/research/A2_frontend_as_built.md` on the manager pages.

## Phases

**1. The laptop shell and the phone bar.** The top bar as drawn: mark, the five words of the approved drawings (Floor, Menu, Stock, Staff, More), search, alerts, branch, avatar; the control panel row under it; Approvals, Reports and Settings under More. On a phone under 640 px: the bottom bar for manager (Today, Floor, Approvals, Reports, More), owner (Today, Branches, Reports, Alerts, More) and accountant (Today, Costs, Purchases, Reports, More), from the drawings. The owner and accountant sign in and land on their Today. Laptop kit pieces you need (app bar, control panel, data table, stat row, side panel) go in `components/kit/laptop/`.

**2. Today and approvals.** Manager Today on a laptop and a phone: sales so far from endpoints that answer today, "Needs you" from approvals and stock levels below minimum; Approvals on a laptop and the phone approve screen (`Manager-Phone-Approve`) on T6's approval requests. Owner Today across branches (`Owner-Phone-Today`) from the endpoints that exist; what has no endpoint is left out and listed.

**3. Menu.** Menu list by Food and Drinks and group, with search and sold out; the item screen (`Manager-Item` and T7's item with servings and choices): name, price, group, station, "How is it sold?", servings with their stock amounts, choices, the recipe with units and cost, offers. On T2's and T6's endpoints.

**4. Floor, areas, stores and settings.** `Manager-Floor` with areas, bulk add tables, put away, change seats; a Tabs area; stores set-up (the chain, which station takes from which, minimum and fill-to); settings that an endpoint holds today (limits, stations and late times). Remove the old settings pages' developer wording or the pages themselves where the new screens replace them.

**5. Staff.** Staff list and a person, to T7's drawing: create a person and their role; their PIN is set by them with the setup token (show the token as a code to hand over, never a PIN); reset sends a new token; deactivate, never delete. Compensation stays hidden for the manager (R14).

**6. Stock, purchases and costs.** Manager and accountant: stock value by store, movements of one item, To buy, purchase orders and deliveries, counts with the manager's note above the limit; `Accountant-Costs` and the phone version on T6's cost endpoints where they answer, with "No cost yet" and "Cost changed". `Manager-Waste-Report` from the movement ledger if an endpoint gives waste by reason; otherwise left out for T9.

**7. Clean-up and proof.** Old manager pages that the new screens replace are deleted once nothing links to them; any page left keeps working and loses its developer wording. Drive in the browser, on the demo venue, as a manager, an owner and an accountant, at 1440 × 900 and 390 × 844: add a menu item with a recipe and see its cost; add eight tables to Main hall; onboard a waiter and hand her the setup code; approve a void from the phone; receive a delivery and see the average cost change; close a count with a note. Three runs.

## Done when

1. The laptop bar and the three phone bars match their drawings; each role lands on its own Today.
2. Each screen in phases 2 to 6 sits beside its drawing in `reports/proof/T10/`; what has no endpoint is listed with the milestone that brings it.
3. The six journeys in phase 7 pass three runs in a row.
4. No screen shows a permission key, a route, "API", "stub" or "v1"; no screen shows a PIN or compensation to a manager.
5. Rule 10 holds at 1440 × 900 and 390 × 844; `pnpm verify:web` and the web build are green.
6. `git diff --stat` from the last merge commit stays inside what you own.
7. `SCREENS-2.md` rows you built say `built` with a score of 20 or more.
