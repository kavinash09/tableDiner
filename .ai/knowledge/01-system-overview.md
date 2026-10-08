# 01 — System Overview

## Product Purpose

TableDiner is a multi-tenant SaaS platform for restaurant table-ordering. Diners scan a QR code at a physical table, browse the menu, place orders, view the bill, and pay — entirely in-browser with no app install. Restaurant staff manage menus, monitor kitchen order status, and view analytics. A platform admin manages tenants and subscriptions.

## Target Users

| Role | App | Primary Actions |
|---|---|---|
| Diner | customer-web | Scan QR → browse menu → place order → pay |
| Restaurant staff / kitchen | restaurant-admin | Manage menu, view/update kitchen orders, view daily metrics |
| Platform admin | platform-admin | Provision tenants, view platform-wide metrics |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 (Vite) |
| Styling | TailwindCSS |
| Backend framework | Fastify (TypeScript via tsx) |
| ORM | Prisma |
| Database | SQLite (file-based) |
| Auth | Auth.js (`@auth/core`) — JWT sessions, CredentialsProvider |
| Validation | Zod (in `shared-validation`) |
| Testing | Vitest |
| Package manager | pnpm workspaces (monorepo) |
| Password hashing | bcrypt |

---

## Monorepo Folder Map

```
TableDiner_AI_First_Starter/
├── apps/
│   ├── customer-web/        # Diner-facing SPA (Vite, port 5173)
│   ├── restaurant-admin/    # Staff / kitchen SPA (Vite, port 5174)
│   ├── platform-admin/      # Platform SaaS admin SPA (Vite, port 5175)
│   └── api/                 # Fastify REST API (tsx, port 3001)
│       ├── src/
│       │   ├── index.ts         # Route registration entrypoint
│       │   ├── AppUseCases.ts   # Monolithic use-case class (MVP)
│       │   ├── authRoute.ts     # Auth.js ↔ Fastify bridge
│       │   └── usecases/        # Separate use-case classes (analytics, audit)
│       └── ...
├── packages/
│   ├── db/                  # Prisma schema, generated client, seed script
│   ├── shared-types/        # TypeScript API contract types (no runtime deps)
│   ├── shared-validation/   # Zod schemas (depends on zod only)
│   └── shared-config/       # Stub — reserved for shared runtime config
├── pnpm-workspace.yaml
└── package.json
```

### Package Dependency Graph

```
customer-web   ──► shared-types
restaurant-admin ► shared-types
platform-admin ──► shared-types
api ─────────────► shared-types, shared-validation, db
db ──────────────► (Prisma, no workspace deps)
shared-validation► zod
shared-types ───► (none)
shared-config ──► (none / stub)
```

---

## Environment Variables

| Variable | Used By | Purpose |
|---|---|---|
| `DATABASE_URL` | api / db | SQLite connection string for Prisma |
| `AUTH_SECRET` | api | Auth.js JWT signing secret |
| `NEXTAUTH_URL` | api | Auth.js canonical URL (e.g. `http://localhost:3001`) |
| `PORT` | api | Fastify listen port (default `3001`) |
| `VITE_API_URL` | all SPAs | Base URL for API calls (e.g. `http://localhost:3001`) |

---

## Startup Commands

```bash
# Install all workspace deps
pnpm install

# Generate Prisma client (run after schema changes)
pnpm --filter db prisma generate

# Run database migrations
pnpm --filter db prisma migrate dev

# Seed database
pnpm --filter db prisma db seed

# Start API (port 3001)
pnpm --filter api dev

# Start customer-web (port 5173)
pnpm --filter customer-web dev

# Start restaurant-admin (port 5174)
pnpm --filter restaurant-admin dev

# Start platform-admin (port 5175)
pnpm --filter platform-admin dev

# Run all tests
pnpm test
```
