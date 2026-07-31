# Cashier Floor Reconstruction Gap Register

**Status:** Initial architecture register. Prompt C0 must verify every row against the local dirty worktree and update evidence/status without discarding unrelated work.

| ID | Area | Current/expected evidence | Target | Severity | Phase | Backend/permission dependency | QA requirement | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CASH-FR-001 | Default route | Cashier historically lands on Queue | `/cashier/floor` | High | C1 | None expected | auth redirect + Back/Forward/refresh | Open |
| CASH-FR-002 | Visible navigation | Queue/Receipts/Till/Me | Floor/Till/Me only | High | C1 | None | all viewports + role boundary | Open |
| CASH-FR-003 | Shared Floor | Cashier not yet verified as `OperationalFloor` consumer | Third shared consumer | High | C1 | Floor-read permission audit | three-role visual/structural parity | Open |
| CASH-FR-004 | Cashier shell | Existing Cashier adapter may duplicate shared primitives | Thin adapter over shared shell | Medium | C1 | None | shell assertions + request counts | Verify |
| CASH-FR-005 | Table selection | No canonical table-to-settlement path confirmed | selected table opens settlement workspace | Critical | C2 | order/payment read contracts | zero/one/multiple order matrix | Open |
| CASH-FR-006 | Multiple payable orders | Risk of silently choosing one order | bounded explicit order selector | Critical | C2 | bounded table-order query | live and browser cases | Open |
| CASH-FR-007 | No payable order | Table selection may assume a bill | honest no-bill state | Medium | C2 | None | empty-table test | Open |
| CASH-FR-008 | Settlement workspace | Existing payment UI tied to Queue | canonical table/order workspace | Critical | C2–C3 | existing payment/order contracts | live payment matrix | Open |
| CASH-FR-009 | Till/readiness preflight | Existing behaviour must be mapped into new workspace | fail-closed preflight | Critical | C2–C3 | Till/shift/readiness contracts | missing/foreign/no-Till cases | Verify |
| CASH-FR-010 | Split settlement | Existing split UI may be page-specific | reused inside workspace | High | C3 | existing split contracts | split/partial/idempotency | Open |
| CASH-FR-011 | Partial payment | Existing Queue flow must remain canonical | workspace partial settlement | Critical | C3 | payment contract | balance and retry matrix | Open |
| CASH-FR-012 | Close order | Existing close path tied to Queue/payment page | close from workspace | Critical | C3 | close permission/eligibility | paid/unpaid/pending/duplicate | Open |
| CASH-FR-013 | Cross-role Floor sync | Payment/close must update all role Floors | narrow canonical updates | High | C3 | shared Floor query keys | Waiter/Supervisor regression | Open |
| CASH-FR-014 | Receipt initial print | Existing Receipts surface may own action | selected receipt panel | High | C4 | receipt/print contract | close→receipt→print | Open |
| CASH-FR-015 | Receipt reprint | Existing standalone Receipts lookup | selected closed order/Find bill | High | C4 | receipt lookup/reprint | known order + reference cases | Open |
| CASH-FR-016 | Receipt delivery | Existing channels must be verified | only supported actions in panel | Medium | C4 | endpoint/permission audit | supported/unsupported channel | Verify |
| CASH-FR-017 | Refund entry | Existing refund route may be standalone | selected receipt/order context | High | C4 | refund permissions/contracts | eligibility/duplicate/state | Open |
| CASH-FR-018 | Receipts route retirement | Standalone page currently exists | redirect then remove | High | C4 | None | reference search + legacy redirects | Open |
| CASH-FR-019 | Tableless orders | Queue currently likely supplies access | Floor Find bill | Critical | C2/C5 | bounded order lookup | tableless/takeaway cases | Open |
| CASH-FR-020 | Takeaway orders | No physical table | Floor Find bill | Critical | C2/C5 | service-type filtering | live/browser | Open |
| CASH-FR-021 | Partially paid/failed/pending lookup | Queue likely exposes these states | Find bill + selected workspace | High | C5 | payment-state filters | all payment-state cases | Open |
| CASH-FR-022 | Queue route retirement | Standalone Queue remains | redirect then remove | High | C5 | None | reference search + redirects | Open |
| CASH-FR-023 | Find bill performance | Risk of recreating unbounded Queue | bounded/paginated lookup | High | C2/C5 | server filter audit | request counts/max page | Open |
| CASH-FR-024 | Table-card bill signal | Cashier may need bill requested/outstanding signal | shared-safe optional indicator only | Medium | C1/C2 | efficient summary availability | no N+1/per-table payment calls | Verify |
| CASH-FR-025 | Guest/payment privacy | New Floor/lookup could expose excess data | minimum operational data | Critical | all | branch scope | privacy/browser/log review | Open |
| CASH-FR-026 | Legacy deep links | Queue/Receipts links may exist in docs/code | context-preserving redirects | Medium | C1/C4/C5 | None | no loops/no mutations | Open |
| CASH-FR-027 | Performance baseline | Prior Cashier startup hardening must survive | no duplicate startup/query storm | High | all | None | cold/warm request counts | Open |
| CASH-FR-028 | Test harness | Existing Cashier E2E may target old nav/pages | new shared Floor/settlement suite | High | C1–C6 | isolated QA tooling | actual four-viewport execution | Open |
| CASH-FR-029 | Documentation conflicts | Root/legacy docs still describe Queue/Receipts nav | canonical Floor-first docs reconciled locally | Medium | C0 and each phase | None | document audit | Open |
| CASH-FR-030 | Demo data | Existing walkthrough built around Queue/Receipts | Floor/settlement/Find bill data | Medium | C6 | disposable/safe fixtures | full demo rehearsal | Open |
| CASH-FR-031 | Manager dependency | Manager track ready to begin after Supervisor | must wait for Cashier C6 | High | governance | None | final closure classification | Locked |

## Classification rules

- **Critical:** payment/data integrity, wrong-order selection, cross-branch leakage, role leakage, or loss of required access.
- **High:** primary workflow, navigation, shared-component, or operational-completeness gap.
- **Medium:** usability, compatibility, documentation, or non-blocking support concern.

Prompt C0 must add exact file paths, endpoints, permissions, query keys, and test references to every verified row.
