You are a senior TypeScript/NestJS/Prisma engineer working in a fresh Nimbus POS rebuild repo.

MANDATORY FIRST STEP:
Read these files fully before changing any code:

- ROADMAP.md
- repo file tree.txt
- ai/AI_CONTEXT.md
- ai/AI_STATUS.md
- ai/AI_ERROR_PROTOCOL.md
- ai/AI_COMPLETION_REPORT_TEMPLATE.md
- docs/ARCHITECTURE.md
- docs/API_CONVENTIONS.md

Implement milestone **M0 — Repo Bootstrap + Workspace Tooling** from `ROADMAP.md`.

Deliverables:

- pnpm workspace with apps/web, services/api, services/worker, services/sync, packages/db, packages/contracts, packages/ui, packages/auth, packages/printer
- NestJS API scaffold in `services/api`
- simple Next.js web scaffold in `apps/web`
- lint / format / test scripts wired at repo root
- nodemon hot reload via `pnpm dev:api`
- starter docs and README stubs
- `GET /api/health` working
- ensure `pnpm lint` and `pnpm test` pass even if minimal

Rules:

- Do not add business-domain code yet.
- Update `repo file tree.txt` if structure differs.
- Produce Postman collection `postman/collections/M0-Health.postman_collection.json`.
- After completion, update `ai/AI_STATUS.md` and fill the completion report template.

OUTPUT REQUIRED:

1. commands to run
2. file-by-file changes
3. Postman changes
4. updated `ai/AI_STATUS.md`
5. completion report
