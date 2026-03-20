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

# Generate Prisma client
pnpm db:generate

# Run migrations against Neon (requires DATABASE_URL in packages/db/.env)
pnpm db:migrate

# Seed the database (idempotent — safe to run multiple times)
pnpm db:seed

# Start API in dev mode (requires DATABASE_URL in apps/api/.env)
pnpm dev:api

# Run tests
pnpm test

# Lint
pnpm lint

# Format
pnpm format

# Open Prisma Studio
pnpm db:studio
```

## Environment Setup

1. Copy `.env.example` files to `.env` in `packages/db/` and `apps/api/`.
2. Fill in your Neon Postgres `DATABASE_URL` and `DIRECT_DATABASE_URL`.
3. Never commit `.env` files — only `.env.example` is tracked.

## Milestones

See [ROADMAP.md](ROADMAP.md) for the full milestone index (M0–M47).

| Milestone                    | Status         |
| ---------------------------- | -------------- |
| M0 — Repo Bootstrap          | ✅ Complete    |
| M1 — Neon + Prisma Baseline  | ✅ Complete    |
| M2 — Auth v1 + RBAC          | ✅ Complete    |
| M3 — Multi-Tenancy Core      | ✅ Complete    |
| M3.1 — Quick PIN Login       | ✅ Complete    |
| M4 — Org Settings + Config   | ✅ Complete    |
| M5+                          | ⬜ Not started |

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API Conventions](docs/API_CONVENTIONS.md)
- [Module Plan](docs/MODULES.md)
- [Postman Guide](postman/POSTMAN_GUIDE.md)

## License

UNLICENSED — Proprietary
