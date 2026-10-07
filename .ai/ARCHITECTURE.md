# ARCHITECTURE

## High-Level Topology
- **customer-web** (React): Customer facing. Talks to API. NO direct DB access.
- **restaurant-admin** (React): Kitchen/Staff facing. Talks to API. NO direct DB access.
- **platform-admin** (React): Internal team facing. Talks to API. NO direct DB access.
- **api** (Fastify): Central backend. Handles all business logic and auth.
- **db** (SQLite + Prisma): Single source of truth.

## Monorepo Tooling
- **Manager**: `pnpm workspaces`
- **Shared Packages**:
  - `packages/db`: Prisma client and schema.
  - `packages/shared-types`: Shared TypeScript interfaces.
  - `packages/shared-validation`: Zod schemas for API/Form validation.
  - `packages/shared-config`: ESLint/TypeScript base configs.
