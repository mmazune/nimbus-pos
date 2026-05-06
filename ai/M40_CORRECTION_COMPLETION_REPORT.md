# M40 Correction Patch — Completion Report

**Date**: 2026-04-27
**Type**: Post-release stabilisation / model refinement
**Base milestone**: M40 — Alerts + Digests + Real-Time Owner Views

---

## 1. Root Cause Summary

Two independent defects were identified after M40 shipped:

| # | Area | Defect | Impact |
|---|------|--------|--------|
| 1 | Postman — folder B | "Update Alert Rule (disable)" used `{{ruleId}}` with no fallback | Cold-session run → 400 / undefined URL |
| 2 | Postman — folder F | "Retry Delivery" used `{{deliveryId}}` with only a `console.warn` skip | Cold-session run → request skipped silently |
| 3 | Alert model | No `alertCategory` / `channelIntent` fields — all 10 alert types were undifferentiated for channel routing | Rules and channel dispatcher had no routing dimension |

---

## 2. Changes Made

### 2a. Postman collection — `M40-Alerts-Digests-Owner-Live.postman_collection.json`

**Folder B — Alert Rules** (new folder-level prerequest, 58 lines):
- Checks `getVar('ruleId')` — if truthy, skips
- If empty: calls `GET /api/alerts/rules` → captures `arr[0].id` into `ruleId` + `ruleCode`
- If list empty: creates a minimal `LOW_STOCK` rule via `POST /api/alerts/rules`, captures new id
- Writes both collection and environment scope

**Folder F — Alert Deliveries / Retry** (new folder-level prerequest, 61 lines):
- Checks `getVar('deliveryId')` — if truthy, skips
- If empty: calls `GET /api/alerts/deliveries` → finds first row with `status === 'RETRY_SCHEDULED'`
- If none: dispatches `POST /api/alerts/test` with `{ channelCodes: ['slack-ops'], forceFailure: true }` to create a RETRY_SCHEDULED delivery
- Writes both scopes

**README folder** (request 00 Read Me):
- Folder F row updated to `[STANDALONE]` with auto-resolution annotation
- Variable table rows for `ruleId`, `ruleCode`, `deliveryId` updated with auto-resolution descriptions

**Validated** (node -e check): B event=true (58 lines) ✅, F event=true (61 lines) ✅, README F row ✅

### 2b. `ai/AI_POSTMAN_WORKING_PATTERNS.md` — rules R17–R20

| Rule | Title | Summary |
|------|-------|---------|
| R17 | Upstream Entity Resolution | PATCH/DELETE/retry requests must resolve their entity ID via list-first → create-if-missing in a folder-level prerequest |
| R18 | Standalone Folder Status | Every folder must be labelled [STANDALONE] or [REQUIRES PRIOR FOLDERS]; default to STANDALONE |
| R19 | Alert Channel Routing Documentation | Collections testing alert dispatch must document the channel intent model (mobile/SMS, email/digest, Slack/webhook) |
| R20 | Re-import Warning Per Changed Folder | Folders with changed prerequest/test scripts must include re-import warning in their description |

### 2c. `packages/db/prisma/schema.prisma`

New enums added:
```prisma
enum AlertCategory {
  OPERATIONAL_IMMEDIATE
  OWNER_FINANCE
  BOOKING_EVENT
  TECHNICAL_INTEGRATION
}

enum AlertChannelIntent {
  MOBILE_SMS
  EMAIL_DIGEST
  SLACK_WEBHOOK
  ALL_CHANNELS
}
```

New nullable fields on `AlertRule`:
```prisma
alertCategory    AlertCategory?      @map("alert_category")
channelIntent    AlertChannelIntent? @map("channel_intent")
```

New index:
```prisma
@@index([orgId, alertCategory, status])
```

Schema header comment updated to list the two new enums.

### 2d. Migration — `20260427000000_m40_alert_category_channel_intent`

File: `packages/db/prisma/migrations/20260427000000_m40_alert_category_channel_intent/migration.sql`

Applied via `prisma db execute` (direct SQL) because `prisma migrate dev` detected
drift on 3 earlier migrations and would have forced a full reset. Migration then
registered via `prisma migrate resolve --applied`. Prisma client regenerated.

