# e2e quarantine group (track T6, 26 Nov 2026)

The default e2e run (`pnpm --filter @nimbus-pos/api test:e2e`, and `test:e2e:jest-order` for
Jest's own file order) skips the specs below. They run on their own with
`pnpm --filter @nimbus-pos/api test:e2e:quarantine` (config `apps/api/test/jest-e2e.quarantine.json`),
where they are expected to fail with 403 until what is listed under "brings it back" happens.

**Why they are not in the default run:** every one of their endpoints is behind a permission key
that no role may hold by the product's own rules. `CLAUDE.md` section 12 (Track B6 boundaries):
"Do not seed any of the 35 remaining C-22 deferred-module permissions (`franchise:*`, `ops:*`,
`dev:*`, `merchant:*`, `billing:*`, `support:*`)". The T6 prompt: "Where the product's rules forbid
granting a key (billing, franchise, HMS), grant nothing." So the keys have no permission row
(`packages/db/prisma/rights-rulings.ts` `DEFERRED_KEYS`, decision D8 in `reports/T6_REPORT.md`),
and every role, Owner included, gets 403. That is the correct answer today, not a fault.

| spec | tests | keys behind it | what brings it back |
|---|---|---|---|
| `billing.e2e-spec.ts` | 17 | `billing:read`, `billing:subscription:write`, `billing:pesapal:checkout`, `dev:api-key:read`, `dev:api-key:write`, `dev:webhook:read`, `dev:webhook:write`, `dev:usage:read`, `support:session:read`, `support:session:write` | The owner authorises the deferred owner-SaaS billing, developer-portal and support modules (roadmap: owner billing and developer portal waves), and a seed grants the keys as `docs/direction/rights-matrix.json` proposes (Owner, Manager). |
| `franchise.e2e-spec.ts` | 13 | `franchise:overview:read`, `franchise:ranking:read`, `franchise:budget:read`, `franchise:transfer:read`, `franchise:transfer:write`, `franchise:digest:read`, `franchise:digest:write` | The franchise module is authorised (deferred, `docs/KNOWN_LIMITATIONS.md`) and its keys seeded (matrix: Owner, Manager). |
| `franchise-analytics.e2e-spec.ts` | 12 | `franchise:analytics:read`, `franchise:consolidation:generate`, `franchise:waste-benchmark:read`, `franchise:scorecard:read`, `franchise:ranking:generate-deep` | As above (matrix: Owner, Manager, Accountant for the finance keys). |
| `bg7-hms-integration.e2e-spec.ts` | 17 | its setup creates an API key with `dev:api-key:write`; the HMS reads themselves use the `hms:read:*` API-key scope | The developer portal is authorised and `dev:api-key:write` seeded (the HMS scope stays an API-key scope, never a role right). |

Measured on 26 Nov 2026 (T6, fresh throwaway database, T4 order): these four files are the 59
quarantined failures; every other red test of the T4 baseline (`docs/reviews/e2e-baseline.md`) was
fixed in T6 phase 3 (see `reports/T6_REPORT.md`, phase 3).

Not quarantined: `ops:*` routes (no role, by the matrix's own ruling; no spec exercises them).
