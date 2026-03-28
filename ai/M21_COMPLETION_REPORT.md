# M21 Completion Report — Customer Feedback + NPS + QR Follow-up

## Milestone Summary

| Field     | Value                                     |
| --------- | ----------------------------------------- |
| Milestone | M21                                       |
| Title     | Customer Feedback + NPS + QR Follow-up    |
| Branch    | `milestone/m21-feedback-nps-qr-follow-up` |
| Date      | 2026-03-29                                |
| Status    | ✅ Complete                               |

## Deliverables

### Schema

- **5 enums**: FeedbackStatus, FeedbackSource, FeedbackSentiment, FeedbackRequestStatus, NpsBucket
- **4 models**: Feedback, FeedbackTag, NpsSummary, FeedbackRequest
- **Relations**: Feedback → Org, Branch, Order?, Reservation?, Event?, FeedbackRequest?, User (acknowledgedBy, resolvedBy). FeedbackTag → Feedback (unique on feedbackId + tagKey). FeedbackRequest → Org, Branch, Order?, Reservation?, Event?, User (createdBy).
- **Migration #26**: `20260329000000_m21_feedback_nps_qr_followup`

### Module

- `apps/api/src/modules/feedback/feedback.module.ts` — NestJS module
- `apps/api/src/modules/feedback/feedback.service.ts` — 15 methods
- `apps/api/src/modules/feedback/feedback.controller.ts` — 10 admin endpoints
- `apps/api/src/modules/feedback/feedback.public.controller.ts` — 2 public endpoints
- `apps/api/src/modules/feedback/dto/` — 7 DTOs + barrel export

### Endpoints (12 total)

| #   | Method | Path                            | Auth | Permission                    |
| --- | ------ | ------------------------------- | ---- | ----------------------------- |
| 1   | POST   | `/feedback/requests`            | JWT  | `pos:feedback:request:create` |
| 2   | GET    | `/feedback/requests`            | JWT  | `pos:feedback:read`           |
| 3   | PATCH  | `/feedback/requests/:id/cancel` | JWT  | `pos:feedback:request:cancel` |
| 4   | GET    | `/feedback`                     | JWT  | `pos:feedback:read`           |
| 5   | GET    | `/feedback/:id`                 | JWT  | `pos:feedback:read`           |
| 6   | PATCH  | `/feedback/:id/tag`             | JWT  | `pos:feedback:tag`            |
| 7   | GET    | `/feedback/tags`                | JWT  | `pos:feedback:read`           |
| 8   | PATCH  | `/feedback/:id/acknowledge`     | JWT  | `pos:feedback:acknowledge`    |
| 9   | PATCH  | `/feedback/:id/resolve`         | JWT  | `pos:feedback:resolve`        |
| 10  | GET    | `/feedback/nps-summary`         | JWT  | `pos:feedback:nps:read`       |
| 11  | GET    | `/feedback/public/token/:token` | None | —                             |
| 12  | POST   | `/feedback/public`              | None | —                             |

### Permissions (9 new → 122 total)

- `pos:feedback:read`
- `pos:feedback:request:create`
- `pos:feedback:tag`
- `pos:feedback:acknowledge`
- `pos:feedback:resolve`
- `pos:feedback:nps:read`
- `pos:feedback:request:cancel`
- `pos:feedback:public:token:read`
- `pos:feedback:analytics:read`

### Tests

| Suite                           | Count  | Status      |
| ------------------------------- | ------ | ----------- |
| Unit (feedback.service.spec.ts) | 34     | ✅ All pass |
| E2e (feedback.e2e-spec.ts)      | 25     | ✅ All pass |
| **Total M21**                   | **59** | ✅          |

### Seed

- 9 permissions upserted (idempotent)
- 33 role-permission mappings created
- Seed runs twice without error (idempotent verified)

### Postman

- Collection: `M21-Customer-Feedback-NPS-QR-Followup.postman_collection.json`
- 14 requests with test scripts
- Auto-captures: accessToken, branchId, feedbackRequestId, feedbackToken, feedbackId

### Documentation

- `docs/FEEDBACK_NPS_GUIDE.md` — domain guide
- `docs/MODULES.md` — updated (M21 row)
- `ai/AI_STATUS.md` — updated (M21 checklist)
- `ai/M21_COMPLETION_REPORT.md` — this file

## Business Rules

1. **NPS Scoring**: 0-6 = Detractor, 7-8 = Passive, 9-10 = Promoter
2. **Sentiment Inference**: NPS-first, falls back to star rating
3. **Token Security**: 32 random bytes (hex), unique per request
4. **Expiry**: Default 7 days, configurable via DTO
5. **Duplicate Prevention**: Token can only be submitted once (SUBMITTED status check)
6. **Rate Limiting**: In-memory 10s cooldown per token on public submit
7. **Branch Isolation**: All CRUD operations scoped to organization + branch
8. **Audit Trail**: All state mutations logged via AuditService

## DONE Checks

- [x] TypeScript: `tsc --noEmit` → 0 errors
- [x] Unit tests: 34/34 pass
- [x] E2e tests: 25/25 pass
- [x] Seed: idempotent (ran twice — Created: 0 both runs)
- [x] Migration applied: #26 (prisma migrate deploy — "No pending migrations")
- [x] Postman collection created: 14 requests, all baseUrl+path correct
- [x] AI_STATUS.md updated (full M21 checklist)
- [x] MODULES.md updated (M21 ✅)
- [x] POSTMAN_ENDPOINT_GUIDE.md updated (M21 section added)
- [x] repo file tree.txt updated (feedback module, migrations, Postman, docs)
- [x] M21_COMPLETION_REPORT.md finalized
- [x] M13.1/M13.2 remain PENDING (untouched)
- [x] ESLint: 0 errors (15 pre-existing no-explicit-any warnings only)
- [x] DB verified: 9 feedback permissions + 122 total, 524 role-perm mappings
- [x] Seeded users verified: owner/manager/chef/cashier/waiter — all active
- [x] Public flow safety: no orgId/token/createdById leaks in public responses
- [x] Guard coverage verified: 401 / 400 / 403 / 409 all tested
- [x] CI: .github/workflows/branch-validation.yml exists and is valid
- [x] Postman collection: baseUrl=localhost:3001, all paths use /api/..., pm.environment.set used for all runtime captures
- [x] Git commit: `m21 scaffold ok` on branch `milestone/m21-feedback-nps-qr-follow-up`
