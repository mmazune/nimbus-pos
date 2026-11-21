# 01 — Direction and decisions

*Version 2, 21 Nov 2026. Supersedes v1.1 (18 Nov). Evidence: `research/` A1–D and G1–G3.*

## In short

- Seven days to Sat 28 Nov. Build one slice: Event Till, live view, deployment. Nothing else.
- Card type comes from **a button the cashier taps** (live, provisional) and **the bank's report matched afterwards** (final).
- A quick sale is written as a **normal Order and Payment** so every existing dashboard and report keeps working as a fallback.
- Four things would stop the tills if left alone: order-number collisions, 15-minute sessions, no offline start, and no hosting.

## Moses's requirements, in his words

| # | Said | Date | Where it lands |
|---|---|---|---|
| R1 | "They want to know how much payments like cash, card, how much came from Visa, what items are bought from Visa" | 18 Nov | EV-3, EV-5, `03` §4 |
| R2 | "we own both the two vendors, they give us the menus" | 18 Nov | EV-4, `03` §5 |
| R3 | "how do we get the source, like the type of card… could we talk to Visa for direct integration" | 18 Nov | "How we know the card type" below |
| R4 | "most purchased drinks, which brand… which whiskey, which gin, what food" | 18 Nov | `MenuItem.brand`, SKU-keyed reports |
| R5 | "the POS is not complete… we did waiter, manager, we didn't do owner, there's accountant" | 18 Nov | `02_GAPS_BY_ROLE.md` |
| R6 | "it's a partnership, don't include anything about price" | 18 Nov | Proposal; any client-facing text |
| R7 | "the gaps we really, really have that we need to close before the concert in seven days… for manager, everyone" | 21 Nov | `02`, `06` |

## What would break on the night (all found in code)

| # | Finding | Evidence | Fix |
|---|---|---|---|
| F1 | **Order numbers collide.** `generateOrderNumber` reads the last order then adds one, with no lock; `(branchId, orderNumber)` is unique. Several tills per branch will fail sales | `orders.service.ts:67-81` [V-lead] | EV-15 |
| F2 | **Sessions die after 15 minutes.** Access token default `15m`; the web app never calls `/auth/refresh`; idle logout is 15 minutes | `auth.service.ts:57`, `idle.ts:6` [V-lead]; no `auth/refresh` in `apps/web/src` [V-lead] | EV-17 |
| F3 | **A reloaded tablet loads nothing offline.** Pages use `getServerSideProps`; no service worker | G2 s4 | EV-21 |
| F4 | **Not deployed.** No Dockerfile, compose or Vercel config for POS | G3 s7–8 | H2 |
| F5 | **Cash-up double counts.** Expected cash sums every cash payment in the branch during the till window | `tills.service.ts:381-389` [V-lead] | EV-20 |
| F6 | **A sale needs five kitchen states** and 30–40 database round trips | `orders.service.ts` VALID_TRANSITIONS [V-lead]; G3 s6 | EV-2 |
| F7 | **No card type, till or brand fields** | `schema.prisma` Payment, MenuItem [V-lead] | EV-3 |
| F8 | **The default seed is unsafe on a live database** (demo owner and manager with known passwords, no host guard) | G1 R3, G3 s5 | EV-18 |
| F9 | **Security keys have public defaults**; with `NODE_ENV` unset, reset tokens appear in responses | G3 s2 | `05` §2 |
| F10 | **Owner and accountant cannot log in** to the web app; organiser needs a Manager-role account | `login.tsx:154-158` [V-lead] | EV-19 |
| F11 | **No menu screen anywhere** in the web app | G2 s6 | Import script, `03` §5 |
| F12 | Branches default to currency USD and timezone UTC | `schema.prisma:610` [V-lead]; G1 s7 | Event setup script |
| F13 | Health check returns HTTP 200 when the database is down | G3 s4 | `05` §3 |

## How we know the card type

