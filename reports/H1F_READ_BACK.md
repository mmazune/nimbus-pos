# H1F read-back (21 Nov 2026)

Baseline [live]: disposable `nimbus_event_h1f` (:55473), migrations 60/60 applied, seeded. H1 e2e then the review spec: the 13 named probes red, plus C10 red only because the review spec ran before H1's fixture night (an ordering control, not a finding). Red names in `reports/H1F_RED_RUN.txt`.

| Finding | Fix I will make | Probe |
|---|---|---|
| F-1 replay must be same sale (blocker) | On write, store `metadata.fingerprint` (soldAt and tenderedAmount as sent). On either replay path (up-front lookup, unique-violation handler) compare the request with the stored order: till, method, scheme/network, lines as a multiset of (item by sku or id, serving, qty), tendered as sent, soldAt as sent. Mismatch is **409 `CLIENT_SALE_ID_PAYLOAD_MISMATCH`**, nothing written. `authCode`, `cardLast4`, `terminalId` are not compared. | A1 x4 and the control |
| F-2 audit log (blocker) | Error line carries orderId, orderNumber, clientSaleId, branchId, tillCode, plus error name and last line only. No card data. | R1 |
| F-3 allocator scan | New additive migration: expression index on `(branch_id, numeric part of order_number)`. Query becomes MAX of the same expression (min/max index plan). | new H1F spec + proof file |
| F-4 2^31 overflow | Index and query cast to NUMERIC, not INTEGER or BIGINT, so no row can ever overflow the cast (a BIGINT index would make any 19+ digit `ORD-` row fail every insert into `orders`). | B5 |
| F-5 till codes | `@Transform` trim+upper on `QuickSaleDto.tillCode` (and in the service). Expected cash matches `tillCode IN (session code, trimmed-upper session code)`. Till-open path untouched. | F13 x3, F14 |
| F-6 card number in text | `authCode` `^[A-Za-z0-9]{1,8}$`, `terminalId` `^[A-Za-z0-9-]{1,12}$`; `externalTransactionId`/`payerPhone` MOMO only (400 otherwise); `payerPhone` 7-12 digits with optional `+`. Messages never echo the value. | H18 x2 |

Questions with defaults (no one to ask, so I take them):
1. Q: fingerprint line key, raw request or resolved item? Default: compare against the stored order rows, so `sku` on one send and `menuItemId` on the retry still match. Missing fingerprint on an old row: compare only what the rows hold.
2. Q: `payerPhone` shape? Default 7-12 digits, so no 13-19 digit card number can pass it.

**One probe I believe is wrong (stop on that item, carry on):** `R2 > the number query reads a handful of rows` runs a hard-coded copy of the OLD SQL (`CAST(... AS INTEGER)`), not the service's query. No index can serve that text unless it is an INTEGER expression index, and that index would make the B5 probe's `ORD-99999999999` row fail at insert (cast overflow), so the two probes cannot both pass. Checked [live]: a NUMERIC index leaves the INTEGER text a Seq Scan (10,000 rows read) and serves the NUMERIC text with 1 row read, 0.05 ms. I will not edit it; I will prove the same property on the service's real query in a new spec and in `reports/proof/H1F_allocator.txt`. Expect 12 of 13 green, with this one named.

Other notes: no `.loadmaster.toml` in the repo, so I added an untracked one (listed in `.git/info/exclude`) to run checks through loadmaster; removed at the end. Cause of the H1 "ECONNRESET" flake, from supertest source [code]: the first request to a non-listening Nest server calls `listen(0)` and closes it when it ends, cutting the other 19 in flight. Fix in H1's own e2e: `app.listen(0)` once. The review spec has the same pattern; I do not edit it.
