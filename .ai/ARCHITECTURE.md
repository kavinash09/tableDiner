# ARCHITECTURE

**Last Updated**: 2026-10-08 (Post-Chapters 1-6 Scrutiny Fix)

> ⚠️ This file MUST be kept in sync with `apps/api/src/index.ts`. If you add a route, update this doc IMMEDIATELY.

---

## Port Registry

| App | Port | Command |
|-----|------|---------|
| `apps/api` | **3001** | `tsx src/index.ts` |
| `apps/customer-web` | **5173** | `vite` (default) |
| `apps/restaurant-admin` | **5174** | `vite --port 5174` |
| `apps/platform-admin` | **5175** | `vite --port 5175` |

---

## High-Level Topology

- **customer-web** (React, port 5173): Customer-facing. Reads `?qr=` URL param. Talks to API. NO direct DB access.
- **restaurant-admin** (React, port 5174): Kitchen/staff-facing Kanban board. Polls API every 5s. NO direct DB access.
- **platform-admin** (React, port 5175): Internal super-admin for tenant/restaurant onboarding. Talks to API. NO direct DB access.
- **api** (Fastify, port 3001): Central backend. Handles ALL business logic. Only component that touches DB.
- **db** (SQLite + Prisma, `packages/db/prisma/tablediner.db`): Single source of truth.

---

## API Route Catalog (`apps/api/src/index.ts`)

### Health
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/health` | Heartbeat check |

### Customer Flow
| Method | Route | Body | Description |
|--------|-------|------|-------------|
| GET | `/table/:qrCode` | — | Returns table info, active session, and full categorized menu |
| POST | `/table/:qrCode/order` | `{ items: [{ menuItemId, quantity }] }` | Places an order; auto-creates ACTIVE session if none exists |
| GET | `/table/:qrCode/bill` | — | Returns itemized bill total for the active session |
| POST | `/table/:qrCode/pay` | `{ amount: number }` | Mocked payment: creates Payment record, closes Session |

### Kitchen Dashboard
| Method | Route | Body | Description |
|--------|-------|------|-------------|
| GET | `/kitchen/orders` | — | Returns all non-SERVED orders (RECEIVED, PREPARING, READY) |
| PATCH | `/kitchen/orders/:orderId` | `{ status: string }` | Advances order status |

### Platform Admin (Super-Admin Only)
| Method | Route | Body | Description |
|--------|-------|------|-------------|
| GET | `/admin/restaurants` | — | Returns all tenants with nested restaurants and tables |
| POST | `/admin/restaurants` | `{ tenantName, restaurantName, tablesCount }` | Creates a new tenant, restaurant, and N tables with QR codes |

---

## Monorepo Tooling

- **Package Manager**: `pnpm workspaces` (see `pnpm-workspace.yaml`)
- **TypeScript**: `^5.2.2` across all apps. **Exception**: `packages/db` was pinned to broken `^7.0.2` — fixed to `^5.2.2`.
- **Dev runner for API**: `tsx` (NOT `ts-node` — ts-node breaks with TypeScript 5+)

## Shared Packages

| Package | Status | Purpose |
|---------|--------|---------|
| `packages/db` | ✅ Active | Prisma client export. Use: `import { prisma } from '@tablediner/db'` |
| `packages/shared-types` | ✅ Active | TypeScript interfaces for API responses. |
| `packages/shared-validation` | ✅ Active | Zod schemas for API input validation. |
| `packages/shared-config` | ⚠️ Stub | ESLint/TS base configs. Not yet wired into apps |

> **Rule**: Shared packages are now active. Import from `shared-types` or `shared-validation` as needed.

---

## Data Flow Diagram

```
Customer Phone
    │
    ▼ HTTP (VITE_API_URL)
┌──────────────┐
│  apps/api    │  :3001  Fastify
│  (index.ts)  │──────► packages/db (Prisma → SQLite)
└──────────────┘
    ▲
    │ HTTP polling (5s)
┌──────────────────┐
│ restaurant-admin │  :5174
└──────────────────┘
    ▲
    │ HTTP
┌──────────────────┐
│ platform-admin   │  :5175
└──────────────────┘
```

---

## Key Business Rules (Architecture Implications)
1. One `ACTIVE` Session per Table at a time.
2. `Session` transitions: `ACTIVE` → `CLOSED` (triggered by Payment).
3. `Order` status flow: `RECEIVED` → `PREPARING` → `READY` → `SERVED`.
4. All currency in **Rupees (₹)**. Stored as `Float` in DB.
5. API auto-creates a Session on first order if none exists.
