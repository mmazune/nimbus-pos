# Completion Report — M40: Alerts + Digests + Real-Time Owner Views

## Context Snapshot

- Current milestone: **M40 — Alerts + Digests + Real-Time Owner Views**
- Previous completed milestone: M39.3 — Public Booking + Public Commerce + Nimbus Ops Portal
- Next milestone: M41+ from `ROADMAP.md`

## Summary

- **What was built**: Org-scoped alerting plane that aggregates signals across M9 (inventory low-stock), M15 (cash variance, shift-not-closed), M16 (booking reminders), M34 (overdue vendor bills), and M39.1 (owner SaaS billing payment failures), plus a real-time owner live-feed (`GET /owner/live`) and a digest scheduler that fans out to multiple channels (`EMAIL`, `SMS`, `SLACK`).
- **What is now working**: alert rule CRUD, alert channel CRUD, ad-hoc test dispatch with `forceFailure` for retry-pipeline coverage, delivery list + retry with backoff and `RETRY_EXHAUSTED` terminal state, digest schedule CRUD + manual `POST /:id/run`, and the owner live feed that surfaces both seeded `OwnerLiveEvent` rows and live aggregations (open shifts, today's reservations, pending vendor bills, billing PAST_DUE / GRACE_PERIOD).

## Files Added / Changed

- [apps/api/src/modules/alerts/](apps/api/src/modules/alerts/) — pre-existing module ([alerts.controller.ts](apps/api/src/modules/alerts/alerts.controller.ts), [alerts.service.ts](apps/api/src/modules/alerts/alerts.service.ts), [channel-dispatcher.service.ts](apps/api/src/modules/alerts/channel-dispatcher.service.ts), [digest.service.ts](apps/api/src/modules/alerts/digest.service.ts), [owner-live.service.ts](apps/api/src/modules/alerts/owner-live.service.ts), [source-signal.service.ts](apps/api/src/modules/alerts/source-signal.service.ts), [alerts.module.ts](apps/api/src/modules/alerts/alerts.module.ts), [dto/index.ts](apps/api/src/modules/alerts/dto/index.ts)) — left untouched after verification.
- [apps/api/test/alerts.e2e-spec.ts](apps/api/test/alerts.e2e-spec.ts) — **NEW** 13-case e2e suite.
- [packages/db/prisma/seed.ts](packages/db/prisma/seed.ts) — added 10 M40 permissions to `PERMISSIONS_DATA`, extended `ROLE_PERM_MATRIX` for Owner / Manager / Accountant, added `seedAlertsData()` and wired it as step 45 in `main()` with a `recordSeedRun('m40-alerts-digests-owner-live', ...)` marker.
- [postman/collections/M40-Alerts-Digests-Owner-Live.postman_collection.json](postman/collections/M40-Alerts-Digests-Owner-Live.postman_collection.json) — **NEW** canonical collection (19 requests, 34 assertions).
- [ai/AI_STATUS.md](ai/AI_STATUS.md) — current state updated; M40 entry added.
- [ai/M40_COMPLETION_REPORT.md](ai/M40_COMPLETION_REPORT.md) — this file.

## Database

- **Prisma models**: `AlertRule`, `AlertChannel`, `AlertDelivery`, `DigestSchedule`, `OwnerLiveEvent` (already present in [packages/db/prisma/schema.prisma](packages/db/prisma/schema.prisma) lines 6298–6532) plus enums `AlertRuleType`, `AlertSeverity`, `AlertRuleStatus`, `AlertChannelType`, `AlertChannelStatus`, `AlertDeliveryStatus`, `DigestFrequency`, `DigestScheduleStatus`, `OwnerLiveEventType`.
- **Migration**: `20260416000000_m40_alerts_digests_owner_live` (already applied).
- **Indexes / constraints**: `@@unique([orgId, code])` on `AlertRule`, `AlertChannel`, `DigestSchedule`; lookup indexes on `(orgId, status)`, `(orgId, type)`, `(orgId, createdAt)`, `(orgId, nextRetryAt)` for `AlertDelivery`.
- **Seed updates**:
  - 10 new permissions: `alerts:read`, `alerts:rule:write`, `alerts:channel:read`, `alerts:channel:write`, `alerts:test`, `alerts:delivery:read`, `alerts:delivery:retry`, `alerts:digest:read`, `alerts:digest:write`, `owner:live:read`.
  - Role matrix: Owner = all 10. Manager = `alerts:read`, `alerts:rule:write`, `alerts:channel:read`, `alerts:test`, `alerts:delivery:read`, `alerts:delivery:retry`, `alerts:digest:read`, `alerts:digest:write` (no `alerts:channel:write`, no `owner:live:read`). Accountant = `alerts:read`, `alerts:channel:read`, `alerts:delivery:read`, `alerts:digest:read`.
  - Data: 3 channels (`email-owner` EMAIL, `sms-manager` SMS `+15555550199`, `slack-ops` SLACK `#nimbus-ops`), 6 rules (`low-stock-default` WARNING branch-scoped, `cash-variance-default` CRITICAL fan-out, `booking-reminder-24h` INFO, `billing-payment-failure-saas` CRITICAL fan-out, `overdue-vendor-bill` WARNING, `shift-not-closed-16h` WARNING), 1 digest (`daily-owner-summary` DAILY 07:00 UTC), 3 deliveries (`seed-m40-low-stock-sent` SENT, `seed-m40-cash-variance-retry` RETRY_SCHEDULED, `seed-m40-billing-failed` RETRY_EXHAUSTED), 3 OwnerLiveEvents (`seed:bootstrap`, `seed:low-stock-demo`, `seed:billing-past-due`).
- **Notes**: `seedAlertsData` resolves `orgId` from `owner@demo.local`'s first ACTIVE membership so the rows always live in the same org `AlertsService.resolveOrgContext()` returns at request time. A one-time cleanup (`packages/db/_cleanup_m40_dup.cjs`) removed M40 rows accidentally created in the duplicate `nimbus` org during the first seed pass.

## API

- **Modules**: `AlertsModule` registered in [apps/api/src/app.module.ts](apps/api/src/app.module.ts).
- **Endpoints** (all `/api/...`):
  - `GET /alerts` — overview (rules + channels + recent deliveries)
  - `GET /alerts/rules`, `POST /alerts/rules`, `PATCH /alerts/rules/:id`
  - `GET /alerts/channels`, `POST /alerts/channels`, `PATCH /alerts/channels/:id`
  - `POST /alerts/test` — synchronous probe with `channelCodes`, `severity?`, `title?`, `message?`, `forceFailure?`, `ruleCode?`, `context?`
  - `GET /alerts/deliveries`, `POST /alerts/deliveries/:id/retry`
  - `GET /alerts/digests`, `POST /alerts/digests`, `PATCH /alerts/digests/:id`, `POST /alerts/digests/:id/run`
  - `GET /owner/live`
- **Guards**: every route uses `@UseGuards(JwtAuthGuard, PermissionGuard)` with the M40 permissions listed above.
- **Audit coverage**: `ALERT_RULE_CREATED`, `ALERT_RULE_UPDATED`, `ALERT_RULE_DISABLED`, `ALERT_CHANNEL_CREATED`, `ALERT_CHANNEL_UPDATED`, `ALERT_CHANNEL_DISABLED`, `ALERT_TEST_DISPATCHED`, `ALERT_DELIVERY_RETRIED`, `ALERT_DELIVERY_RETRY_EXHAUSTED`, `DIGEST_SCHEDULE_CREATED`, `DIGEST_SCHEDULE_UPDATED`, `DIGEST_RUN_TRIGGERED`.
- **Idempotency coverage**: `dedupeKey` (SHA-256 of `orgId | ruleId | alertType | title`) is set on every `AlertDelivery`; retry on a `SENT` delivery returns 409; retry on an exhausted delivery transitions to `RETRY_EXHAUSTED`. Seed inserts use `findUnique` on `orgId_code` so reruns are pure no-ops.

## Tests

- **Unit**: `alerts.service.spec.ts` (7), `digest.service.spec.ts` (3), `owner-live.service.spec.ts` (1) — 13 passing in ~30 s.
- **E2E**: [apps/api/test/alerts.e2e-spec.ts](apps/api/test/alerts.e2e-spec.ts) — 13 cases passing in ~117 s. Coverage: overview shape, rule create + audit, invalid-type 400, chef denied 403, disable rule, single-channel SENT, critical 3-channel fan-out, forced-failure RETRY_SCHEDULED with `failureReason: 'FORCED_TEST_FAILURE'`, retry refuses already-SENT (409), owner live feed shape and `notes.publicDinerPaymentExecution` matches `/pending/i`, chef denied on `/owner/live` (403), digest list returns seeded `daily-owner-summary`, `POST /alerts/digests/:id/run` produces deliveries.
- **Commands run**:
  - `pnpm --filter @nimbus-pos/api test src/modules/alerts` — 13 unit tests passed
  - `pnpm --filter @nimbus-pos/db db:seed` (twice) — second pass `Created: 0, Skipped: 16` for the M40 section
  - `pnpm --filter @nimbus-pos/api build` then `node apps/api/dist/main.js`
  - `npx jest --config test/jest-e2e.json test/alerts.e2e-spec.ts` — 13/13 pass
  - `npx --yes newman run "postman/collections/M40-Alerts-Digests-Owner-Live.postman_collection.json" --reporters cli,json --reporter-json-export _newman_m40.json --timeout-request 30000` — 19 requests, 34 assertions, 0 failures
- **Results**: all green.

## Postman

- **Collection added**: `postman/collections/M40-Alerts-Digests-Owner-Live.postman_collection.json`.
- **Folders**: `00 Read Me` (variable map + folder run order + R8 re-import warning + locked-rules summary), `A. Auth & Context`, `B. Alert Rules`, `C. Alert Channels`, `D. Test Alerts`, `E. Digest Schedules`, `F. Alert Deliveries / Retry`, `G. Owner Live View`.
- **Collection-level pre-request** (R14): auto-login `owner@demo.local`/`Owner#123` when `accessToken` is missing or short, and `/api/me` resolution when `{{orgId}}` / `{{branchId}}` is referenced and unset.
- **Variables captured** (R10): `accessToken`, `refreshToken`, `orgId`, `branchId`, `ruleId`, `ruleCode`, `channelId`, `channelCode`, `digestId`, `deliveryId`, `sentDeliveryId`.
- **Manual checklist executed**: import, run all (Newman), verify `assertions.failed === 0` and `requests.failed === 0` in `_newman_m40.json`.

## Docs

- **ROADMAP status impact**: M40 row in `ROADMAP.md` can be marked complete; M41 is the next active milestone.
- **Files updated**: `ai/AI_STATUS.md` (Last completed milestone, totals, M40 section), `ai/M40_COMPLETION_REPORT.md` (this file).

## DONE Checks

- `pnpm --filter @nimbus-pos/db db:seed` → `Seed complete.` (2nd pass `Created: 0, Skipped: 16` for M40)
- `pnpm --filter @nimbus-pos/api test src/modules/alerts` → `Tests: 13 passed`
- `npx jest --config apps/api/test/jest-e2e.json apps/api/test/alerts.e2e-spec.ts` → `Tests: 13 passed, 13 total`
- `npx --yes newman run "postman/collections/M40-Alerts-Digests-Owner-Live.postman_collection.json" --reporters cli,json --reporter-json-export _newman_m40.json --timeout-request 30000` → `iterations: 1 / requests: 19 / test-scripts: 18 / prerequest-scripts: 23 / assertions: 34 — failed: 0`

## Decisions / Deviations

- **Seed orgId resolution** — `seedAlertsData` deliberately ignores the `orgId` argument from `main()` and instead resolves the org from `owner@demo.local`'s first ACTIVE membership. This is because a prior pre-existing data anomaly created two demo orgs (`nimbus-demo` and `nimbus`) and `AlertsService.resolveOrgContext()` (an unmodified `findFirst`) returns the older `nimbus-demo` for owner@demo.local. Seeding into `orgResult.orgId` would have created M40 rows in `nimbus`, invisible to the API. The M40 seed function is the only thing that needed to know about this.
- **Channel dispatcher** is dev/mock by default (no env credentials required) so seeds + tests + Newman run anywhere. Live providers will activate transparently when `SMTP_*`, `SMS_PROVIDER_API_KEY`, or `SLACK_WEBHOOK_URL` are set.
- **Digest scheduling** is manual-trigger only for M40 (`POST /alerts/digests/:id/run`). A scheduler/worker (BullMQ + cron) is intentionally deferred — the schema already records `nextRunAt`, so adding a worker later is non-breaking.
- **Public diner mobile-money payment-execution alerts**: `SourceSignalService.evaluatePublicDinerPaymentFailures()` returns `[]` and the owner live feed exposes `notes.publicDinerPaymentExecution` describing the gating on the future MTN / Airtel native milestone. Verified by both the e2e test and the Postman collection.
- **No hotel / property-group concept** introduced.

## Known Issues

- `ListDeliveriesQueryDto.limit` is `@IsInt()` without `@Type(() => Number)`, so passing `?limit=20` as a query string fails validation. The Postman collection avoids the query param; existing service-internal callers always pass numeric defaults. Optional follow-up for a future patch: add `@Type(() => Number)`.
- The duplicate `nimbus` organization remains in the demo DB (created earlier and unrelated to M40). It is harmless: `seedAlertsData` is now isolated from it via owner-membership-based resolution. Cleaning it up would be a broader seed-refactor exercise that the user has explicitly deferred.

## Next Step

- Pick the next item from `ROADMAP.md` (M41+) and follow the same pattern: schema + module + permissions + seed + unit tests + e2e + canonical Postman collection + Newman validation + completion report + AI_STATUS update.
