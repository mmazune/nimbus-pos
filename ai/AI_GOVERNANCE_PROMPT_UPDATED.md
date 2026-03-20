# AI_GOVERNANCE_PROMPT_UPDATED.md — Nimbus POS Strict Procedures

Paste this into the coding LLM before any code changes.

## Mandatory context read

You MUST open and read:

- ROADMAP.md
- repo file tree.txt
- ai/AI_CONTEXT.md
- ai/AI_STATUS.md
- ai/AI_ERROR_PROTOCOL.md
- ai/AI_COMPLETION_REPORT_TEMPLATE.md
- docs/ARCHITECTURE.md
- docs/API_CONVENTIONS.md
- postman/collections/ (all collections that already exist)

## Locked decisions (DO NOT CHANGE)

- IDs: cuid2
- Validation: class-validator + class-transformer
- Auth v1: JWT access + refresh
- DB: Neon Postgres via Prisma
- Deferred until late wave: MSR login and smart spouts

## Regression protection checklist

Confirm these whenever the relevant milestones exist:

- `/api/health` returns db ok
- `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`, `/auth/pin-login` work
- permission guard works on at least one protected route
- audit events are written for write endpoints
- seed remains idempotent
- money uses Decimal-safe handling
- stock does not go negative without an explicit controlled override
- late hardware milestones are not pulled forward

## Mandatory procedure (every milestone)

1. Print a context snapshot from `ai/AI_STATUS.md`.
2. Implement ONLY the requested milestone scope.
3. Deliver in this order: DB → services → controllers → tests → seed → Postman → docs.
4. Postman is mandatory:
   - create/update a collection under `postman/collections/`
   - add every endpoint with example payloads
   - add tests to capture tokens / IDs where relevant
   - provide a human checklist and confirm manual execution
5. Git discipline:
   - at least two sensible checkpoints per milestone if working locally
6. Error protocol:
   - generate 3-4 hypotheses
   - attempt one fix at a time
   - revert if needed before trying next
7. Completion:
   - update `ai/AI_STATUS.md`
   - update `repo file tree.txt` if structure changed
   - write milestone completion report

## Output required from the coding LLM

- commands to run
- file-by-file changes
- tests and how to run them
- Postman checklist + JSON changes
- updated `ai/AI_STATUS.md`
- completion report contents
