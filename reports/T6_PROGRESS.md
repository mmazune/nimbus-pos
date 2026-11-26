# T6 progress (engines 2: rights, tests, stock)

Branch `t6/engines-2`, cut from `rebuild/main` 41772c7, merged origin/t2/engines and origin/t4/review-and-data (both clean, no conflict).
moses-build-standards loaded.

| phase | state | last commit |
|---|---|---|
| 1 private things | done | (this commit) |
| 2 rights matrix | - | - |
| 3 test run | - | - |
| 4 stock moves | - | - |
| 5 stores | - | - |

## Next
Phase 2: rights matrix in the seed, PIN-on-the-spot approval, climb, allowedActions, refund approval, till sign-off.

## Decisions taken
- D1 E1 migration: duplicate ticket lines are copied whole to kds_ticket_items_set_aside, then removed from the live table (prompt: remove; rule 17: nothing lost).
- D2 PIN by token: one-time 15-minute pst_ token bound to person+branch, returned to the device that started it; the person types their own PIN twice. Reset clears the old PIN at once.
- D3 Onboarding refuses a manager-typed temporaryPassword (400 PASSWORD_SET_BY_PERSON); a prt_ setup token is returned instead. Invitations no longer return tempPassword (null).
- D4 forgot-password token exposure is opt-in (NIMBUS_EXPOSE_RESET_TOKENS=true AND not production); it was OR.
- D5 Own payslips at GET /api/payroll/my-slips(/:id), no key; branch list keeps pos:payroll:slips:read (Owner, Manager, Accountant).
- D6 Leave/attendance/swap lists: own-only without the review right; people relations use safe selects; a global interceptor strips hash fields from every answer.
- D7 Contract salaryAmount is null without pos:hr:compensation:read.

## Left out
