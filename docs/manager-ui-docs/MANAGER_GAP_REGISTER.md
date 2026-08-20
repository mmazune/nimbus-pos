# Manager Gap Register

This document tracks functional gaps, security boundaries, and architectural limitations identified during Prompt 0 repository verification.

---

## 2026-08-20 — Header note: SUPERSEDED IN DETAIL + owner decisions LOCKED

**⚠️ Read the pack register instead for detail.**
[`Front End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_GAP_REGISTER.md`](../../Front%20End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_GAP_REGISTER.md)
carries **18** rows (`MANAGER-GAP-001` … `MANAGER-GAP-018`) with evidence, impact, proposed action,
and status. It **subsumes all six** rows below. This file is retained as the short in-repo summary
and as the historical Prompt-0 record; it has **not** been rewritten.

Row mapping (this file → pack register):

| Here | Pack equivalent |
| --- | --- |
| GAP-01 (branch switcher) | MANAGER-GAP-001 (+ MANAGER-GAP-016 branch-context invalidation) |
| GAP-02 (compensation/contracts) | MANAGER-GAP-003 (+ 004 safe-field whitelist, 005 onboarding secrets) |
| GAP-03 (alert rules JSON) | MANAGER-GAP-010 |
| GAP-04 (sync conflict diff) | MANAGER-GAP-011 |
| GAP-05 (generic decide payload) | MANAGER-GAP-007 |
| GAP-06 (report export generators) | MANAGER-GAP-008 (+ 009 template-specific DTOs) |

**Owner decisions are locked (2026-08-20).** See
[`MANAGER_APPROVAL_DECISIONS.md`](../../Front%20End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_APPROVAL_DECISIONS.md).
Effect on the rows below:

- **GAP-01** — a branch switcher is now a **required, approved** shell/header feature (M-P1).
- **GAP-02** — compensation / contracts / payroll exclusion is **approved and locked**, not merely
  a mitigation.
- **GAP-03 / GAP-04** — alert rules are **defer-or-read-only** and the sync-conflict diff is
  **deferred**, by owner decision.
- **GAP-05** — **domain-specific decision routes are preferred**, per the Supervisor Option B
  precedent. Note the seed finding recorded in
  [`MANAGER_API_MATRIX.md`](MANAGER_API_MATRIX.md): Manager **does** hold `approvals:read` and
  `approvals:decide` (`packages/db/prisma/seed.ts:974–975`) while Supervisor holds neither — so this
  is a product/safety constraint the frontend enforces, not a permission block.
- **GAP-06** — its "Add mock/stub downloads in test scenarios" wording **conflicts with the locked
  decision that fake downloads are forbidden**. The approved behaviour is a truthful
  **generator-unavailable** state. The pack row (MANAGER-GAP-008) already states this correctly;
  the wording below is superseded and is not being rewritten here.

Remediation sequencing for every open row is scheduled in
[`ai/MANAGER_RECONSTRUCTION_ROADMAP.md`](../../ai/MANAGER_RECONSTRUCTION_ROADMAP.md).

---

| Gap ID | Surface | Gap | Impact | Status | Required follow-up | Blocking prompt |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GAP-01** | Shell / Header | No branch switcher in current shell. Managers are seeded with memberships in multiple branches (`MAIN`, `DOWNTOWN`). | Manager cannot change active branch context without clearing localStorage or re-logging. | Open | Add a branch context dropdown selector in the future Manager header. | Prompt 1 (Shell) |
| **GAP-02** | Staff | Compensation profile and contracts read endpoints return salary/wage rates. | Risk of leaking payroll or compensation rates on POS terminals. | Mitigated | Exclude contracts/compensation detail pages from Manager MVP. Render only basic employee details. | Prompt 4 (Staff) |
| **GAP-03** | Settings / Alerts | Alert rule configuration endpoints require complex JSON structures. | Hard to configure SMS/Email/Slack rules without a visual builder. | Open | Keep alerts surface read-only, exposing digest history and test dispatch triggers only. | Prompt 6 (Settings) |
| **GAP-04** | Settings / Sync | Sync conflict resolution endpoint requires granular entity reconciliation. | Building a full conflict resolution diff-viewer is out of scope for MVP. | Open | Expose read-only sync jobs history and simple "Retry" buttons; defer complex conflict diffs. | Prompt 6 (Settings) |
| **GAP-05** | Approvals | Unified approvalsdecide payload requires source-specific dynamic parameters. | A generic decide form might fail without context-aware DTO mapping. | Mitigated | Use domain-specific API calls (`/api/pos/discounts/:id/approve`, etc.) instead of the generic inbox endpoint when performing writes in MVP. | Prompt 7 (Approvals) |
| **GAP-06** | Reports | Reporting exports assume a local filesystem helper that packages files. | If the local system doesn't have PDF/Excel generators configured, download will return 500. | Open | Add mock/stub downloads in test scenarios if generators are missing in the local Node env. | Prompt 5 (Reports) |