SQL summary:
- `CREATE TYPE "AlertCategory" AS ENUM (...)`
- `CREATE TYPE "AlertChannelIntent" AS ENUM (...)`
- `ALTER TABLE "alert_rules" ADD COLUMN "alert_category" "AlertCategory" NULL`
- `ALTER TABLE "alert_rules" ADD COLUMN "channel_intent" "AlertChannelIntent" NULL`
- `CREATE INDEX "alert_rules_org_id_alert_category_status_idx" ON "alert_rules" (...)`

### 2e. `apps/api/src/modules/alerts/dto/index.ts`

- Added `ALERT_CATEGORIES` and `ALERT_CHANNEL_INTENTS` const arrays
- Added `@IsEnum(ALERT_CATEGORIES) @IsOptional() alertCategory?` to `CreateAlertRuleDto`
- Added `@IsEnum(ALERT_CHANNEL_INTENTS) @IsOptional() channelIntent?` to `CreateAlertRuleDto`
- Added same two optional fields to `UpdateAlertRuleDto`

### 2f. `apps/api/src/modules/alerts/alerts.service.ts`

Two new helper functions added:

```
deriveAlertCategory(type) → AlertCategory string
deriveChannelIntent(type)  → AlertChannelIntent string
```

Channel routing table:

| Alert type | Category | Channel intent |
|------------|----------|----------------|
| LOW_STOCK | OPERATIONAL_IMMEDIATE | MOBILE_SMS |
| CASH_VARIANCE | OPERATIONAL_IMMEDIATE | ALL_CHANNELS |
| SHIFT_NOT_CLOSED | OPERATIONAL_IMMEDIATE | MOBILE_SMS |
| BILLING_PAYMENT_FAILURE | OWNER_FINANCE | ALL_CHANNELS |
| OVERDUE_VENDOR_BILL | OWNER_FINANCE | EMAIL_DIGEST |
| FRANCHISE_BRANCH_AT_RISK | OWNER_FINANCE | EMAIL_DIGEST |
| LARGE_WASTAGE_SPIKE | OWNER_FINANCE | EMAIL_DIGEST |
| BOOKING_REMINDER | BOOKING_EVENT | EMAIL_DIGEST |
| UPCOMING_EVENT_STOCK_RISK | BOOKING_EVENT | EMAIL_DIGEST |
| FAILED_WEBHOOK_DELIVERY | TECHNICAL_INTEGRATION | SLACK_WEBHOOK |

`createRule()`: passes `alertCategory` and `channelIntent` with auto-derivation fallback.
`updateRule()`: spreads `alertCategory` / `channelIntent` if provided in DTO.

### 2g. `packages/db/prisma/seed.ts`

- `RULES` array type definition extended with `alertCategory` and `channelIntent` required fields
- All 6 seed rules updated with explicit values (see routing table above)
- `prisma.alertRule.create` data block passes `alertCategory: r.alertCategory as any` and `channelIntent: r.channelIntent as any`

---

## 3. Files Changed

| File | Change |
|------|--------|
| `postman/collections/M40-Alerts-Digests-Owner-Live.postman_collection.json` | Folder B + F prerequest scripts; README + variable table |
| `ai/AI_POSTMAN_WORKING_PATTERNS.md` | R17–R20 added |
| `packages/db/prisma/schema.prisma` | AlertCategory + AlertChannelIntent enums; AlertRule fields + index; header comment |
| `packages/db/prisma/migrations/20260427000000_m40_alert_category_channel_intent/migration.sql` | New migration file |
| `apps/api/src/modules/alerts/dto/index.ts` | ALERT_CATEGORIES + ALERT_CHANNEL_INTENTS consts; new DTO fields |
| `apps/api/src/modules/alerts/alerts.service.ts` | deriveAlertCategory + deriveChannelIntent helpers; createRule + updateRule wired |
| `packages/db/prisma/seed.ts` | RULES type + all 6 rule objects updated; create call passes new fields |
| `ai/AI_STATUS.md` | Updated date, migration/report counts, M40 correction subsection added |

---

## 4. Invariants Unchanged

- All 19 existing Postman requests retained without modification to their body/URL/headers
- No new API endpoints added
- No existing endpoint signatures changed
- No permissions changed
- No existing seed data removed
- Owner SaaS billing alert LIVE / public diner payment PENDING split unchanged
