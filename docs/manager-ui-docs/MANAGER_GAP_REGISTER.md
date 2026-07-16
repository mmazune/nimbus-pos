# Manager Gap Register

This document tracks functional gaps, security boundaries, and architectural limitations identified during Prompt 0 repository verification.

| Gap ID | Surface | Gap | Impact | Status | Required follow-up | Blocking prompt |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GAP-01** | Shell / Header | No branch switcher in current shell. Managers are seeded with memberships in multiple branches (`MAIN`, `DOWNTOWN`). | Manager cannot change active branch context without clearing localStorage or re-logging. | Open | Add a branch context dropdown selector in the future Manager header. | Prompt 1 (Shell) |
| **GAP-02** | Staff | Compensation profile and contracts read endpoints return salary/wage rates. | Risk of leaking payroll or compensation rates on POS terminals. | Mitigated | Exclude contracts/compensation detail pages from Manager MVP. Render only basic employee details. | Prompt 4 (Staff) |
| **GAP-03** | Settings / Alerts | Alert rule configuration endpoints require complex JSON structures. | Hard to configure SMS/Email/Slack rules without a visual builder. | Open | Keep alerts surface read-only, exposing digest history and test dispatch triggers only. | Prompt 6 (Settings) |
| **GAP-04** | Settings / Sync | Sync conflict resolution endpoint requires granular entity reconciliation. | Building a full conflict resolution diff-viewer is out of scope for MVP. | Open | Expose read-only sync jobs history and simple "Retry" buttons; defer complex conflict diffs. | Prompt 6 (Settings) |
| **GAP-05** | Approvals | Unified approvalsdecide payload requires source-specific dynamic parameters. | A generic decide form might fail without context-aware DTO mapping. | Mitigated | Use domain-specific API calls (`/api/pos/discounts/:id/approve`, etc.) instead of the generic inbox endpoint when performing writes in MVP. | Prompt 7 (Approvals) |
| **GAP-06** | Reports | Reporting exports assume a local filesystem helper that packages files. | If the local system doesn't have PDF/Excel generators configured, download will return 500. | Open | Add mock/stub downloads in test scenarios if generators are missing in the local Node env. | Prompt 5 (Reports) |
