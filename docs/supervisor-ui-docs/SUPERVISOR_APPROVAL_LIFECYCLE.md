# Supervisor Approval Lifecycle

> **Verified 2026-08-20 (isolated local stack) — no stale claims found; the architecture claim is
> now live-proven.** The document's central premise — Supervisor uses **domain-specific** decision
> endpoints because it does **not** hold `approvals:read`/`approvals:decide` — was confirmed by
> probe, not inference: the supervisor JWT carries 133 permissions and holds every
> `pos:discount:approve` / `pos:hr:leave:review` / `pos:hr:shift-swaps:approve` /
> `pos:analytics:anomalies:acknowledge` grant, while `GET /api/approvals` returns **403**
> `Insufficient permissions`. All four Needs-action list queries returned **200**
> (`GET /api/pos/discounts/pending`, `GET /api/hr/leave?status=PENDING`,
> `GET /api/hr/shift-swaps?status=PENDING`, `GET /api/analytics/anomalies?status=OPEN`), as did
> `GET /api/analytics/anomalies?status=ACKNOWLEDGED` and `GET /api/analytics/anomalies/:id`. The
> bounded-pagination hardening also held: `take=500` → **400** *take must not be greater than 100*
> (leave/swap) and `limit=500` → **400** *limit must not be greater than 100* (anomalies).
> Decision endpoints were **not** executed (mutations); each is confirmed by its controller
> decorator in `SUPERVISOR_API_MATRIX.md`. The **discount** queue caveat still holds: there is no
> branch-wide discount list endpoint (SUP-RG-035), so no discount Resolved/History.

Status: reconstruction CLOSED (Prompt 5B2 — Discount + Leave + Anomaly actionable; Shift-swap reject-only Outcome C — B / demo-ready) — 2026-07-31
Date: 2026-07-18 (updated 2026-07-31)

> **Prompt 5B2 (2026-07-31) — Approvals closed.** **Anomaly** Acknowledge (OPEN→ACKNOWLEDGED, note
> optional; stays in Needs action) + Resolve (ACKNOWLEDGED→RESOLVED, note required; evidence preserved,
> underlying entity untouched) are live. **Shift-swap = Outcome C**: Reject only (status + audit, no
> roster change — verified 0 assignments touched), no Approve, honest "reassignment not supported" copy,
> because `ScheduleAssignment` is read-only across the API (no roster-mutation service; SUP-RG-036/042).
> No backend/permission change. Prompt 5 closed at B / demo-ready with known limitations.
>
> **Prompt 5B1 (2026-07-30) — premium Approvals workspace shipped.** The read-only Approvals page is
> replaced by `SupervisorApprovalsWorkspace` on the 5A contract: Needs action / Resolved / History
> scope tabs, All + per-domain filters, server-`total` counts, identity-safe queue rows, responsive
> master-detail, URL state. **Discount + Leave are fully actionable** (canonical domain endpoints +
> payment-gate + truthful self-approval notice; no payroll/roster claim on leave). **Shift-swap +
> Anomaly render read-only** (decisions land in Prompt 5B2). Discounts omitted from Resolved/History
> (SUP-RG-035). No permission/schema/backend change. See the 5B1 completion report.
>
> **Prompt 5A (2026-07-30) — Approvals backend/contract/QA foundation for the 5B UI.**
> **Architecture is domain-specific (Option B):** Supervisor does **not** hold `approvals:read`/
> `approvals:decide`, so the generic `unified-approvals` inbox (`POST /api/approvals/:id/decide`)
> is **not** the Supervisor path — every decision uses its canonical domain endpoint (below).
> **Queue groupings** (`Needs action` / `Resolved` / `History`) are UI-only views over each
> domain's real statuses — see `apps/web/src/lib/supervisor/approvals-contract.ts`
> (`APPROVAL_LIFECYCLE`, `buildApprovalQueueQuery`, `approvalKeys`, `identityFrom*`,
> `approvalDecisionInvalidationKeys`, `mapApprovalErrorToMessage`). **Backend hardening (no
> permission/schema/migration/seed/Postman change):** leave/shift-swap list pagination is now
> coerced + bounded (`Max 100`); shift-swap approve and anomaly acknowledge/resolve are now
> **branch-scoped** (leave stays org-scoped by design); **all four decisions are concurrency-safe**
> (status-guarded conditional claim → duplicate/raced decision returns 409/400, never a double
> mutation or audit); leave/swap/anomaly lists accept `dateFrom`/`dateTo` for History; the anomaly
> **list** now includes a minimal `actorUser` identity projection. **Names are the primary
> identity; a raw UUID is never a row title.** Verified on a disposable Neon branch: API decision
> matrix **29/29** (incl. branch-isolation 404 + duplicate 409/400) + Playwright smoke **8/8**;
> shared `production` untouched. The Approvals **page** stays read-only until Prompt 5B.
> **Documented gap:** discounts have no branch-wide list endpoint (only `/pending` + per-order) →
> no branch-wide discount Resolved/History without a new endpoint (SUP-RG-035).

