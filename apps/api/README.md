# TableDiner API (`@tablediner/api`)

This is the central Fastify-based backend for the TableDiner application. It handles all core business logic, including table session management, order state machine processing, payment webhooks, SaaS analytics aggregations, and authentication. It follows a strict Hexagonal Architecture.

## 🚀 Getting Started (Development)

Run the dev server from the monorepo root:
```bash
pnpm dev
```
Or to run this specific app:
```bash
cd apps/api
pnpm dev
```
*(The dev server runs using `tsx` on port `3001` with hot-reloading)*

## ⚙️ Environment Variables

The server requires a `.env` file at the `apps/api` level (or inherited from root):
```env
PORT=3001
HOST=0.0.0.1
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:5175
```
*(Note: CORS strictly validates against `ALLOWED_ORIGINS`)*

## 📂 Key Files & Architecture

- `src/index.ts` — The Fastify bootstrap, dependency injection registry, and HTTP primary adapters (routes).
- `src/core/use-cases/` — Pure business logic; no Prisma or Fastify imports allowed here.
- `src/adapters/secondary/db/` — Database repository implementations where Prisma is isolated.
- `src/__tests__/` — Vitest unit tests validating the HTTP boundary.

## 🧪 Testing
```bash
pnpm vitest run
```
