# Pre-existing issues

Found while working on something else. Logged, not fixed. Newest first.

## 2026-11-21 · `orders.e2e-spec.ts` › "POST /api/pos/orders/:id/close — SERVED → CLOSED" returns 400

- **Found by:** H1-R2 review (question 9 from H1F).
- **What:** the test expects 200 and gets `400 Bad Request`. It posts a fixed `payments: [{ method: 'CASH', amount: 9999 }]` against an order whose total it does not compute.
- **Pre-existing, measured [live]:** the same test, same failure (`expected 200 "OK", got 400`), 17 of 18 passing, at both:
  - `23c7a2c` (before H1), temporary worktree, its own install and Prisma client, fresh `postgres:16` database `nimbus_event_h1r2_base` (:55475), `migrate deploy` (59 migrations) + `db:seed`;
  - HEAD `09120ec` (H1 + H1F), fresh database `nimbus_event_h1r2_q9` (:55474), `migrate deploy` (61 migrations) + `db:seed`.
- **Not a regression of H1/H1F.** The quick-sale allocator is not on the restaurant close path.
- **Not done:** the reason inside the 400 body was not captured (the test does not print it). Likely the fixed 9,999 does not cover the seeded order's total; check before fixing the test or the endpoint.
