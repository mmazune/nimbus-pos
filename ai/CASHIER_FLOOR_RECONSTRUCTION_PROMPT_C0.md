# Cashier Floor Reconstruction — Prompt C0

Use the highest-capability Claude Opus model available with maximum reasoning effort.

## Mission

Safely fetch the canonical Cashier Floor-first documentation branch into the authoritative
dirty local worktree, verify the current implementation against it, reconcile local
canonical documentation, and produce the exact C1 implementation prompt.

Prompt C0 is documentation and verification only. Do not change runtime code.

## Repository

Use only:

`C:\Users\arman\Desktop\nimbus-pos`

Never use:

`C:\Users\arman\Desktop\NIMBUS\nimbus-pos`

The dirty local worktree is authoritative. Never reset, restore, stash, clean, discard, or
overwrite unrelated work. Do not commit or push.

## Documentation branch to fetch

Remote branch:

`docs/cashier-three-tab-floor-workflow`

The branch adds only new canonical documentation paths. It must not overwrite local runtime
or documentation changes.

## Safe fetch and fast-forward gate

1. Confirm exact repository path.
2. Run `git status --short --branch` and save the output in the C0 report.
3. Record current branch and HEAD.
4. Confirm the twelve intentional Floor deletions remain.
5. Run:

   `git fetch origin docs/cashier-three-tab-floor-workflow`

6. Inspect:

   `git diff --name-status HEAD..origin/docs/cashier-three-tab-floor-workflow`

7. Confirm every incoming path is new and does not overlap a locally modified or untracked
   path.
8. If any path overlaps local work, stop and report the exact conflict. Do not stash or
   overwrite.
9. When the incoming branch is a safe descendant of current HEAD and paths do not conflict,
   run:

   `git merge --ff-only origin/docs/cashier-three-tab-floor-workflow`

10. Verify the local dirty worktree changes remain intact.
11. Do not create a merge commit.
12. Do not commit or push.

## Read first

After the safe fast-forward, read:

- `docs/cashier-ui-docs/README.md`
- `docs/cashier-ui-docs/AGENTS.md`
- `docs/cashier-ui-docs/CASHIER_ARCHITECTURE.md`
- `docs/cashier-ui-docs/CASHIER_LIFECYCLE.md`
- `docs/cashier-ui-docs/CASHIER_ROLE_BEHAVIOUR_MATRIX.md`
- `docs/cashier-ui-docs/CASHIER_COMPONENT_REUSE_MAP.md`
- `docs/cashier-ui-docs/CASHIER_RECONSTRUCTION_ROADMAP.md`
- `docs/cashier-ui-docs/CASHIER_TEST_PLAN.md`
- `ai/CASHIER_FLOOR_RECONSTRUCTION_DECISION.md`
- `ai/CASHIER_FLOOR_RECONSTRUCTION_GAP_REGISTER.md`
- root `CLAUDE.md`
- `PROGRESS.md`
- `ARCHITECTURE.md`
- `docs/UI_SYSTEM.md`
- `docs/ROLE_JOURNEYS.md`
- `docs/ROLE_CAPABILITY_MATRIX.md`
- `docs/DECISIONS.md`
- `docs/TESTING_AND_QA.md`
- `docs/KNOWN_LIMITATIONS.md`
- `ai/AI_STATUS.md`
- all historical `ai/CASHIER_UI_*` completion and QA reports;
- all current Supervisor final closure docs;
- all Waiter final lifecycle/QA docs.

## Locked target

Cashier visible navigation becomes exactly:

- Floor
- Till
- Me

Cashier default route becomes `/cashier/floor`.

Queue and Receipts are removed as standalone tabs and pages only after their capabilities
are migrated.

A physical table selection opens the Cashier settlement workspace.

The selected order workspace owns:

- bill review;
- split settlement;
- payment;
- partial payment;
- close;
- receipt print/reprint/delivery;
- eligible refund context.

A compact Floor-level `Find bill` control handles tableless, takeaway, partially-paid,
failed/pending-payment, closed-order, direct-order, and receipt-reference cases. It is not
a fourth tab and not a replacement Queue page.

Cashier must consume the same shared shell and `OperationalFloor` as Waiter/Supervisor.
Role behaviour differs after table/order selection.

## C0 audit scope

Audit current local-worktree reality for:

### Shell and navigation

- current Cashier default route;
- visible nav configuration;
- Cashier shell composition;
- shared shell primitive reuse;
- idle/session/readiness behaviour;
- icon registry usage;
- current legacy redirects.

### Shared Floor

- current `OperationalFloor` interface;
- Waiter adapter;
- Supervisor adapter;
- table selection URL contract;
- Floor queries and query keys;
- card summary data;
- table-card privacy;
- responsive behaviour;
- exact changes needed for a Cashier adapter without a fork.

### Current Cashier capabilities

- Queue route/page/components/helpers;
- payment entry;
- split resolution;
- partial payments;
- close order;
- Receipts route/page/components/helpers;
- print/reprint/delivery;
- refunds;
- Till;
- Me/profile;
- branch/workstation/session context;
- current performance hardening.

