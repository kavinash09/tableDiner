# DECISIONS LOG

### 2026-10-08: API & Web Foundations (Chapter 3)
- **API Framework**: Chose `fastify` combined with `@fastify/cors` for high performance. Placed at `apps/api`.
- **API Data Fetching**: Created `GET /table/:qrCode` route that aggressively includes nested Prisma relations (`restaurant.menuCategories.items`) to minimize roundtrips.
- **Web Framework**: Chose standard React + Vite for `customer-web`. It parses the `?qr=` URL parameter.
- **Seeding**: Wrote `packages/db/seed.ts` to mock out "The Rusty Spoon" restaurant with Menu Categories and Tables.

### 2026-10-08: Monorepo Setup (Chapter 2)
- **Tooling**: Standardized on `pnpm-workspace.yaml`.

### 2026-10-08: Data Foundations (Chapter 1)
- **Schema Expansion**: Added `MenuCategory` and `OrderItem`.
