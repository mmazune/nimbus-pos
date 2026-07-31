# Supervisor Final Demo Script

Date: 2026-07-31 · Canonical Supervisor demo walkthrough, safe on shared/demo data.

> Sequential, practical demo of the complete Supervisor experience. Every step is safe to run
> against the shared demo database — no step requires destructive shared-Neon mutation, and every
> mutating step uses ordinary, reversible-in-spirit demo actions (the same actions a real
> Supervisor would take). See `ai/SUPERVISOR_FINAL_DEMO_DATA_REGISTER.md` for which records to use
> and which to avoid. Credentials: see `docs/TESTING_AND_QA.md` "Demo accounts" (do not repeat
> passwords in this file).

## 1. Login

Go to `/login`, switch to **Email** mode, sign in as the **Supervisor** demo account.
**Expected:** lands on `/supervisor/floor`; header shows branch name + "Peter Mugisha, SUPERVISOR";
bottom nav shows exactly **Floor · Reservations · Approvals · Me** (no Orders tab).

## 2. Floor overview

Land on Floor. **Expected:** the shared `OperationalFloor` grid renders (same presentation as
Waiter) — search box, floor-plan selector, status filter chips (All/Available/Occupied/
Reserved/Mine) with live counts, table cards showing status + assigned staff (`First L.`) + seat
count. A compact **Find order** control sits above the grid (Supervisor-only, not a tab).

## 3. Select a table

Click any **Occupied** table. **Expected:** the read-first Supervisor order-control workspace
opens in place (not a new tab/Orders page) showing order summary, items, and the in-scope action
groups (Service, Handoff, Adjustments) — no payment-collection, close, or refund controls.

## 4. Request bill or Mark served

In the Service group, click **Request bill** (if the order is READY, **Mark served** instead).
**Expected:** a toast confirms the action; the button state updates; no page reload.

## 5. One split/move/transfer action

In the Handoff group, demonstrate **Split bill** (EQUAL split) or **Transfer table** (pick a
different Available table from the bounded target selector). **Expected:** the action completes
with a toast; for Transfer table, the workspace re-anchors to the new table via the URL.

## 6. Find order

Above the Floor grid, click **Find order**. Type a partial order number or pick a status filter.
**Expected:** a bounded, paginated result list appears; selecting a row opens that order
(including takeaway/tableless/closed orders) in the same canonical workspace, read-only if
terminal.

## 7. Show a financial adjustment

Open an **unpaid** order (Adjustments group). Demonstrate **Discount request** (enter a small
FIXED or PERCENTAGE amount + reason) — **expected:** shows a labelled estimate, then the real
APPROVED/PENDING status from the response (never an optimistic total). If a PENDING discount
already exists on the order, demonstrate **Approve** or **Reject** from the Discounts panel
instead. Do **not** demo Void/Complimentary on any order that already has a payment (the UI
payment-safety gate will block it — show that gate is honest, not broken).

## 8. Open Reservations

Click **Reservations** in the bottom nav. **Expected:** lands on **Arriving** (today, page 1);
tabs show **Arriving / Seated / Attention / History** with live counts.

## 9. Create or manage one reservation

Click **Create reservation**. Fill Guest name, Party size, a **future** Date/Time (the Date field
has a native browser minimum of today — a past date is rejected by the browser itself before
submit). Optionally assign a table. Submit. **Expected:** dialog closes; the new reservation is
selected and shown in Arriving. Alternatively, select an existing Arriving row and demonstrate
**Confirm** or **Assign table**.

## 10. Show Attention and History

Click the **Attention** tab. **Expected:** shows overdue PENDING/CONFIRMED reservations and any
structurally inconsistent SEATED rows, each with an individual reason (no bulk action). Click
**History**. **Expected:** a separate, lazily-loaded, paginated list of terminal
(COMPLETED/CANCELLED/NO_SHOW) reservations with date-range filters.

## 11. Open Approvals

Click **Approvals** in the bottom nav. **Expected:** lands on **Needs action / All** with a live
"N awaiting action" count; scope tabs (Needs action/Resolved/History) and domain filter chips
(All/Discounts/Leave/Shift swaps/Anomalies).

## 12. Approve/reject one Discount or Leave request

Filter to **Discounts** or **Leave**, select a row, click **Approve** (or **Reject**, entering a
reason). **Expected:** a toast confirms; for discount approve, order totals recalc; for reject,
totals/leave status update with no total change (discount) or a review note (leave). The
requester's own name shows in the row (never a raw id); if the Supervisor requested the discount
themselves, a truthful self-approval notice appears.

## 13. Acknowledge and resolve one Anomaly

Filter to **Anomalies**, select an OPEN row, click **Acknowledge** (note optional). **Expected:**
status becomes ACKNOWLEDGED and the row **stays** in Needs action. Click **Resolve** (note
**required** this time). **Expected:** status becomes RESOLVED; a toast confirms the underlying
order/till/payment/attendance/shift record was **not** mutated (evidence-only).

## 14. Show Shift-swap Reject-only limitation truthfully

Filter to **Shift swaps**, select a PENDING row. **Expected:** the detail panel shows **only a
Reject control — no Approve control** — with an honest note that schedule reassignment isn't
supported here. Optionally click **Reject** (reason required). **Expected:** status becomes
REJECTED; no roster/schedule row changes (this is verified, not asserted — see the QA evidence
index §3).

## 15. Open Me

Click **Me** in the bottom nav. **Expected:** shows Supervisor profile, role, branch context, and
shift self-service (read-only from this surface).

## 16. Logout

Click **Log out**. **Expected:** returns to `/login`; navigating back or refreshing a protected
Supervisor URL redirects to login (no cached protected content).

---

**Notes for the presenter:**

- Steps 4–7 and 9 are genuinely mutating (they call live create/update endpoints). Prefer
  demo-safe records from `ai/SUPERVISOR_FINAL_DEMO_DATA_REGISTER.md` and avoid repeating steps 7
  and 12–14 rapidly on the same row (each decision is one-way once terminal).
- If a filtered Approvals domain shows "No approvals need action," that's a truthful empty state,
  not a bug — pick a different demo-safe record or seed one per the demo-data register before the
  session.
- Shift-swap Approve is **intentionally absent** — do not describe it as a bug during the demo;
  it's the documented, user-authorized Outcome C decision.
