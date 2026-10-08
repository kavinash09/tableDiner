# 07 — Dependency Map

## External Dependencies

| Package | Version Constraint | Used By | Purpose |
|---------|--------------------|---------|---------|
| `fastify` | workspace | `apps/api` | HTTP server framework |
| `@fastify/cors` | workspace | `apps/api` | CORS middleware |
| `@fastify/multipart` | workspace | `apps/api` | File upload parsing |
| `@fastify/static` | workspace | `apps/api` | Static file serving |
| `@fastify/formbody` | workspace | `apps/api` | `application/x-www-form-urlencoded` parsing |
| `@auth/core` | workspace | `apps/api/authRoute.ts` | Auth.js core (JWT, CSRF, callbacks) |
| `@auth/core/providers/credentials` | workspace | `apps/api/authRoute.ts` | Credentials provider for Auth.js |
| `@auth/prisma-adapter` | workspace | `apps/api/authRoute.ts` | Prisma session/account adapter for Auth.js |
| `bcryptjs` | workspace | `apps/api/authRoute.ts` | Password hash comparison |
| `@aws-sdk/client-s3` | workspace | `apps/api` (uploadService) | S3-compatible object storage |
| `@prisma/client` | workspace | `PrismaRestaurantAnalyticsRepository`, `PrismaPlatformAnalyticsRepository` | Direct PrismaClient instantiation (not singleton) |
| `@tablediner/db` | internal | `apps/api`, `authRoute.ts`, `PrismaRepositories.ts` | Shared Prisma singleton + generated client |
| `@tablediner/shared-types` | internal | `apps/api`, `customer-web/App.tsx`, `restaurant-admin/App.tsx` | Shared TypeScript types/DTOs |
| `@tablediner/shared-validation` | internal | `apps/api/src/index.ts` | Zod schemas for request validation |
| `qrcode.react` | workspace | `restaurant-admin` only | QR code rendering for table links |
| `tsx` | workspace | `apps/api` (dev runner) | TypeScript execution (replaces ts-node) |
| `pnpm` | workspace tooling | monorepo root | Workspace package manager |

> [!NOTE] `PrismaRestaurantAnalyticsRepository` and `PrismaPlatformAnalyticsRepository` instantiate `PrismaClient` directly instead of using the `@tablediner/db` singleton. This risks connection pool exhaustion in production.

---

## Internal Dependency Graph

```
monorepo root (pnpm workspaces)
├── packages/
│   ├── @tablediner/db          ← Prisma schema + singleton client
│   │   └── consumed by: apps/api, authRoute.ts, PrismaRepositories.ts
│   ├── @tablediner/shared-types ← DTOs, enums, domain contracts
│   │   └── consumed by: apps/api, customer-web, restaurant-admin
│   └── @tablediner/shared-validation ← Zod schemas
│       └── consumed by: apps/api/src/index.ts (request validation)
│
└── apps/
    ├── api/
    │   ├── src/index.ts         ← Fastify bootstrap; wires all deps
    │   │   ├── → authRoute.ts
    │   │   ├── → PrismaRepositories.ts       → @tablediner/db
    │   │   ├── → AppUseCases.ts              → domain use cases
    │   │   ├── → PrismaRestaurantAnalyticsRepository → @prisma/client (direct)
    │   │   ├── → PrismaPlatformAnalyticsRepository   → @prisma/client (direct)
    │   │   ├── → GetRestaurantDashboardUseCase
    │   │   ├── → GetPlatformDashboardUseCase
    │   │   ├── → GetEODAuditReportUseCase
    │   │   ├── → CsvExportAdapter
    │   │   ├── → uploadService               → @aws-sdk/client-s3
    │   │   └── → config
    │   └── authRoute.ts
    │       ├── → @auth/core
    │       ├── → @auth/core/providers/credentials
    │       ├── → @auth/prisma-adapter        → @tablediner/db
    │       └── → bcryptjs
    │
    ├── customer-web/
    │   └── src/App.tsx
    │       ├── → @tablediner/shared-types
    │       └── → fetch (native browser)
    │
    ├── restaurant-admin/
    │   └── src/App.tsx
    │       ├── → @tablediner/shared-types
    │       ├── → qrcode.react
    │       └── → fetch (native browser)
    │       AuthContext.tsx
    │       └── → fetch (native browser, no external auth lib)
    │
    └── platform-admin/
        └── src/AuthContext.tsx
            └── → fetch (native browser, no external auth lib)
```

---

## Circular Dependency Check

**Result: No cycles detected.**

The dependency graph is strictly layered:

```
shared-types / shared-validation
       ↓
    @tablediner/db
       ↓
  infrastructure (PrismaRepositories, authRoute)
       ↓
  use cases (AppUseCases, analytics use cases)
       ↓
  API bootstrap (index.ts)
       ↓
  frontend apps (customer-web, restaurant-admin, platform-admin)
```

No package imports from a layer above it.

---

## Key Observations

1. **Two PrismaClient instantiation paths** — `PrismaRepositories.ts` uses the singleton from `@tablediner/db`; analytics repositories instantiate `PrismaClient` directly from `@prisma/client`. This inconsistency should be unified.
2. **No external auth library in frontend apps** — `restaurant-admin/AuthContext.tsx` and `platform-admin/AuthContext.tsx` use raw `fetch` against the API's Auth.js endpoints; session state is managed manually in React context.
3. **`qrcode.react` is restaurant-admin-only** — the dependency is not shared, keeping other apps lean.
4. **`@aws-sdk/client-s3` is API-only** — frontend apps have no direct cloud SDK dependency; upload is mediated through the API.
5. **`tsx` replaces `ts-node`** — decision documented in DECISIONS.md; `ts-node` broke with TypeScript 5+.
