# API_CONVENTIONS.md — Nimbus POS Rebuild

## General

- Base path: `/api`
- JSON only in v1
- Use plural resource nouns where practical
- Use branch context explicitly in auth/session or header where needed
- Every response should include enough IDs for client chaining

## Auth (M2) ✅

- Bearer JWT access token (`Authorization: Bearer <token>`)
- Refresh token rotation via `POST /api/auth/refresh`
- PIN login for POS flow via `POST /api/auth/pin-login`
- MSR endpoints deferred until M46

### Auth Endpoints

| Method | Path                  | Auth | Description                          |
| ------ | --------------------- | ---- | ------------------------------------ |
| POST   | `/api/auth/login`     | No   | Email + password login               |
| POST   | `/api/auth/pin-login` | No   | Email + 4-6 digit PIN login          |
| POST   | `/api/auth/refresh`   | No   | Rotate refresh token, get new pair   |
| POST   | `/api/auth/logout`    | Yes  | Revoke current session               |
| POST   | `/api/auth/logout-all`| Yes  | Revoke all sessions for current user |
| GET    | `/api/auth/me`        | Yes  | Current user profile + session       |
| GET    | `/api/auth/sessions`  | Yes  | List active sessions                 |

### Quick PIN Login (M3.1) ✅

- Quick PIN login for POS Desktop only via `POST /api/auth/quick-pin-login`
- Role-tier PIN policy: LOW_6 (6-digit) for Waiter/Cashier/Bartender, HIGH_8 (8-digit) for Supervisor/Manager
- Dual-hash security: HMAC-SHA256 lookup hash (indexed) + bcrypt verification hash
- Lockout: 5 failed attempts → 5 minute lock
- Platform enforcement: only `POS_DESKTOP` allowed for quick PIN login

### Quick PIN Endpoints

| Method | Path                                       | Auth | Description                         |
| ------ | ------------------------------------------ | ---- | ----------------------------------- |
| POST   | `/api/auth/quick-pin-login`                | No   | Branch + PIN login (POS_DESKTOP)    |
| POST   | `/api/auth/users/:id/issue-quick-pin`      | Yes  | Issue new quick PIN for user        |
| POST   | `/api/auth/users/:id/reset-quick-pin`      | Yes  | Reset user’s quick PIN              |
| PATCH  | `/api/auth/users/:id/quick-pin-settings`   | Yes  | Update display name, tier, etc.     |
| GET    | `/api/auth/users/:id/quick-pin-status`     | Yes  | Get user’s quick PIN status flags   |

### Platform Header

`X-Platform` header identifies the calling platform. Guarded endpoints validate this against the user's role level.

Values: `WEB_BACKOFFICE`, `MOBILE_APP`, `POS_DESKTOP`, `KDS_SCREEN`, `SELF_KIOSK`, `DRIVER_APP`

## Tenancy (M3) ✅

- Branch-based multi-tenancy: Org → Branch → Membership
- `X-Branch-Id` header required for branch-scoped endpoints (M4+)
- `GET /api/me` returns full tenancy context (orgs, branches, roles, permissions)

### Tenancy Endpoints

| Method | Path                                                | Auth | Permission                  | Description                       |
| ------ | --------------------------------------------------- | ---- | --------------------------- | --------------------------------- |
| POST   | `/api/orgs`                                         | Yes  | tenancy:org:write           | Create organization               |
| GET    | `/api/orgs`                                         | Yes  | —                           | List user's organizations         |
| GET    | `/api/orgs/:orgId`                                  | Yes  | —                           | Get org detail (membership check) |
| POST   | `/api/orgs/:orgId/branches`                         | Yes  | tenancy:branch:write        | Create branch in org              |
| GET    | `/api/branches`                                     | Yes  | —                           | List user's accessible branches   |
| GET    | `/api/branches/:branchId`                           | Yes  | —                           | Get branch detail (member check)  |
| POST   | `/api/orgs/:orgId/branches/:branchId/memberships`   | Yes  | tenancy:membership:manage   | Add user membership to branch     |
| GET    | `/api/orgs/:orgId/branches/:branchId/memberships`   | Yes  | tenancy:membership:manage   | List memberships for branch       |
| GET    | `/api/me`                                           | Yes  | —                           | Full tenancy context for user     |
| GET    | `/api/branch-test`                                  | Yes  | — (X-Branch-Id required)    | Branch context guard test route   |

