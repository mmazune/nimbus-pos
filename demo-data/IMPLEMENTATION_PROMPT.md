You are Codex GPT-5.5 working in the Nimbus POS repo.

MODEL EFFORT: High.

TASK TYPE: Enterprise demo data import + UI smoke startup.

PRIMARY GOAL
Use the uploaded `demo-data` folder to implement a safe, repo-aware import path for the generated enterprise demo CSV pack, then run it and start the UI so the demo data is visible in the product.

REPO PATH
Use only:
C:\Users\arman\Desktop\nimbus-pos

Do not use:
C:\Users\arman\Desktop\NIMBUS\nimbus-pos

READ FIRST
1. demo-data/README.md
2. demo-data/DEMO_DATA_GENERATION_REPORT.md
3. demo-data/DEMO_DATA_ROW_COUNTS.md
4. demo-data/DEMO_DATA_RELATIONSHIP_MAP.md
5. demo-data/DEMO_DATA_REVIEW_CHECKLIST.md
6. demo-data/demo-import.scaffold.ts
7. ai/DEMO_DATA_SCAN_REPORT.md
8. ai/DEMO_DATA_SCHEMA_FIELD_INVENTORY.md
9. ai/DEMO_DATA_CSV_MANIFEST.md
10. ai/DEMO_DATA_IMPORT_STRATEGY.md
11. packages/db/prisma/schema.prisma
12. packages/db/prisma/seed.ts
13. README.md
14. apps/web/README.md

SCOPE
Implement the importer and validation using the actual Prisma schema and existing seed conventions.

The demo must cover the full enterprise platform:
- franchise / multi-branch
- accounting / GL / AP / AR
- inventory / recipes / FIFO
- POS sales history
- KDS metadata
- reservations
- events / bookings / tickets
- HR / attendance / leave / shift swaps
- reports / exports
- alerts / anomalies
- devices / printer routes / terminal stubs
- feature flags / maintenance / training
- safe HMS metadata

SAFETY RULES
- No schema changes unless a genuine compile-only importer issue requires a local script type fix.
- No backend controller/service changes.
- No frontend UI changes unless a route crashes and the fix is directly needed for demo viewing.
- No Postman changes.
- No live provider credentials.
- Public diner mobile money remains CRITICAL — PENDING MTN/AIRTEL PROVIDER CONFIRMATION.
- PesaPal remains owner SaaS billing only.
- Receipt send remains PENDING — no live email/SMS/WhatsApp adapter.
- Printer routes are metadata only.
- Terminal pairing remains STUB only.
- HMS API key CSV row must not create plaintext secrets; if a real demo key is needed, use the existing dev API/service and return plaintext exactly once in a local-only operator note.

IMPLEMENTATION STEPS
1. Confirm repo path and pnpm version:
   corepack pnpm@8.15.0 --version
2. Copy/confirm demo-data exists at repo root.
3. Create a real TypeScript importer at:
   packages/db/prisma/demo-import.ts
4. Importer default mode must be dry-run.
5. Implement CSV parsing, header validation, enum validation, natural-key validation, FK resolution checks, money/date parsing, order total checks, payment checks, AP/AR checks, journal-balance checks, and unsafe-surface checks.
6. Run dry-run validation first.
7. Only after dry-run passes, add a reviewed write-mode flag:
   DEMO_DATA_WRITE=1
8. Implement write-mode using Prisma upserts for reference data and careful deterministic inserts/upserts for operational data.
9. Do not import unsupported PurchaseOrder/GoodsReceipt CSVs.
10. Preserve existing seed compatibility. Prefer updating/extending org slug `nimbus`, not creating duplicate orgs.
11. Add package script if safe:
    db:demo:validate
    db:demo:import
12. Run:
    corepack pnpm@8.15.0 db:generate
    corepack pnpm@8.15.0 db:migrate
    corepack pnpm@8.15.0 db:seed
    corepack pnpm@8.15.0 db:demo:validate
    DEMO_DATA_WRITE=1 corepack pnpm@8.15.0 db:demo:import
13. Start API:
    corepack pnpm@8.15.0 dev:api
14. Confirm:
    http://localhost:3001/api/health
15. Start web:
    corepack pnpm@8.15.0 --filter @nimbus-pos/web dev
16. Open:
    http://localhost:3000/login
17. Login with seeded/demo waiter or manager.
18. Verify visible demo data in UI:
    - /waiter/floor shows real tables
    - /waiter/orders shows queue/sales history
    - /waiter/reservations shows reservations
    - /waiter/me shows profile/shift/self-service context
    - receipt/request-bill UI still works where order data supports it
19. If backoffice routes exist, verify franchise/accounting/inventory dashboards or state exactly which routes are not built yet.

VALIDATION COMMANDS
Run and report:
- corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck
- corepack pnpm@8.15.0 --filter @nimbus-pos/web lint
- corepack pnpm@8.15.0 --filter @nimbus-pos/web build
- importer dry-run
- importer write-mode, only after dry-run passes
- API health
- UI route smoke

DELIVERABLE FORMAT
Return exactly:
1. Context snapshot
2. Repo path confirmed
3. Demo-data files detected
4. Importer files changed
5. Dry-run validation result
6. Write import result
7. Row counts imported
8. Safety labels preserved
9. API startup result
10. Web startup result
11. UI smoke result
12. What data is visible in UI
13. Backoffice/franchise/accounting/inventory visibility notes
14. Files changed
15. Validation commands and results
16. Known limitations
17. Recommended next prompt
18. DONE checks

DONE CHECKS
- Demo CSV pack validated.
- Demo data imported into local DB.
- No unsupported PO/GRN import attempted.
- Public mobile-money stays pending/provider-gated.
- Receipt send stays pending/no-adapter.
- Printer routes metadata only.
- Terminal pairing stub only.
- No fake live credentials.
- API starts on port 3001.
- Web starts on port 3000.
- Login page opens.
- Demo data is visible in waiter UI.
- Typecheck/lint/build pass or failures are fully explained.
