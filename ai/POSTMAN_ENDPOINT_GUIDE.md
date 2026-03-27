# Nimbus POS — Endpoint & Postman Contract Guide

This guide is meant to be added to the repo as a **must-read document** for every future milestone prompt.

Recommended location:
- `docs/POSTMAN_ENDPOINT_GUIDE.md`

Recommended addition to every future prompt under **MANDATORY FIRST STEP**:
- `docs/POSTMAN_ENDPOINT_GUIDE.md`

---

## 1) Purpose

This document defines the **single source of truth** for:
- API base URL format
- endpoint path structure
- NestJS route expectations
- Postman collection JSON conventions
- variable scope rules
- auth/token capture rules
- branch header rules
- seed/auth readiness checks
- debugging workflow for 401 / 403 / 404 / 422 style failures

The goal is to stop wasting prompts debugging broken Postman collections one request at a time.

---

## 2) Base API Contract

Nimbus POS API contract:

- API port: `3001`
- Global prefix: `/api`
- Effective base origin: `http://localhost:3001`
- Effective route shape: `http://localhost:3001/api/<route>`

### Canonical Rule

`baseUrl` must be:

```text
http://localhost:3001
```

`baseUrl` must **not** include `/api`.

Correct:

```text
{{baseUrl}}/api/auth/login
{{baseUrl}}/api/me
{{baseUrl}}/api/analytics/anomalies
```

Incorrect:

```text
{{baseUrl}}/auth/login
{{baseUrl}}/analytics/anomalies
{{baseUrl}}/api/api/auth/login
http://localhost:3000/api/auth/login
http://localhost:3000/auth/login
```

---

## 3) Required Postman URL Structure

Every request URL in a collection must satisfy **all** of these:

### Raw URL

Every raw URL must start with:

```text
{{baseUrl}}/api/
```

Examples:

```text
{{baseUrl}}/api/auth/login
{{baseUrl}}/api/me
{{baseUrl}}/api/reservations
{{baseUrl}}/api/reservations/{{reservationId}}
{{baseUrl}}/api/analytics/anomaly-rules
{{baseUrl}}/api/analytics/anomalies
```

### URL Path Array

Every URL `path` array must begin with:

```json
["api", ...]
```

Examples:

```json
["api", "auth", "login"]
["api", "me"]
["api", "reservations"]
["api", "analytics", "anomaly-rules"]
```

If the path array does not begin with `"api"`, the collection is wrong.

---

## 4) Environment vs Collection Variables

### Rule

Use `pm.environment.set(...)` and `pm.environment.get(...)` for all captured variables used across requests.

Do **not** use `pm.collectionVariables.set(...)` for runtime auth and entity IDs when the same key exists in the environment.

### Why

Postman resolves variables in this order:

```text
local → data → environment → collection → global
```

If the environment contains:

```text
accessToken = ""
```

and the collection script does:

```javascript
pm.collectionVariables.set('accessToken', token)
```

then `{{accessToken}}` still resolves from the **environment**, not the collection, causing:

```text
Authorization: Bearer
```

and subsequent `401 Unauthorized` errors.

### Canonical Runtime Variable Rule

Always use environment scope for:
- `accessToken`
- `branchId`
- `reservationId`
- `orderId`
- `refundId`
- `eventId`
- `bookingId`
- `ticketId`
- `ruleId`
- `anomalyId`
- any entity ID captured from one request and reused later

Correct:

```javascript
pm.environment.set('accessToken', pm.response.json().accessToken);
pm.environment.set('branchId', pm.response.json().memberships?.[0]?.branchId);
```

Incorrect:

```javascript
pm.collectionVariables.set('accessToken', token);
pm.collectionVariables.set('branchId', branchId);
```

---

## 5) Required Environment Keys

The dev Postman environment should include at minimum:

```text
baseUrl = http://localhost:3001
accessToken =
branchId =
```

Entity IDs may also exist but can start blank.

Do not assume collection-level fallback is safe.

