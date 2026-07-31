# Supervisor Approvals — Shared-Neon Data Audit (Prompt 5A)

Status: COMPLETE — read-only audit, no shared write performed
Date: 2026-07-30
Method: Neon MCP, read-only `SELECT` only, against the shared `production` branch

> **PII policy.** This report contains **counts, enum values, and structural findings only**.
> No employee or guest names, contact details, payroll, or other personal data were copied.
> Branch/user identifiers are referenced by role or redacted handle, never by person.

---

## 1. Branch identity (redacted)

| Field | Value |
| --- | --- |
| Project | `nimbus-pos` (`empty-glade-26849299`), region aws-us-east-1, pg 17 |
| Shared branch audited | `production` = `br-holy-darkness-a4fg93r2` (primary, default) |
| Retained recovery branch | `br-dawn-truth-a4zjs1p7` (Prompt 4C pre-migration; **not touched**) |
| Prompt 5A disposable branch | created/destroyed separately for mutation QA (see QA register) — **never** this branch |
| Write operations to `production` in 5A | **NONE** (all statements were `SELECT`) |

## 2. Migration & schema state

- `_prisma_migrations`: **58 total, 0 rolled back, 0 unfinished** (unchanged from the 4D baseline).
- No schema/DTO/migration change was made or deployed in Prompt 5A. The approval tables
  (`discounts`, `leave_requests`, `shift_swap_requests`, `anomaly_events`), their enums, and
  RBAC tables match the repo Prisma schema (verified via `information_schema.columns`).
- Enum values in use match the schema: `DiscountStatus{PENDING,APPROVED,REJECTED}`,
  `LeaveRequestStatus{PENDING,APPROVED,REJECTED,CANCELLED}`,
  `ShiftSwapStatus{PENDING,APPROVED,REJECTED,CANCELLED}`,
  `AnomalyEventStatus{OPEN,ACKNOWLEDGED,RESOLVED}`.

## 3. Permission result (Supervisor role, live on `production`)

| Permission | Supervisor granted | Gates |
| --- | --- | --- |
| `pos:discount:approve` | ✅ | approve **and** reject discounts + pending list |
| `pos:discount:read` | ✅ | read discounts |
| `pos:hr:leave:review` | ✅ | approve **and** reject leave |
| `pos:hr:leave:read` | ✅ | read leave |
| `pos:hr:shift-swaps:approve` | ✅ | approve **and** reject swaps |
| `pos:hr:shift-swaps:read` | ✅ | read swaps |
| `pos:analytics:anomalies:acknowledge` | ✅ | acknowledge **and** resolve anomalies |
| `pos:analytics:anomalies:read` | ✅ | read anomalies |
| `approvals:read` (unified inbox) | ❌ | — |
| `approvals:decide` (unified inbox) | ❌ | — |

**Finding.** Supervisor is fully empowered for the four domain decision workflows and is
**deliberately excluded** from the generic `unified-approvals` inbox (`/api/approvals`). This
confirms the locked **domain-specific** architecture (Option B): Prompt 5B must call each
domain's canonical endpoint, never `POST /api/approvals/:id/decide`. No permission was added,
changed, or requested. Each decision permission gates BOTH the positive and negative decision
(approve/reject, acknowledge/resolve) — there is no separate reject/resolve permission.

## 4. Queue counts by domain and status

| Domain | PENDING/OPEN | In-progress | Terminal | Total |
| --- | --- | --- | --- | --- |
| Discount | PENDING 2 | — | APPROVED 2 · REJECTED 2 | 6 |
| Leave | PENDING 9 | — | APPROVED 6 · REJECTED 0 · CANCELLED 0 | 15 |
| Shift swap | PENDING 8 | — | APPROVED 2 · REJECTED 2 · CANCELLED 0 | 12 |
| Anomaly | OPEN 7 | ACKNOWLEDGED 8 | RESOLVED 6 | 21 |

**Needs-action queue size (Prompt 5B initial load):** 2 + 9 + 8 + 7 = **26 actionable**, plus
**8 ACKNOWLEDGED anomalies** awaiting resolution (an "in-progress" lane). All are small,
bounded sets — the default Needs-action view will not pile up.

**Branch distribution.** Anomaly events span **5 distinct branches**. This confirms the
Prompt 5A branch-isolation hardening on anomaly acknowledge/resolve is material: a Supervisor
must only decide their own branch's anomalies. (Leave is org-scoped by design; discounts and
swaps were already branch-scoped and remain so.)

