# T6 progress (engines 2: rights, tests, stock)

Branch `t6/engines-2`, cut from `rebuild/main` 41772c7, merged origin/t2/engines and origin/t4/review-and-data (both clean, no conflict).
moses-build-standards loaded.

| phase | state | last commit |
|---|---|---|
| 1 private things | done | (this commit) |
| 2 rights matrix | done | (this commit) |
| 3 test run | done | 23038f0 (four runs 0 failed) |
| 4 stock moves | done | (this commit) |
| 5 stores | done | (this commit) |

## Next
Final: four full runs on final code, rights walk, report. 03 s6 item 3 started: GET /api/stock/servings-left (read only); modes OFF/WARN/BLOCK not built.

## Decisions taken
- D1 E1 migration: duplicate ticket lines are copied whole to kds_ticket_items_set_aside, then removed from the live table (prompt: remove; rule 17: nothing lost).
- D2 PIN by token: one-time 15-minute pst_ token bound to person+branch, returned to the device that started it; the person types their own PIN twice. Reset clears the old PIN at once.
- D3 Onboarding refuses a manager-typed temporaryPassword (400 PASSWORD_SET_BY_PERSON); a prt_ setup token is returned instead. Invitations no longer return tempPassword (null).
- D4 forgot-password token exposure is opt-in (NIMBUS_EXPOSE_RESET_TOKENS=true AND not production); it was OR.
- D5 Own payslips at GET /api/payroll/my-slips(/:id), no key; branch list keeps pos:payroll:slips:read (Owner, Manager, Accountant).
- D6 Leave/attendance/swap lists: own-only without the review right; people relations use safe selects; a global interceptor strips hash fields from every answer.
- D7 Contract salaryAmount is null without pos:hr:compensation:read.
- D8 The 35 no-row keys: none granted (CLAUDE.md §12 B6 forbids seeding franchise/ops/dev/merchant/billing/support; prompt: grant nothing for billing, franchise, HMS). Specs behind them go to quarantine.
- D9 ops:* stay closed instead of moving to PlatformAccessGuard: that guard admits any L5 venue Owner, so it would show every customer to every venue owner. No Nimbus-operator identity exists.
- D10 Requests for approval: new table approval_requests; answer by PIN on the asking device (requester's session + approver PIN, 5 tries) or from Approvals; climb worked out on read (no queue); settings approvalClimbMinutes 3, tillVarianceLimit 10000, businessDayEndsHour 5 (Kampala).
- D11 Refund: the bill's day is the payment's createdAt (orders have no close time). Manager/owner at once; supervisor at once same business day; later → PENDING + MANAGER request. Amount threshold rule replaced. Declined → new RefundStatus DECLINED.
- D12 Till over/short above the limit: someone other than the operator with the answer right signs as they count; else RECONCILED with closedAt null until signed; declined → OPEN to count again.
- D14 Phase 3: specs that tested replaced behaviour updated (bg3/shifts-tills chef→accountant for the no-shift-right check; refunds by day; orders pays its total; attendance acts as each employee's own user with a published roster; quick-sale.review C10 needs only its own sales; bg1-onboarding uses its own user). Quarantine: billing, franchise, franchise-analytics, bg7-hms (keys forbidden by CLAUDE.md).
- D15 Amounts: Int base units = thousandths of the display unit (g, ml, 1/1000 piece). costPerBase Decimal(18,6) per base unit; value Decimal(14,2) rounded half up.
- D16 Stock on send: listener on order.lines.sent after commit, one transaction per line, dedupe key SALE:<line>:<item> with ON CONFLICT DO NOTHING (double send/hear-twice safe). Void "not made" → SALE_REVERSAL on order.line.voided. soldAs defaults NOT_TRACKED, no backfill (the manager chooses).
- D17 Ledger append-only by trigger (UPDATE/DELETE raise).
- D18 Servings fault: one resolver (recipeRowsForLine) for line cost, recipe cost and stock: a serving with its own rows uses them, else base rows; extras add theirs. Line cost uses costPerBase x amountBase when the item has a kind.
- D19 Waste above wasteValueLimit (50,000) by someone without the answer right needs a supervisor PIN (someone else); a supervisor alone may.
- D20 Stores: one MAIN made per branch on first use; SECONDARY feeds from MAIN; POINT feeds from MAIN or SECONDARY; stations link to a store (else MAIN).
- D21 Receive: the receiver types their own PIN; the PIN's owner must hold pos:store:request. Short = issued − received, valued at the issue cost; the trip stays open until a count of the receiving store with that item closes.
- D22 Moving average over the item's on-hand across the branch's stores; nothing (or less) on hand takes the new price. Cost changed: > costChangePct (10%) from the order's price, else from the average.
- D23 Count limit per line = max(countVariancePct (2%) of the value used from that store in the last 30 days, countVarianceValue 20,000); the manager's note is written by someone with pos:approvals:answer-manager. Blind: the counter sees no books while the count is open; managers do.
- Left out: LOW_STOCK / REQUEST_WAITING alert rows (no alerts table, E10); count tasks; auto-send of suggestions; 'their store' scoping (no store on the membership).
- D13 allowedActions on GET /api/pos/orders/:id, derived from the route keys + order state; no 'ask to void' (no request kind for it yet).

## Left out