---

## 6) Auth Contract

### Login Request

Standard login requests must:
- hit `{{baseUrl}}/api/auth/login`
- use correct body format expected by backend
- capture `accessToken` using `pm.environment.set`
- optionally verify role/user payload if returned

### Auth Header

Protected requests must send:

```text
Authorization: Bearer {{accessToken}}
```

If a collection logs in successfully but later requests get 401, first check:
1. did the login script use `pm.environment.set`?
2. is `accessToken` blank in the active environment?
3. is the correct environment selected?
4. is the token expired because the server restarted or DB reseeded?

---

## 7) Branch Context Contract

For branch-scoped endpoints, requests must include:

```text
X-Branch-Id: {{branchId}}
```

Collections must capture `branchId` from a reliable authenticated source, usually:
- login response membership block, or
- `/api/me`, or
- explicit branch lookup endpoint

If a request requires branch context and `branchId` is missing or blank, expect 400 / 403 / 404 depending on guard behavior.

---

## 8) Backend Route Contract

Before blaming Postman, verify the route exists in NestJS.

### A request is only valid if all 3 layers agree:
1. **Controller decorator path** is correct
2. **Global prefix** is `/api`
3. **Postman raw URL and path array** match the controller route

Example:

If backend controller exposes:

```ts
@Controller('analytics')
@Post('anomaly-rules')
```

then Postman must call:

```text
POST {{baseUrl}}/api/analytics/anomaly-rules
```

If `GET /api/analytics/anomaly-rules` works but `POST /api/analytics/anomaly-rules` returns:

```json
{
  "message": "Cannot POST /api/analytics/anomaly-rules",
  "error": "Not Found",
  "statusCode": 404
}
```

that usually means:
- the POST route is not registered in the backend, or
- the controller method is on a different path, or
- the module/controller is not imported/wired correctly

That is **not** automatically a Postman bug.

---

## 9) Mandatory Backend-Readiness Checks Before Postman Testing

Every future milestone prompt must force these checks before any Postman validation:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm db:seed
pnpm lint
pnpm test
pnpm test:e2e
pnpm dev:api
```

### Also required before Postman runs
- verify new permission rows exist in DB
- verify role-permission mappings exist in DB
- verify login user actually has the needed permission
- verify seed created demo users, quick PINs, branches, and any milestone entities required by the collection
- verify API boot log shows expected routes registered

### Reason

A Postman request often fails because:
- DB not migrated
- permissions not seeded
- login credentials not seeded
- branch membership missing
- seed data missing
- route never registered
- collection is targeting old path/port

---

## 10) Standard Failure Diagnosis Table

### 401 Unauthorized
Usually means:
- blank or wrong `accessToken`
- token captured into collection variable instead of environment variable
- expired token after server restart / reseed
- wrong login credentials
- auth header missing

Check:
- login request result
- active environment value for `accessToken`
- auth header
- whether environment is selected

### 403 Forbidden
Usually means:
- permission missing
- permission seeded but not mapped to role
- wrong user role used in collection
- branch guard or org guard rejection

Check:
- permission row exists
- role mapping exists
- logged-in user role is correct
- `X-Branch-Id` is valid

### 404 Not Found
Usually means one of:
- wrong URL path
- missing `/api`
- wrong port
- controller route not implemented
- module/controller not wired
- wrong HTTP method on correct path

Check:
- raw URL begins `{{baseUrl}}/api/`
- path array begins `["api", ...]`
- backend route actually exists
- controller/module imported

### 400 Bad Request
Usually means:
- DTO validation error
- missing required field
- invalid enum value
- bad decimal string format
- missing branch header

Check:
- request body shape
- DTO rules
- content type
- branch header

### 409 Conflict
Usually means:
- duplicate state transition
- duplicate unique key
- already-open/active record conflict
- already-acknowledged or already-closed behavior

Check:
- business rule state machine
- uniqueness constraints
- seed duplicates vs idempotency

---

## 11) Postman Collection JSON Contract

Every collection should follow this structure discipline:

### Collection variable

If the collection contains `baseUrl`, it must be:

```json
{
  "key": "baseUrl",
  "value": "http://localhost:3001"
}
```

Never:
- `http://localhost:3000`
- `http://localhost:3000/api`
- `http://localhost:3001/api`

