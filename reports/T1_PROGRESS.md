# T1 progress — screens: shell, Floor, and the sections with an API

Branch `t1/screens`, cut from `rebuild/main` at `0af95f8` (U0 merged; `kit/index.ts` present).

## Now
- Phase 1 (U1 shell and Floor), part: read-back.

## Commits
| Phase.part | Commit | What |
|---|---|---|

## Environment (this container, never Neon)
- Postgres 16 local, db `nimbus_t1`, migrated + `db:seed` + `db:demo:import`.
- API `node apps/api/dist/main.js` run from a scratch cwd (no `.env` loaded), `:3001`, PID in scratchpad `api.pid`.

## Decisions taken
1. moses-build-standards loaded (v5).

## Left out (and why)

## Next
- Read-back `reports/U1_READ_BACK.md` with Playwright baseline.
