# Nimbus POS

Enterprise Point-of-Sale system built as a TypeScript monorepo.

## Stack

| Layer           | Technology                          |
| --------------- | ----------------------------------- |
| Runtime         | Node.js 22 + TypeScript (strict)    |
| Monorepo        | pnpm workspaces + Turborepo         |
| Backend         | NestJS                              |
| ORM             | Prisma                              |
| Database        | Neon Postgres                       |
| Cache / Jobs    | Redis + BullMQ                      |
| Validation      | class-validator + class-transformer |
| Auth            | JWT access + refresh (v1)           |
| Frontend        | Next.js + React Query + Tailwind    |
| API Testing     | Postman collections per milestone   |
| Automated Tests | Jest + Supertest                    |
| IDs             | cuid2                               |

## Workspace Layout

```
nimbus-pos/
├── apps/
│   ├── api/         # NestJS API (primary backend)
│   ├── web/         # Next.js backoffice UI (M43+)
│   ├── desktop/     # POS desktop shell (deferred)
│   └── mobile/      # Mobile companion (deferred)
├── packages/
│   ├── db/          # Prisma schema, migrations, seed, client (M1+)
│   └── shared/      # Shared types, enums, DTOs
├── docs/            # Architecture & convention docs
├── ai/              # AI governance, status, reports
└── postman/         # Collections & environments
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Start API in dev mode
pnpm dev:api

# Run tests
pnpm test

# Lint
pnpm lint

# Format
pnpm format
```

## Milestones

See [ROADMAP.md](ROADMAP.md) for the full milestone index (M0–M47).

| Milestone                   | Status         |
| --------------------------- | -------------- |
| M0 — Repo Bootstrap         | ✅ Complete    |
| M1 — Neon + Prisma Baseline | ⬜ Not started |
| M2 — Auth v1 + RBAC         | ⬜ Not started |
| M3+                         | ⬜ Not started |

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API Conventions](docs/API_CONVENTIONS.md)
- [Module Plan](docs/MODULES.md)
- [Postman Guide](postman/POSTMAN_GUIDE.md)

## License

UNLICENSED — Proprietary
