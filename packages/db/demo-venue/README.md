# Tapas Downtown — the demo venue

A whole made-up restaurant for testing and for demos. **Every person, item, price, phone and
booking here is invented**; phones are from the fictional block `+256 700 000 xxx`; no real brand
appears (the validator checks a list of brand words).

## Load it (one command, a throwaway local database only)

```bash
eval "$(tools/test-env.sh)"
packages/db/demo-venue/run.sh
```

`run.sh` refuses unless `DATABASE_URL` and `DIRECT_DATABASE_URL` are set, on `localhost`, and name a
`nimbus_event_*` database. It then validates the data files, runs `prisma migrate deploy`, runs
`db:seed` (for the global roles and permissions the venue's people are given; the seed also makes its
own small demo organisation), and loads the venue in one transaction. A second load into the same
database is refused.

**Sign-in**: every person gets a random password, and every role allowed a PIN gets a random PIN
(6 digits for waiter, cashier, bartender, chef, stock manager; 8 for supervisor and manager; owner
and accountant have no PIN by design, `quick-pin.constants.ts`). They are printed **once, on stderr**,
and written nowhere. Do not redirect stderr to a file. PIN sign-in is `POST /api/auth/quick-pin-login`
with `platform: "POS_DESKTOP"` and the branch id.

Check it: `psql -d <db> < packages/db/demo-venue/check.sql` (counts, and the bad-state checks from
the R-E1 review, which must be 0 for the venue).

## What is in it

| file | what |
|---|---|
| `data/venue.json` | organisation and branch; 64 tables in 4 areas — Main hall 32, Terrace 16, Bar 10, VIP 6 — one floor plan per area (the Floor groups tables by floor plan name) |
| `data/people.json` | 21 people: 2 owners, 2 managers, 2 supervisors, 2 cashiers, 4 waiters, 2 bartenders, 3 chefs, 2 store keepers (role "Stock Manager"), 2 accountants |
| `data/menu.json` | 242 items: Food (132) and Drinks (110), 13 groups, 36 sub-groups; 36 spirits by tot, double and bottle; beers, draught by pint and half pint; 16 wines by glass and bottle; cocktails, soft drinks, juices, water, hot drinks |
| `data/modifiers.json` | 12 choice groups (how cooked, side, sauce, extras, leave out, spice, milk, mixer…); 83 items offer choices |
| `data/stock.json` | 149 stock items with units (kg, l, pc, ml) and unit costs |
| `data/recipes.json` | 57 recipes; amounts are in each stock item's own unit, which is how the API costs a sold line (`orders.service.ts` `computeLinePricing`); cost is 9–45 % of the price |
| `data/service.json` | the service in progress: 17 open tables across 3 waiters (not sent, sent, sent with new lines, in kitchen, ready, served, bill asked), 9 bookings today (2 seated, 1 completed, 1 late and not seated, 1 whose table still has an open bill, 1 confirmed later, 1 pending, 1 cancelled, 1 no-show), an open till with a float and cash sales, 4 paid bills (cash with change, card, mobile money, card + cash) |

Times are relative to the moment of loading (Africa/Kampala). The service mirrors what the engine
writes (E1 schema): `sentAt` on every sent line, one kitchen-ticket line per sent line on a station,
totals from live lines, cash `tendered` and `changeGiven`, tables occupied only where the engine
occupies them, waiters' shifts open, and `ORD-`/`RES-`/`SHF-` numbers that the API's generators
continue from.

**Needs the E1 migration** (`20261126000000_e1_order_truth`): it writes `order_items.sent_at`,
`payments.tendered` and `payments.change_given`.

## Not in it, and why

- **"Bill asked" is only an audit row** (`ORDER_BILL_REQUESTED`), the engine's own marker; no API
  reads it back yet, so the Floor cannot show it from data until one does.
- **No stock on hand**: stock items, units, costs and recipes only. No batches, ledger entries or
  counts (stock movement is milestone E6).
- **No guest names on tables**: bookings carry made-up names; the Floor must not show them.
- **No employees' pay, contracts or documents.**

## Files

`lib.ts` (types, the localhost guard, the validator) · `validate.ts` (validator CLI: exit 0 green,
1 with every error) · `load.ts` (the loader) · `run.sh` (the one command) · `check.sql` (counts and
bad-state checks).
