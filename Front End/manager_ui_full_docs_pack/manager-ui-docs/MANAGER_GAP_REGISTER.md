# MANAGER_GAP_REGISTER.md — Nimbus POS Manager UI Gap Register

Status: Expanded draft v1  
Date: 2026-07-06

This document tracks unresolved development gaps, API discrepancies, data-sensitivity risks, and safety constraints for the Manager UI build.

| ID | Area | Gap | Evidence | Impact | Proposed Action / Finding | Status |
|---|---|---|---|---|---|---|
| **MANAGER-GAP-001** | Shell / Header | No Manager branch switcher exists yet. Managers are seeded with multiple branch memberships. | Prompt 0 verification and Manager lifecycle. | Manager cannot safely operate branch-scoped data across branches. | Add branch selector in Manager header in Prompt 1. Persist selected branch and refetch branch-scoped queries. | **Open — Prompt 1** |
| **MANAGER-GAP-002** | Role identity | Product uses `MANAGER`; no `BRANCH_MANAGER` enum exists. | Seed/schema verification. | Wrong route guard if `BRANCH_MANAGER` is assumed. | Use `JobRole.MANAGER` only. | **Resolved** |
| **MANAGER-GAP-003** | Staff / Compensation | Compensation and contracts endpoints expose wage/salary details. | Prompt 0 sensitivity findings. | Payroll leakage on shared terminals. | Exclude compensation/contract detail pages from Manager MVP. | **Mitigated — Locked exclusion** |
| **MANAGER-GAP-004** | Staff / Employee details | Employee endpoints may return more fields than the UI should display. | HR endpoint scope. | PII leakage risk. | Implement frontend safe-field whitelist. Do not render bank/tax/payroll/private notes. | **Open — Staff prompt** |
| **MANAGER-GAP-005** | Staff / Onboarding | Onboarding response may include credential/PIN output. | Frontline onboarding scope. | Sensitive one-time secret handling risk. | Display one-time secrets only if backend returns them intentionally; mask/copy/expire instructions. | **Open — Staff prompt** |
| **MANAGER-GAP-006** | Staff / Quick PIN | Quick PIN reset/enable/disable are high-risk auth writes. | Manager permissions include `auth:quick-pin:write`. | Unauthorized access risk if UX is casual. | Add confirmation, branch/staff context, audit result, and no blind retry. | **Open — Staff prompt** |
| **MANAGER-GAP-007** | Approvals | Unified approvals decide payload requires source-specific dynamic parameters. | Prompt 0 gap register. | Generic decide form may submit invalid or unsafe payloads. | Use domain-specific endpoints for writes where safer. Keep generic decide read/detail first. | **Mitigated — Approvals prompt** |
| **MANAGER-GAP-008** | Reports | PDF/Excel exports may require local generator binaries. | Prompt 0 gap register. | Local download can fail with 500. | Show generator unavailable/error state; do not fake file success. | **Open — Reports prompt** |
| **MANAGER-GAP-009** | Reports | Report templates have different filter requirements. | Reports API matrix. | Generic form may send wrong DTOs. | Build template-aware forms from catalog and verified DTOs. | **Open — Reports prompt** |
| **MANAGER-GAP-010** | Settings / Alerts | Alert rules require complex JSON structures. | Prompt 0 gap register. | Visual builder out of MVP scope. | Keep alert rules read-only or defer. | **Open — Settings prompt** |
| **MANAGER-GAP-011** | Settings / Sync | Sync conflict resolution requires granular entity reconciliation. | Prompt 0 gap register. | Complex diff viewer out of MVP. | Show sync jobs/history only; defer conflict diff UI. | **Open — Settings prompt** |
| **MANAGER-GAP-012** | Settings / Devices | Terminal pairing is stub-only. | Device API caveats. | Fake acquirer/card traffic risk. | Label terminal pairing as stub/metadata only. | **Locked caveat** |
| **MANAGER-GAP-013** | Settings / Printer routes | Printer routes are metadata unless driver integration is verified. | Device/printer caveats. | Fake print success risk. | Copy: metadata-only, no print-driver invocation. | **Locked caveat** |
| **MANAGER-GAP-014** | Operations | Manager can inspect orders but must not become Cashier or Waiter. | Role-boundary decision. | Scope creep. | Keep Operations read-only until verified Manager escalation action prompt. | **Open — Operations prompt** |
| **MANAGER-GAP-015** | Dashboard | Live SSE stream may fail or be unavailable locally. | Metrics stream endpoint. | Dashboard can look broken if stream fails. | Fall back to fetched metrics and show degraded state. | **Open — Overview prompt** |
| **MANAGER-GAP-016** | Branch context | Demo Manager may have multiple branch memberships; APIs are branch-scoped. | Prompt 0 findings. | Data mismatch if UI caches wrong branch. | Centralize Manager context and invalidate queries on branch switch. | **Open — Prompt 1** |
| **MANAGER-GAP-017** | Postman | Manager-specific workflow coverage is split across many collections. | Prompt 0 Postman inventory. | QA workflow complexity. | Future Manager QA prompt should define a Manager workflow checklist/collection if required. | **Deferred** |
| **MANAGER-GAP-018** | Security | Manager has high-impact writes across staff, reports, settings, and approvals. | Permission map. | Double-submit or wrong branch write risk. | Confirmations, branch labels, idempotency/in-flight locks, and audit result on every write. | **Open — all write prompts** |
