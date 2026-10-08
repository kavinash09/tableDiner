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
| [`.ai/ANALYTICS_SPEC.md`](./.ai/ANALYTICS_SPEC.md) | V1 Specifications for Dashboards and SaaS metrics |

| [`docs/IMPLEMENTATION_MAP.md`](./docs/IMPLEMENTATION_MAP.md) | Step-by-step chapter build plan |
| [`packages/db/prisma/schema.prisma`](./packages/db/prisma/schema.prisma) | Prisma schema — single source of truth for data |

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18 (see `.nvmrc`)
- pnpm v8+ (`npm install -g pnpm`)
- Docker (for local PostgreSQL database)

### 1. Start Local PostgreSQL Database
Run the persistent PostgreSQL container with host volume mapping:
```bash
docker run -d \
  --name tablediner-postgres \
  --restart unless-stopped \
  -e POSTGRES_USER=tablediner \
  -e POSTGRES_PASSWORD=tablediner_secret \
  -e POSTGRES_DB=tablediner \
  -p 5432:5432 \
  -v "$(pwd)/.postgres_data:/var/lib/postgresql/data" \
  postgres:16-alpine
```

### 2. Install & Sync Schema
```bash
pnpm install
cd packages/db && npx prisma db push && npx prisma generate
```

### 3. Seed the Database
```bash
cd packages/db && npx tsx seed.ts
```

### 4. Start All Apps
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

**Default Admin Login (for Restaurant & Platform Admin):**
- **Email:** `admin@tablediner.com`
- **Password:** `password123`

---

## 🏗️ Monorepo Structure

```
apps/
  api/              — Fastify REST API (port 3001)
  customer-web/     — React customer ordering UI (port 5173)
  restaurant-admin/ — React kitchen Kanban dashboard (port 5174)
  platform-admin/   — React super-admin panel (port 5175)
packages/
  db/               — Prisma client + PostgreSQL schema + seed
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


---

## 🚢 Deployment (Docker & Vercel)

If you wish to deploy the application, here are the configurations you can use.

### Backend (apps/api)
Create a `Dockerfile` at the root of the repository to containerize the Fastify API:

```dockerfile
# Dockerfile
FROM node:18-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY . /app
WORKDIR /app

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build

FROM base
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/apps/api/dist /app/apps/api/dist
EXPOSE 3001
CMD [ "pnpm", "--filter", "api", "start" ]
```

```bash
# Build the Docker image
docker build -t tablediner-api .

# Run the container
docker run -p 3001:3001 tablediner-api
```

### Frontends (Vercel)
To deploy the React applications (`customer-web`, `restaurant-admin`, `platform-admin`) to Vercel, you'll need to rewrite all routing to `index.html` for client-side routing to work.

Create a `vercel.json` file in the specific app directory (e.g., `apps/customer-web/vercel.json`):

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

**To deploy a frontend:**
1. Import the repository in Vercel.
2. Set the "Root Directory" to the specific app (e.g., `apps/customer-web`).
3. Vercel will automatically detect Vite and configure the build settings.
4. Add the `VITE_API_URL` environment variable in Vercel pointing to your deployed Docker API URL.
