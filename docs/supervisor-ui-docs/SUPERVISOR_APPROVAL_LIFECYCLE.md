# Supervisor Approval Lifecycle

Status: reconstruction standard (Prompt 3B3B note 2026-07-28)  
Date: 2026-07-18 (updated 2026-07-28)

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
