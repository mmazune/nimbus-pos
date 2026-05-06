# Sync Contract — Offline-Safe Write Replay (M41)

> **Status:** LIVE. The reliability layer is shipped as a generic primitive in
> `apps/api/src/modules/reliability`. Service workers and offline clients written
> in future milestones MUST conform to the contract below.

This document is the source of truth for how Nimbus POS clients capture, queue,
and replay write intents while offline. The server side is owned by
`SyncService` (idempotent queue + replay orchestrator), `IdempotencyService`
(generic key store), and `ReplayDispatcherService` (per-type handler registry).

---

## 1. Endpoints

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `POST` | `/api/sync/replay` | `sync:jobs:write` | Submit a batch of captured write intents. |
| `GET` | `/api/sync/jobs` | `sync:jobs:read` | List jobs (filter by `status`, `type`, `branchId`, `origin`, `since`, `limit`). |
| `GET` | `/api/sync/jobs/:id` | `sync:jobs:read` | Inspect one job with attempt history + conflicts. |
| `POST` | `/api/sync/jobs/:id/retry` | `sync:jobs:retry` | Re-run a `RETRYABLE` or `FAILED` job. **409** if already `SUCCEEDED`. |
| `GET` | `/api/sync/conflicts` | `sync:conflicts:read` | List conflicts (filter by `status`, `type`). |
| `PATCH` | `/api/sync/conflicts/:id/resolve` | `sync:conflicts:resolve` | Resolve OPEN conflict with `SERVER_TRUTH_KEPT` / `CLIENT_PAYLOAD_APPLIED` / `MANUAL_MERGE` / `DISCARDED`. |
| `POST` | `/api/idempotency/inspect` | `idempotency:inspect` | Debug — look up an idempotency key by `(scope, routeMethod, routePath, key)`. |

All replay endpoints require an active membership; the org context is resolved
server-side from the JWT.

---

## 2. Replay batch payload

```jsonc
POST /api/sync/replay
{
  "executeNow": true,           // default true. set false to queue without running
  "jobs": [
    {
      "clientMutationId": "uuid-or-cuid-from-client",   // REQUIRED — uniqueness key
      "type": "GENERIC_REPLAY",                          // see "Replayable Types"
      "idempotencyKey": "client-generated-key",          // optional, forwarded to handler
      "routeMethod": "POST",                             // optional context
      "routePath": "/api/payments/intents",              // optional context
      "requestBody": { /* whatever the original request would have sent */ },
      "requestHeaders": { /* optional, will NOT be replayed verbatim */ },
      "intentSummary": "Capture KSH 50 from cash drawer",
      "capturedAt": "2026-04-26T18:14:00.000Z",          // when the intent was first formed offline
      "branchId": "cuid…",                               // optional, validated against org
      "origin": "OFFLINE_CLIENT",                        // OFFLINE_CLIENT | SERVICE_WORKER | SUPPORT_REPLAY | SYSTEM_RETRY
      "metadata": { /* free-form */ }
    }
  ]
}
```

### Response

```jsonc
{
  "accepted": 1,
  "results": [
    {
      "clientMutationId": "…",
      "jobId": "cuid…",
      "status": "SUCCEEDED",   // or QUEUED / IN_PROGRESS / RETRYABLE / CONFLICT / FAILED
      "resultRef": "GenericReplay:cuid…",   // entity created/updated, namespaced as Type:id
      "conflictId": null,
      "error": null
    }
  ]
}
```

### Idempotency rule (server-truth)

`(orgId, clientMutationId)` is **unique**. Resubmitting the same
`clientMutationId` returns the existing `SyncJob` without re-running it. A
client that has not heard back may safely retry with the same id — duplicates
are suppressed. This is the **same-key-same-payload-OK** invariant.

If a client mistakenly reuses a `clientMutationId` for a *different* payload,
the server still returns the original job. Clients MUST therefore generate a
fresh id per logical mutation.

---

## 3. Replayable Types (`SyncJobType`)

| Enum | Status |
|---|---|
| `GENERIC_REPLAY` | LIVE — built-in echo handler (used for smoke, support, and unknown types). |
| `ORDER_DRAFT_UPDATE` | RESERVED — service worker may queue; handler is a future milestone. |
| `PAYMENT_CAPTURE` | RESERVED — see note on public-diner mobile money below. |
| `REFUND_CREATE` | RESERVED. |
| `AR_RECEIPT_CREATE` | RESERVED. |
| `AP_PAYMENT_CREATE` | RESERVED. |
| `RESERVATION_HOLD` / `RESERVATION_CONFIRM` | RESERVED. |
| `EVENT_BOOKING_HOLD` / `EVENT_BOOKING_CONFIRM` | RESERVED. |
| `STOCK_ADJUSTMENT` | RESERVED. |
| `ATTENDANCE_EVENT` | RESERVED. |
| `SHIFT_ACTION` | RESERVED. |