### Branch Context Header

`X-Branch-Id` header is required for all branch-scoped endpoints starting in M5.
- Missing → `400`
- Not found / inactive → `400`
- User not a member → `403`

## Org Settings (M4) ✅

Org-level configuration for VAT, currency, rounding, thresholds, and platform access.

### Settings Endpoints

| Method | Path                            | Auth | Permission               | Description                     |
| ------ | ------------------------------- | ---- | ------------------------ | ------------------------------- |
| GET    | `/api/settings`                 | Yes  | tenancy:org:read         | Get full org settings           |
| PATCH  | `/api/settings`                 | Yes  | tenancy:settings:manage  | Partial update org settings     |
| GET    | `/api/settings/currency`        | Yes  | tenancy:org:read         | Get currency config             |
| PUT    | `/api/settings/currency`        | Yes  | tenancy:settings:manage  | Update currency                 |
| GET    | `/api/settings/tax-matrix`      | Yes  | tenancy:org:read         | Get tax / VAT matrix            |
| PUT    | `/api/settings/tax-matrix`      | Yes  | tenancy:settings:manage  | Update tax matrix               |
| GET    | `/api/settings/rounding`        | Yes  | tenancy:org:read         | Get rounding policy             |
| PUT    | `/api/settings/rounding`        | Yes  | tenancy:settings:manage  | Update rounding policy          |
| GET    | `/api/thresholds`               | Yes  | tenancy:org:read         | Get anomaly/discount thresholds |
| PATCH  | `/api/thresholds`               | Yes  | tenancy:settings:manage  | Update thresholds               |
| GET    | `/api/settings/platform-access` | Yes  | tenancy:org:read         | Get platform access rules       |
| PUT    | `/api/settings/platform-access` | Yes  | tenancy:settings:manage  | Update platform access rules    |
| POST   | `/api/settings/exchange-rate`   | Yes  | tenancy:settings:manage  | Create exchange rate entry      |
| GET    | `/api/settings/exchange-rates`  | Yes  | tenancy:org:read         | List exchange rates             |

## Validation

- DTO classes with `class-validator`
- `whitelist: true`
- `forbidNonWhitelisted: true`
- Normalize dates to UTC
- Money accepted as decimal-safe string or number string

## Error Envelope

```json
{
  "statusCode": 400,
  "error": {
    "code": "DOMAIN_CODE",
    "message": "Human readable message",
    "requestId": "..."
  }
}
```

## Pagination

| Param       | Type           | Description           |
| ----------- | -------------- | --------------------- |
| `page`      | number         | Page number (1-based) |
| `pageSize`  | number         | Items per page        |
| `sort`      | string         | Sort field            |
| `direction` | `asc` / `desc` | Sort direction        |

## Filtering

Prefer query params for simple filters.
Use POST body only for complex report/filter payloads.

## Idempotency (M41+)

Required or strongly recommended for:

- Payment intents
- Order close
- Refunds
- Reservation / booking creation
- Receiving / stock adjustment
- Payroll approval / pay
- Sync replay endpoints

Header: `Idempotency-Key: <unique-client-key>`

## Audit (M2) ✅

All sensitive writes must capture:

- Actor user ID
- Org ID
- Branch ID where relevant
- Action
- Resource type
- Resource ID
- Before / after snapshot where reasonable
- Reason when action is exceptional

## Money & Tax

- Money stored in Decimal-capable fields
- Tax breakdown should be explicit, not hidden in one total
- Totals record: subtotal, discount, service charge, tax, grand total

## Time & Numbering

- Store timestamps in UTC
- Number sequences generated by server
- Receipt / order / PO / journal numbers are never client-generated
