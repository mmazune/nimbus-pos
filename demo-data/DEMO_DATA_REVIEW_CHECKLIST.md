# Demo Data Review Checklist

Before enabling write-mode:

- [ ] Confirm repo path is `C:\Users\arman\Desktop\nimbus-pos`.
- [ ] Confirm Prisma schema still matches scan outputs.
- [ ] Run importer dry-run with no DB writes.
- [ ] Check duplicate natural keys.
- [ ] Check all FK references resolve.
- [ ] Check all order totals match order lines.
- [ ] Check closed orders have complete payments.
- [ ] Check journal entries balance.
- [ ] Check AP bill totals equal AP lines.
- [ ] Check AR invoice totals equal invoice lines.
- [ ] Check mobile-money rows are pending/provider-gated only.
- [ ] Check receipt send rows are PENDING/no adapter only.
- [ ] Check printer routes do not invoke drivers.
- [ ] Check terminal rows remain STUB only.
- [ ] Check no real PII or live credentials appear.
- [ ] Run `pnpm db:generate`, migrations, seed, importer, API, and web only after review.

## Post-QA local verification

- [x] Repo path confirmed as `C:\Users\arman\Desktop\nimbus-pos`.
- [x] Importer dry-run validation passes with zero DB writes.
- [x] Imported demo users return roles and permissions from `/api/auth/me`.
- [x] Primary waiter Quick PIN login works.
- [x] Primary waiter active shift exists for Tapas Downtown.
- [x] Receipt send remains pending/no live adapter.
- [x] Printer routes remain metadata only.
- [x] Payment terminal devices remain stubs only.
- [x] No Prisma schema changes or migrations were created for demo QA.
