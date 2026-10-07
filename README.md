# TableDiner AI-First Starter 🍽️

TableDiner is a modern, AI-first QR-code based ordering platform for restaurants. Customers scan a QR code at their table, browse the menu, place orders, and pay — all without a physical menu or waiter involvement.

**Current Status**: All 6 chapters complete. Full MVP flow is live: Scan → Browse → Order → Kitchen → Pay.

---

## 🗺️ Project Navigation

Before diving in, review the core documentation:

| File | Purpose |
|------|---------|
| [`.ai/PROJECT_CONTEXT.md`](./.ai/PROJECT_CONTEXT.md) | Core product goals and MVP out-of-scope items |
| [`.ai/AI_RULES.md`](./.ai/AI_RULES.md) | AI constitution — rules every agent must follow |
| [`.ai/ARCHITECTURE.md`](./.ai/ARCHITECTURE.md) | Port registry, API route catalog, and data flow |
| [`.ai/RETRIEVAL_GUIDE.md`](./.ai/RETRIEVAL_GUIDE.md) | How AI agents must ingest and update context |
| [`.ai/DECISIONS.md`](./.ai/DECISIONS.md) | Append-only log of architectural decisions |
| [`docs/IMPLEMENTATION_MAP.md`](./docs/IMPLEMENTATION_MAP.md) | Step-by-step chapter build plan |
| [`packages/db/prisma/schema.prisma`](./packages/db/prisma/schema.prisma) | Prisma schema — single source of truth for data |

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18 (see `.nvmrc`)
- pnpm v8+ (`npm install -g pnpm`)

### Install
```bash
pnpm install
```
> If you see `ERR_PNPM_IGNORED_BUILDS`, run `pnpm approve-builds` and select all packages.

### Seed the database
```bash
cd packages/db && npx tsx seed.ts
```

### Start all apps
```bash
pnpm dev
```

---

## 📡 Running Apps

| App | URL | Who Uses It |
|-----|-----|-------------|
| Customer Web | http://localhost:5173/?qr=table-1 | Diners at the table |
| Restaurant Admin | http://localhost:5174 | Kitchen staff |
| Platform Admin | http://localhost:5175 | TableDiner super-admins |
| API | http://localhost:3001/health | Backend (Fastify) |

---

## 🏗️ Monorepo Structure

```
apps/
  api/              — Fastify REST API (port 3001)
  customer-web/     — React customer ordering UI (port 5173)
  restaurant-admin/ — React kitchen Kanban dashboard (port 5174)
  platform-admin/   — React super-admin panel (port 5175)
packages/
  db/               — Prisma client + SQLite schema + seed
  shared-types/     — TypeScript interfaces (stub — pending population)
  shared-validation/— Zod schemas (stub — pending population)
  shared-config/    — ESLint/TS base configs (stub)
```

---

## ⚙️ Environment Variables

Each frontend app has a `.env.local` file:

```env
VITE_API_URL=http://localhost:3001
```

Change `VITE_API_URL` to point to a different API host (e.g., staging) without touching source code.