### Migration mapping

For every Queue and Receipts capability classify it as:

- shared Floor responsibility;
- settlement workspace responsibility;
- Find bill responsibility;
- Till responsibility;
- Me responsibility;
- obsolete after migration;
- blocked by missing backend/permission contract.

### Table-to-order contract

Verify actual contracts for:

- zero active/payable orders;
- one payable order;
- multiple payable orders;
- split child orders;
- merged orders;
- partially paid orders;
- terminal orders;
- tableless/takeaway orders;
- stale table summary;
- cross-branch protection.

Do not assume the first order is canonical.

### Permissions and APIs

Verify Cashier access for:

- Floor/table read;
- order read;
- payment read/create;
- split allocation read/pay;
- order close;
- receipt read/print/reprint/delivery;
- Till operations;
- refund operations;
- bounded order/receipt lookup.

Do not modify permissions. If anything is missing, document the exact endpoint exposure and
stop that capability for later authorisation.

### Performance

Record current request topology for:

- Cashier login/startup;
- Queue;
- selected order/payment;
- Receipts;
- Till;
- shared Floor.

Design C1–C5 so the target does not create:

- per-table payment requests;
- Queue + Floor duplicate startup requests;
- duplicate `/auth/me`;
- duplicate selected-order detail;
- responsive double mounts;
- broad invalidation storms.

### Tests

Inventory:

- current Cashier assertions;
- current Cashier Playwright specs;
- shared shell/Floor assertions;
- Waiter/Supervisor Floor parity specs;
- payment/split/close/receipt/Till/refund Jest tests;
- branch/isolation/idempotency tests;
- missing coverage for C1–C6.

Do not run destructive QA in C0.

## Documentation reconciliation

Update local canonical docs additively so they acknowledge the locked decision and the
seven-prompt roadmap.

At minimum reconcile:

- root `CLAUDE.md`;
- `PROGRESS.md`;
- `docs/DOCUMENT_INDEX.md`;
- `docs/UI_SYSTEM.md`;
- `docs/ROLE_JOURNEYS.md`;
- `docs/ROLE_CAPABILITY_MATRIX.md`;
- `docs/DECISIONS.md`;
- `docs/TESTING_AND_QA.md`;
- `docs/KNOWN_LIMITATIONS.md`;
- `ai/AI_STATUS.md`.

Do not rewrite historical Cashier completion reports. Add supersession/current-state notes.

## Required C0 outputs

Create:

- `ai/CASHIER_FLOOR_RECONSTRUCTION_C0_REPO_VERIFICATION_REPORT.md`
- `ai/CASHIER_FLOOR_RECONSTRUCTION_COMPONENT_AUDIT.md`
- `ai/CASHIER_FLOOR_RECONSTRUCTION_ROUTE_AND_NAV_AUDIT.md`
- `ai/CASHIER_FLOOR_RECONSTRUCTION_CAPABILITY_MIGRATION_MATRIX.md`
- `ai/CASHIER_FLOOR_RECONSTRUCTION_PERMISSION_AND_API_MATRIX.md`
- `ai/CASHIER_FLOOR_RECONSTRUCTION_TEST_INVENTORY.md`
- `ai/CASHIER_FLOOR_RECONSTRUCTION_PROMPT_C1.md`

Update:

- `ai/CASHIER_FLOOR_RECONSTRUCTION_GAP_REGISTER.md` with exact local evidence;
- `docs/cashier-ui-docs/CASHIER_COMPONENT_REUSE_MAP.md` only when local evidence requires
  a precise correction;
- `docs/cashier-ui-docs/CASHIER_RECONSTRUCTION_ROADMAP.md` only when the verified code
  requires a safer phase boundary.

## C0 completion report requirements

Report:

1. repository path;
2. initial branch/HEAD/status;
3. fetch result;
4. incoming path audit;
5. fast-forward result;
6. preserved dirty-worktree evidence;
7. documents read;
8. current Cashier nav and default route;
9. current shell/shared-shell composition;
10. current Queue responsibilities;
11. current Receipts responsibilities;
12. current payment/split/close architecture;
13. current Till/Me architecture;
14. shared Floor interface;
15. required Cashier adapter;
16. table-to-order resolution findings;
17. Find bill feasibility;
18. permission/API findings;
19. performance findings;
20. test inventory;
21. verified gaps;
22. any roadmap adjustment;
23. files created;
24. files modified;
25. no runtime-code change;
26. no backend/schema/migration/seed/permission/Postman change;
27. no commit/no-push confirmation;
28. readiness for C1.

## Final classification

Use one exact result:

- `A. C0 COMPLETE / READY FOR C1`
- `B. C0 COMPLETE WITH CONTRACT BLOCKERS`
- `C. C0 FETCH OR WORKTREE BLOCKED`
- `D. C0 INCOMPLETE`

Do not begin C1 in the same run. Return the generated C1 prompt for review.