### Raw URL rule

Correct:

```json
"raw": "{{baseUrl}}/api/analytics/anomaly-rules"
```

Incorrect:

```json
"raw": "{{baseUrl}}/analytics/anomaly-rules"
"raw": "{{baseUrl}}/api/api/analytics/anomaly-rules"
```

### Path rule

Correct:

```json
"path": ["api", "analytics", "anomaly-rules"]
```

### Script rule

Correct:

```javascript
pm.environment.set('ruleId', pm.response.json().id);
```

Incorrect:

```javascript
pm.collectionVariables.set('ruleId', pm.response.json().id);
```

---

## 12) Mandatory Collection Audit Rules

Any LLM editing or generating Postman collections must automatically verify:

1. No `localhost:3000` appears anywhere unless explicitly justified
2. No `baseUrl` contains `/api`
3. Every raw URL begins `{{baseUrl}}/api/`
4. Every path array begins with `"api"`
5. No `pm.collectionVariables.set(` remains for runtime IDs/tokens
6. No `pm.collectionVariables.get(` remains for runtime IDs/tokens
7. Auth token capture uses environment scope
8. Branch ID capture uses environment scope
9. JSON remains valid
10. Collection names and request names still match milestone scope

---

## 13) Mandatory Endpoint Verification Rules for Future Prompts

Every future milestone prompt must include these requirements:

### Before writing Postman collection
- confirm actual controller routes
- confirm global prefix
- confirm base port
- confirm new permissions are seeded
- confirm demo user credentials are seeded
- confirm branch membership is seeded

### Before claiming milestone complete
- run migrate
- run seed
- run seed again
- verify permission rows in DB
- verify role-permission mappings in DB
- verify login works in Postman
- verify `GET /api/health`
- verify at least one protected endpoint with auth + branch header
- verify collection variables are not masking environment variables

---

## 14) Recommended Must-Read Addition for Future Prompts

Add this line to all future milestone prompts under the required file list:

```text
- docs/POSTMAN_ENDPOINT_GUIDE.md
```

Add this rule block to all future milestone prompts:

```text
POSTMAN / ENDPOINT SAFETY RULE:
Before generating or updating any Postman collection, verify:
- baseUrl = http://localhost:3001 with no /api suffix
- every raw URL uses {{baseUrl}}/api/<route>
- every path array begins with "api"
- all captured runtime variables use pm.environment.set/get, not pm.collectionVariables
- db:migrate and db:seed have run
- seed has run a second time successfully
- required permissions and role mappings exist in DB
- login credentials and branch membership used by the collection are actually seeded
- the backend route exists and is registered before assuming a Postman bug
```

---

## 15) Quick Repair Checklist

When a collection is broken, fix in this order:

1. confirm `baseUrl` = `http://localhost:3001`
2. confirm raw URLs use `{{baseUrl}}/api/...`
3. confirm path arrays begin with `"api"`
4. replace all `pm.collectionVariables.set/get` with `pm.environment.set/get` where runtime values are reused
5. run migrate + seed twice
6. verify permissions exist
7. verify login credentials exist
8. verify branch membership exists
9. verify backend route registration
10. rerun Postman collection end to end

---

## 16) Important Truthfulness Rule for LLMs

An LLM must not claim a Postman request is wrong just because it gets a 404.

If the request URL is structurally correct and the server returns:

```text
Cannot POST /api/<path>
```

the LLM must explicitly consider that the backend route may be missing or not wired.

Likewise, the LLM must not claim a collection is correct until it verifies:
- route structure
- auth scope
- seed/auth readiness
- permission readiness
- collection variable scope