> **Prompt 3B3B (2026-07-28).** Supervisor can now **approve/reject PENDING discounts**
> from the **order workspace** — inline Approve/Reject controls on PENDING rows in the
> read-only Discounts panel — **not** from the Approvals **page**, which stays read-only
> (its full reconstruction is still a later prompt). **Approve**
> (`POST /api/pos/discounts/:id/approve`, `pos:discount:approve`, HTTP 200) is **PENDING-only**
> (else 409, and the order must remain discountable), **recalcs order totals** (latest
> approved wins), and is **payment-gated** in the UI; its optional `managerPin` re-auths the
> approver's own quick-PIN (UI does not collect it). **Reject**
> (`POST /api/pos/discounts/:id/reject`, same permission, HTTP 200) requires a
> `rejectionReason` and leaves order totals **unchanged**. Both invalidate **only** the
> discount approvals domain (order-discounts + order-detail/Floor for approve + the Approvals
> discount-count/detail keys) — never leave/shift-swap/anomaly/reservation. A **complimentary**
> request (whole-order `PERCENTAGE value=100` + `metadata { complimentary:true }`, above the
> org threshold) enters this **same** PENDING → approve/reject lifecycle. **No
> permission/backend change** — Supervisor already held `pos:discount:approve`. The backend
> **permits self-approval** (approver may equal requester); the UI matches the backend and
> flags it — a backend maker-checker guard (approver ≠ requester) is a recommended future
> control, not an enforced policy.

> **Prompt 3B3A (2026-07-28).** A Supervisor **discount request** from the Floor
> Adjustments group (`POST /api/pos/orders/:id/discounts`, `pos:discount:request`) can
> return **APPROVED** (backend amount-based auto-approval within
> `OrgSettings.discountApprovalThreshold`, default 5000) or **PENDING**; a PENDING
> request surfaces in the Approvals discount queue (`GET /api/pos/discounts/pending`,
> `pos:discount:approve` — Supervisor already holds it, and it feeds the Approvals
> discount **count**). The Approvals **page** stays **read-only**; discount approve/reject
> shipped in Prompt 3B3B **inline in the order workspace** (see the 3B3B note above). The request path invalidates only the discount approvals
> domain (order detail + order discounts + Floor when approved + the discount-count key);
> it never touches leave/shift-swap/anomaly/reservation queues.

## Domain Model

Every approval row should normalize to:

```ts
type SupervisorApprovalView = {
  id: string;
  domain: "discount" | "leave" | "shift-swap" | "anomaly" | "refund" | "void";
  sourceId: string;
  reference: string;
  requester: string;
  status: string;
  priority: "none" | "low" | "medium" | "high" | "critical";
  createdAt: string | null;
  actions: Array<"approve" | "reject" | "acknowledge" | "resolve" | "execute">;
  unavailableReason?: string;
};
```

## Verified Queues

| Domain | Queue endpoint | Current state |
|---|---|---|
| Discount | `GET /api/pos/discounts/pending` | Available. |
| Leave | `GET /api/hr/leave?status=PENDING&take=50` | Available. |
| Shift swap | `GET /api/hr/shift-swaps?status=PENDING&take=50` | Available. |
| Anomaly | `GET /api/analytics/anomalies?status=OPEN&limit=50` | Available. |
| Refund | Missing pending queue | Unavailable card only. |
| Post-close void | Missing candidate queue | Unavailable card only. |

## Verified Actions

| Domain | Action | Endpoint | Terminal behavior |
|---|---|---|---|
| Discount | Approve | `POST /api/pos/discounts/:id/approve` | Row leaves pending queue. |
| Discount | Reject | `POST /api/pos/discounts/:id/reject` | Row leaves pending queue. |
| Leave | Approve/reject | `PATCH /api/hr/leave/:id/review` | Row leaves pending queue. |
| Shift swap | Approve/reject | `PATCH /api/hr/shift-swaps/:id/approve` | Row leaves pending queue. |
| Anomaly | Acknowledge | `PATCH /api/analytics/anomalies/:id/acknowledge` | Moves OPEN to ACKNOWLEDGED. |
| Anomaly | Resolve | `PATCH /api/analytics/anomalies/:id/resolve` | Moves ACKNOWLEDGED to RESOLVED. |
| Refund | Approve | `POST /api/pos/refunds/:id/approve` | Do not expose until queue exists. |
| Void | Execute | `POST /api/pos/orders/:id/post-close-void` | Do not expose until candidate workflow exists. |

## Pile-Up Fix

The page should not be one endless mixed list. Use:

- Urgent lane: critical/high anomalies, high-value discounts, aging leave/swaps.
- Pending by domain: grouped cards with per-domain counts and actions.
- In progress lane: anomaly ACKNOWLEDGED items awaiting resolution.
- Done/history: optional collapsed list after action completion.
- Unavailable domains: clear disabled cards without fake rows.

## Mutation Rules

- Confirm high-impact decisions.
- Disable duplicate submissions.
- Show the exact permission/action that is being used.
- Refetch the affected domain queue and selected detail.
- Never call global `/api/approvals` from Supervisor.