## 5. Identity linkage quality (identity resolution feasibility)

All relational-integrity checks returned **0 problem rows**:

| Check | Result |
| --- | --- |
| Leave with NULL branch_id | 0 (all have a branch; schema permits NULL but data is clean) |
| Leave → employee orphan | 0 |
| Leave → requester (user) orphan | 0 |
| Shift swap → requester employee orphan | 0 |
| Shift swap → target employee orphan | 0 |
| Anomaly NULL actor_user_id | 0 |
| Anomaly → actor (user) orphan | 0 |
| Discount → order orphan | 0 |
| Discount → creator (user) orphan | 0 |
| Employees with empty first_name | 0 |

**Finding.** Every requester / employee / actor / reviewer relation resolves to a real row —
the Prompt 5B identity resolver can render names with **no orphan/"Unknown staff member"**
cases on current shared data.

**Employee↔User linkage:** 40 employees, of which **27 have no linked login user**
(`user_id IS NULL`). This is expected (not every employee logs in) and does **not** block
identity: leave/swap subjects are `Employee` rows whose `first_name`/`last_name` are always
present, so names resolve regardless of a login link. Note: the `employees` table has **no
`display_name` column** — the frontend `getSupervisorEmployeeName` `displayName` branch is
dead and always falls through to `firstName + lastName` (harmless; documented for 5B).

## 6. Terminal-record attribution & duplicate audit check

| Check | Result |
| --- | --- |
| Terminal leave with NULL reviewer | 0 |
| Terminal swap with NULL reviewer | 0 |
| APPROVED discount with NULL approver | 0 |
| REJECTED discount with NULL rejecter | 0 |
| Terminal anomaly with NULL acknowledger | 0 |
| RESOLVED anomaly with NULL resolution_notes | **6** (all 6) |
| Duplicate decision `audit_logs` rows (any of the 8 decision actions) | **0 rows exist at all** |

**Findings.**
1. **Seed provenance, not a defect:** the seeded terminal records carry their reviewer/approver
   FK attribution (0 missing), but there are **no `audit_logs` decision events** for them —
   they were seeded with a final status directly, not driven through the audited service path.
   Real decisions made through the API (including Prompt 5A's hardened paths) DO write audit
   events. There are therefore **zero duplicate decision audits**.
2. **All 6 RESOLVED anomalies lack `resolution_notes`.** The live resolve endpoint now
   *requires* `resolutionNotes`, but the seed bypassed validation. Non-blocking; the Prompt 5B
   History view must tolerate a null resolution note on legacy/seeded rows.

## 7. Stale / inconsistent record classification (read-only, no repair)

Per the Prompt 5A boundary, **no shared record was modified, approved, rejected, resolved, or
deleted**. Classification of the current shared data:

| Category | Count | Disposition |
| --- | --- | --- |
| Actionable PENDING/OPEN (normal queue) | 26 | Requires a genuine Supervisor decision — leave for 5B live use, do **not** auto-decide |
| ACKNOWLEDGED anomalies awaiting resolution | 8 | Normal in-progress lane — individual resolution only, no bulk |
| RESOLVED anomalies missing resolution notes | 6 | Historical demo data — display-tolerant in 5B; **no** back-fill |
| Terminal records without an audit event | all seeded terminal rows | Historical demo data — provenance only, **no** synthetic audit back-fill |
| Missing identity relation | 0 | none |
| Orphaned shift/order relation | 0 | none |
| Duplicate terminal decision | 0 | none |
| Cannot determine safely | 0 | none |

**No dry-run repair is required** — there are no orphaned, duplicate, or ambiguous rows. The
only "imperfections" (null resolution notes, absent audit trail on seeded rows) are historical
demo-data provenance and must be tolerated by the UI, **not** repaired on shared Neon.

## 8. Confirmation

- **Every statement in this audit was a read-only `SELECT`.**
- **No `INSERT`/`UPDATE`/`DELETE`/`ALTER`, no migration, no seed** ran against `production`.
- Post-audit baseline recheck (see completion report §cleanup) confirms `production` is
  unchanged: 58 migrations / 0 rolled back / 836 role_permissions / 126 reservations.
- Destructive/mutation QA for Prompt 5A ran **only** on a disposable Neon branch (see
  `ai/SUPERVISOR_APPROVALS_QA_RECORD_REGISTER.md`).