> **Locked decision (M41):** Public diner mobile-money payment **execution**
> remains PENDING. No `PAYMENT_CAPTURE` handler is registered for the public
> diner path. Reservations and event bookings continue to confirm as
> `PAYMENT_PENDING` — exactly as locked in M39.

A milestone that owns one of the RESERVED types registers a handler at module
init via `ReplayDispatcherService.register(type, handler)`. Until a handler is
registered, jobs of that type fall through to the generic echo and are
classified `RETRYABLE` so they remain visible without silently succeeding.

---

## 4. Outcomes & state machine

```
QUEUED ──► IN_PROGRESS ──► SUCCEEDED            (terminal)
                       └── RETRYABLE            (back to QUEUED on retry)
                       └── FAILED               (terminal — exceeds maxAttempts or PERMANENT_FAILURE)
                       └── CONFLICT             (terminal until SyncConflict resolved)
                       └── CANCELLED            (manual)
```

* `RETRYABLE` jobs receive `nextRetryAt` with capped exponential backoff
  (`min(2^attempt, 30)` minutes).
* HTTP-style classification used by the dispatcher when a handler throws:
  * `409` ⇒ `CONFLICT`
  * `4xx` (other) ⇒ `PERMANENT_FAILURE`
  * `5xx` or uncaught ⇒ `RETRYABLE`
* All transitions emit audit rows: `SYNC_REPLAY_SUBMITTED`, `SYNC_JOB_SUCCEEDED`,
  `SYNC_CONFLICT_CREATED`, `SYNC_JOB_RETRIED`, `SYNC_CONFLICT_RESOLVED`.

---

## 5. Conflicts

When a handler returns `disposition: 'CONFLICT'` (or throws a 409), a
`SyncConflict` row is created with `clientPayload` (what the client tried) and
`serverState` (what the server actually has). The conflict is `OPEN` until a
human (or eventually a policy) resolves it via:

```jsonc
PATCH /api/sync/conflicts/:id/resolve
{ "resolution": "SERVER_TRUTH_KEPT", "note": "Reservation already cancelled" }
```

Resolution options:

| Resolution | Effect |
|---|---|
| `SERVER_TRUTH_KEPT` | Discard the client payload; server state wins. Final status `RESOLVED`. |
| `CLIENT_PAYLOAD_APPLIED` | Record human override applied. Caller is responsible for the manual write. Final status `RESOLVED`. |
| `MANUAL_MERGE` | Record that a hand-merged outcome was produced elsewhere. Final status `RESOLVED`. |
| `DISCARDED` | Drop the intent without claiming resolution. Final status `DISMISSED`. |

The `SyncJob` itself stays in `CONFLICT` (not auto-rerouted) — to retry after
fixing the underlying state, call `POST /api/sync/jobs/:id/retry`.

---

## 6. Idempotency primitive

`IdempotencyService` is a reusable layer for any controller that wants
header-driven dedup (e.g. `Idempotency-Key: …` on `POST /payments/intents`).
Uniqueness is `(scope, key, routeMethod, routePath)`. Outcomes when
`begin(ctx)` is called:

| Outcome | Meaning |
|---|---|
| `first` | This is a new key — caller proceeds with the real work and calls `complete()`. |
| `replay` | Same key + same fingerprint as a previous SUCCEEDED call — return the stored response immediately. |
| `conflict` | Same key, different fingerprint — caller MUST 409. |
| `in_flight` | A concurrent call is still running — caller SHOULD 409 or back off. |

Default TTL: 24 hours. Records older than `expiresAt` are eligible for cleanup
(no automatic sweeper yet — manual `DELETE` is acceptable in a future cron).

Recommended client header convention for endpoints that opt in:

```
Idempotency-Key: <ulid-or-cuid>
```

---

## 7. Client-side guidance for service workers

1. **Always generate a fresh `clientMutationId`** per user action (cuid2 or
   ULID). Persist it locally before the network attempt.
2. **Capture `capturedAt` once** at the moment the user committed the intent —
   do NOT update it on retry.
3. **Forward the original `Idempotency-Key`** as `idempotencyKey` in the
   replay job payload so server-side dedup remains correct.
4. **Treat `409` from `/sync/jobs/:id/retry` as final.** It means the job
   already SUCCEEDED on a previous attempt — drop the local queue entry.
5. **Treat `CONFLICT` as a UI-blocking surface.** Show the user the diff
   (`clientPayload` vs `serverState`) and require manual resolution.
6. **Do NOT replay handlers that depend on physical-world side effects**
   (cash-drawer kicks, KDS prints) without a `dryRun` flag — those should be
   gated behind explicit user confirmation in the UI.

---

## 8. Out of scope (deferred)

* Background sweeper for expired `IdempotencyKey` rows.
* WebSocket push notifying clients when a `RETRYABLE` job becomes `SUCCEEDED`.
* Per-type handlers for `PAYMENT_CAPTURE` etc. — registered by their owning
  milestones, not by M41.
* Hotel / property-group milestone — explicitly **not** part of the roadmap.