| Layer | What happens | When | Trust |
|---|---|---|---|
| 1. Till button | After the terminal approves, the cashier taps **Visa**, **Mastercard** or **Other card**. No default; read it from the slip | Live | Self-reported |
| 2. One terminal per till | Each till is mapped to one terminal ID. Approval code from the slip is optional and can be added after the sale | — | Makes layer 3 accurate |
| 3. Bank report match | Import the acquirer's transaction report; match by terminal, amount, time | After the bank releases it | Authoritative |
| 4. Pesapal callback (only with Pesapal terminals) | Pesapal's documented callback posts `payment_option` after each terminal payment | Live | Kenyan sample; Uganda UNKNOWN |

- There is no direct Visa integration for a merchant till [PK conclusion; Visa's description of Visa Direct is V via report B]. Visa Direct moves money to and from cards and is open to licensed acquirers or originators they sponsor.
- Store only brand, last four (optional), approval code (optional), terminal ID. PCI SSC FAQs 1091 and 1117 cover the truncated number [V via B]; approval code and terminal ID being outside card data is [PK].
- Paper fallback: bag each terminal's end-of-day batch slip and merchant copies per till.
- Match rate with one terminal per till: about 95–99% [P, unmeasured; bank, report columns and release time UNKNOWN].

## Decisions

| # | Decision | Why |
|---|---|---|
| EV-1 | Build an Event Till slice inside the repo; do not finish cashier C4–C6, owner or accountant | 7 days |
| EV-2 | One endpoint `POST /api/pos/quick-sale`: order, lines, one payment, status CLOSED, in one transaction | F6 |
| EV-3 | New nullable columns. Payment: `cardScheme` (VISA, MASTERCARD, OTHER), `cardLast4`, `authCode`, `terminalId`, `tillCode`, `momoNetwork` (MTN, AIRTEL). Order: `tillCode`, `clientSaleId`. MenuItem: `brand` | F7 |
| EV-4 | One organisation, two branches (Food, Drinks), currency UGX, timezone Africa/Kampala | Fits the tenancy model; F12 |
| EV-5 | **One tender per sale.** A customer paying two ways is two sales | Makes "items bought with Visa" exact |
| EV-6 | Card type by till button now, bank match after; Pesapal callback only if confirmed in Uganda | Only route that fits the date |
| EV-7 | Money stays `Decimal(12,2)` as the schema has it | House rule says integer minor units; changing it now is the larger risk. Logged conflict |
| EV-8 | No receipt printing, stock deduction, kitchen display, split tender or tables at the event | Not wired; not needed |
| EV-9 | The organiser uses a Manager-role account with membership in both branches | F10 |
| EV-10 | The till must keep selling with no internet | Venue networks fail |
| EV-11 | The till writes each sale to a local queue first with a client-made ID, then posts it. Online and offline are the same path | The till never waits on the server |
| EV-12 | Event night shows five numbers: tender split, Visa value and share, items by card type, top items, per-till cash-up. Brands and hour curve ship with the final report | Scope |
| EV-13 | About 12 tiles per vendor, round prices, no modifiers | Queue speed |
| EV-14 | Idempotency is `Order.clientSaleId`, unique on `(orgId, clientSaleId)`: look up first, catch the unique violation and return the original. Do **not** use the `IdempotencyKey` table, the BG3 guard or `/sync/replay` | Those store FAILED and return null on retry, never expire, and replay has no handlers (G1 s3) |
| EV-15 | Order numbers inside quick-sale are allocated under a per-branch `pg_advisory_xact_lock`, with retry on unique violation. Keep the `ORD-` prefix | F1. A different prefix would reset the legacy counter |
| EV-16 | Quick sales are normal rows: `Order.status = CLOSED`, `serviceType = TAKEAWAY`, `Payment.status = COMPLETED`, `metadata.source = 'QUICK_SALE'` | Existing reports key on exactly these (G1 s2); gives a working fallback |
| EV-17 | Event sessions survive the night: set `JWT_ACCESS_TTL` to 12h on the event API, add client-side refresh on 401, and skip the idle logout on `/event/*` | F2 |
| EV-18 | Never run `db:seed` on the event database. A separate idempotent event setup script creates roles and permissions, the organisation, branches, users, PINs and tills | F8 |
| EV-19 | Every till user is a **Cashier**-role user, one set per branch. Bartender cannot write orders. Supervisors are created by script | G1 s4; G2 s6 |
| EV-20 | `Payment.tillCode` is set on every quick sale; till expected-cash filters on it (`tillCode = this till OR tillCode IS NULL`) | F5 |
| EV-21 | `/event/till` is a client-rendered page with a service worker that caches the shell and the menu, so a reload with no signal still opens the till | F3 |
| EV-22 | Undo last sale = the existing post-close void, which needs a Supervisor's or Manager's own PIN within 15 minutes. Later corrections are done by a manager after the event | G1 s9. No new void logic |
| EV-23 | Cash payments are `verificationStatus = NOT_REQUIRED`; card and mobile money are `UNVERIFIED` until the bank match (H5) marks them | Honest status; existing reports already count UNVERIFIED |
| EV-24 | Event reports are a new org-scoped module that streams JSON and CSV. No `ReportRun` row, no `ReportType` enum change, no file on disk | Avoids an enum migration; existing CSV does not escape commas (G1 s5) |

## Not in it

Owner and accountant screens · menu management screen · stock and recipes · receipt printing · kitchen display · terminal (ECR) integration · mobile-money API · split tenders · tables and waiters · phone layout for the till · ledger posting from event sales.

## Decisions only Moses can make

| # | Decision | Default if silent | Blocks |
|---|---|---|---|
| O1 | Confirm the event is B'rakaland, 28 Nov | Plan as if yes | Everything |
| O2 | Push `rescued/main-2026-11-15` to `origin` (it is only on `backup`) | Build locally from the local branch; push when Moses says | H0 |
| O3 | Terminal supplier: Visa's acquiring bank, Pesapal, or the vendors' own. **Overdue: was due Fri 20 Nov** | Proceed with the till button alone; ask for a sample bank report | Layers 3–4, H5 |
| O4 | Hosting: one VPS in the same region as Neon for the API (Docker Compose and Caddy, copied from the HMS setup), Vercel for the web app, a **new** Neon project for the event with autosuspend off 27–29 Nov | As stated [P] | H2 |
| O5 | Is Visa "preferred" or "exclusive", and what must Omakase report, by when | Preferred; totals only | Till design |
| O6 | Attendance, number of other bars, number of tills | 10 tills (6 drinks, 4 food) | Kit, capacity |
| O7 | Tablets, routers, SIMs, power: who supplies | Omakase, to the kit list in `05` | Dry run |
| O8 | Do the vendors need URA EFRIS e-receipts at the event | UNKNOWN; ask their accountants | Receipts |
| O9 | The two menus: SKU, name, brand, category, price, serving | Needed by Mon 23 Nov | H2 import |
| O10 | A bar and staff for the dry run on Wed 25 or Thu 26 | Thu 26 | Dry run |

## Capacity warning

Report D found no sourced figure for sales per till per hour. On its assumptions [P] (about 90 drink sales per till per hour, 2 drinks per sale, 0.8 drinks per head in the peak hour), ten tills (6 drinks, 4 food) cover about 2,000 people at the low case; the base case needs 14. Ask Omakase for the crowd size and how many other bars there are.

## What is still unverified

- That Omakase's concert is B'rakaland.
- Every bank's report columns and release time; Pesapal's callback in Uganda.
- Nothing was built or run. A clean container build, `next build`, and the Prisma client in a pnpm container are unproven (G3).
- The Neon region and plan, so the VPS region is undecided.
- Whether one user can hold quick PINs for two branches (G1); plan separate cashier users per branch.
- `ShiftCloseSummary` has the same branch-wide cash logic as tills (G1 R5); impact not assessed.
- Whether the staff onboarding endpoint accepts the Supervisor role (G2).
- Throughput per till; mobile-money prompt times at a crowded venue.
- Whether a record-only POS needs a National Payment Systems licence (reading: no).
- Version 1 of this direction was scored 0.60–0.82 by an independent reviewer; this version applies its corrections and three deeper code reads but has not been re-scored.
