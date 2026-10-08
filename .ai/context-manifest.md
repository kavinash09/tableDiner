# AI Context Manifest

> [!IMPORTANT]
> Load ONLY the files listed under **Load** for each task. Loading additional files wastes context window. Every task implicitly requires `.ai/AI_RULES.md` — it is never repeated below.

---

### Task: Create Order (customer ordering)
Priority Context: Orders are placed via `POST /table/:qrCode/order`. `AppUseCases.placeOrder()` auto-creates an `ACTIVE` `Session` if none exists and snapshots `unitPrice`/`lineTotal` at the time of the order onto `OrderItem`. The `PlaceOrderSchema` in `shared-validation` must be satisfied before calling the use case.
Load:
- `.ai/ARCHITECTURE.md` (route contract: POST /table/:qrCode/order)
- `apps/api/src/core/use-cases/AppUseCases.ts` (placeOrder method)
- `apps/api/src/core/domain/TableSession.ts` (addOrder, ACTIVE guard)
- `apps/api/src/adapters/secondary/db/PrismaRepositories.ts` (PrismaSessionRepository, PrismaOrderRepository)
- `packages/shared-validation/src/index.ts` (PlaceOrderSchema)
- `packages/shared-types/src/index.ts` (Order, OrderItem types)
- `packages/db/prisma/schema.prisma`
Ignore:
- `.ai/ANALYTICS_SPEC.md`
- `apps/api/src/core/use-cases/GetRestaurantDashboardUseCase.ts`
- `apps/api/src/core/use-cases/GetPlatformDashboardUseCase.ts`
- `apps/api/src/core/use-cases/GetEODAuditReportUseCase.ts`
- `apps/api/src/adapters/secondary/csv/`
- `apps/api/src/adapters/secondary/db/PrismaRestaurantAnalyticsRepository.ts`
- `apps/api/src/adapters/secondary/db/PrismaPlatformAnalyticsRepository.ts`

---

### Task: Fix Billing Bug (getBill price snapshot)
Priority Context: `AppUseCases.getBill()` currently computes `lineTotal` using `item.menuItem.price` (live price) instead of the snapshotted `item.unitPrice` stored on `OrderItem` at order-creation time. This means bill totals silently change if menu prices are edited after an order is placed. The fix is a one-line substitution: use `item.unitPrice` and `item.lineTotal` from the `OrderItem` record, not a fresh lookup.
Load:
- `apps/api/src/core/use-cases/AppUseCases.ts` (getBill method)
- `apps/api/src/adapters/secondary/db/PrismaRepositories.ts` (PrismaTableRepository include structure)
- `packages/db/prisma/schema.prisma` (OrderItem.unitPrice, OrderItem.lineTotal fields)
- `packages/shared-types/src/index.ts` (OrderItem type)
Ignore:
- `.ai/ANALYTICS_SPEC.md`
- All use cases except AppUseCases.ts
- All analytics/CSV adapters

---

### Task: Fix Session Status Bug (ACTIVE vs OPEN)
Priority Context: The Prisma schema defines `Session.status` as a string enum with values `ACTIVE` and `CLOSED`. Several analytics repository queries (and possibly seed data) may be filtering for `'OPEN'` which does not exist in the schema — causing all analytics to return zero results. The authoritative status values are defined in `TableSession.ts` (`SessionStatus = 'ACTIVE' | 'CLOSED'`) and in the Prisma schema.
Load:
- `packages/db/prisma/schema.prisma` (Session model, status field)
- `apps/api/src/core/domain/TableSession.ts` (SessionStatus type)
- `apps/api/src/adapters/secondary/db/PrismaRepositories.ts` (session queries)
- `apps/api/src/adapters/secondary/db/PrismaRestaurantAnalyticsRepository.ts`
- `apps/api/src/adapters/secondary/db/PrismaPlatformAnalyticsRepository.ts`
- `packages/db/seed.ts`
Ignore:
- `apps/api/src/core/domain/Order.ts`
- `apps/api/src/adapters/secondary/csv/`
- All frontend apps

---

### Task: Add RBAC / Authorization
Priority Context: Currently no auth guards exist on admin or restaurant routes — any unauthenticated caller can hit `/admin/restaurants` or `/restaurant/:id/*`. Auth.js (`@auth/core`) is already wired via `/api/auth/*` routes in `index.ts` using JWT sessions (`credentials: 'include'`). RBAC should be implemented as Fastify `preHandler` hooks that validate the JWT and check role claims before forwarding to use cases.
Load:
- `.ai/ARCHITECTURE.md` (full route catalog)
- `apps/api/src/index.ts`
- `apps/api/src/adapters/primary/http/authRoute.ts`
- `apps/api/src/config.ts`
- `packages/shared-types/src/index.ts` (User, role types if present)
- `.ai/DECISIONS.md` (Auth.js decision entry, 2026-10-08T23:46:00)
Ignore:
- `.ai/ANALYTICS_SPEC.md`
- All analytics use cases and repositories
- `apps/api/src/adapters/secondary/csv/`

---

### Task: Generate Daily Metrics
Priority Context: Daily metrics are served by `GET /api/v1/restaurants/:id/metrics/daily?date=YYYY-MM-DD` calling `GetRestaurantDashboardUseCase.execute()`. Business date boundaries are computed from `restaurant.businessDayCutoffHour`; sessions are matched by `businessDate` (denormalized string on `Session`). All queries live in `PrismaRestaurantAnalyticsRepository`. Analytics must be idempotent — no permanent counter increments.
Load:
- `.ai/ANALYTICS_SPEC.md`
- `apps/api/src/core/use-cases/GetRestaurantDashboardUseCase.ts`
- `apps/api/src/core/ports/RestaurantAnalyticsRepository.ts`
- `apps/api/src/adapters/secondary/db/PrismaRestaurantAnalyticsRepository.ts`
- `packages/db/prisma/schema.prisma` (Session, Order, OrderItem, Payment models)
- `apps/api/src/core/domain/AnalyticsDomainService.ts`
Ignore:
- `apps/api/src/core/use-cases/AppUseCases.ts`
- `apps/api/src/adapters/secondary/db/PrismaRepositories.ts`
- `apps/api/src/adapters/secondary/csv/`
- All frontend apps

---

### Task: Generate EOD Audit Report
Priority Context: EOD audit is served by `GET /api/v1/restaurants/:id/audit/eod?date=YYYY-MM-DD` (JSON) and `…/export` (CSV). `GetEODAuditReportUseCase.execute()` composes the report; `CsvExportAdapter.generateEodCsv()` serializes it to CSV without an external CSV library. CSV escaping is manual. The `RestaurantEodReportResponse` type in `shared-types` is the contract between the use case and the adapter.
Load:
- `.ai/ANALYTICS_SPEC.md` (Module 8: EOD Audit)
- `apps/api/src/core/use-cases/GetEODAuditReportUseCase.ts`
- `apps/api/src/core/ports/ReportExportAdapter.ts`
- `apps/api/src/adapters/secondary/csv/CsvExportAdapter.ts`
- `apps/api/src/adapters/secondary/db/PrismaRestaurantAnalyticsRepository.ts`
- `packages/shared-types/src/index.ts` (RestaurantEodReportResponse)
- `apps/api/src/__tests__/GetEODAuditReportUseCase.test.ts`
Ignore:
- `apps/api/src/core/use-cases/GetRestaurantDashboardUseCase.ts`
- `apps/api/src/core/use-cases/GetPlatformDashboardUseCase.ts`
- `apps/api/src/adapters/secondary/db/PrismaPlatformAnalyticsRepository.ts`
- All frontend apps

---

### Task: Add New Menu Item (CRUD)
Priority Context: Menu CRUD routes live on `/restaurant/:id/categories` and `/restaurant/:id/items`. All inputs are validated by `CreateCategorySchema`, `CreateMenuItemSchema`, and `UpdateMenuItemSchema` in `shared-validation`. Soft deletes are mandatory (`isActive = false`, `deletedAt = now()`) — never call `prisma.menuItem.delete()`. The `IMenuItemRepository` port must be the only interface extended; do not touch Fastify route handlers directly without updating `ARCHITECTURE.md`.
Load:
- `.ai/ARCHITECTURE.md` (menu management routes)
- `apps/api/src/core/use-cases/AppUseCases.ts` (createMenuItem, deleteMenuItem)
- `apps/api/src/core/ports/Repositories.ts` (IMenuItemRepository)
- `apps/api/src/adapters/secondary/db/PrismaRepositories.ts` (PrismaMenuItemRepository)
- `packages/shared-validation/src/index.ts` (CreateMenuItemSchema, UpdateMenuItemSchema)
- `packages/db/prisma/schema.prisma` (MenuItem, MenuCategory models)
Ignore:
- `.ai/ANALYTICS_SPEC.md`
- All analytics use cases and repositories
- `apps/api/src/adapters/secondary/csv/`

---

### Task: Onboard New Tenant
Priority Context: Tenant onboarding is `POST /admin/restaurants` calling `AppUseCases.createRestaurant()`. It creates `Tenant` → `Restaurant` → N `Table` records with generated QR codes in a single transaction. The `CreateRestaurantSchema` defines the required payload. `tenantId` must be explicitly set (denormalized) on all child records to support multi-tenant analytics queries.
Load:
- `.ai/ARCHITECTURE.md` (Platform Admin routes)
- `apps/api/src/core/use-cases/AppUseCases.ts` (createRestaurant)
- `apps/api/src/adapters/secondary/db/PrismaRepositories.ts`
- `packages/shared-validation/src/index.ts` (CreateRestaurantSchema)
- `packages/db/prisma/schema.prisma` (Tenant, Restaurant, Table models)
- `.ai/DECISIONS.md` (tenantId denormalization decision, 2026-10-09T00:19:00)
Ignore:
- `.ai/ANALYTICS_SPEC.md`
- All analytics repositories
- `apps/api/src/adapters/secondary/csv/`
- All frontend apps except `apps/platform-admin/` if UI changes are needed

---

### Task: Write Unit Tests for AppUseCases
Priority Context: `AppUseCases` depends on six repository interfaces (`ITableRepository`, `ISessionRepository`, `IOrderRepository`, `IPaymentRepository`, `IRestaurantRepository`, `IMenuItemRepository`) defined in `core/ports/Repositories.ts`. Tests mock all six interfaces and exercise each public method in isolation. The test runner is Vitest (`apps/api/vitest.config.ts`). Existing test reference: `apps/api/src/__tests__/GetEODAuditReportUseCase.test.ts`.
Load:
- `apps/api/src/core/use-cases/AppUseCases.ts`
- `apps/api/src/core/ports/Repositories.ts`
- `apps/api/src/core/domain/Order.ts`
- `apps/api/src/core/domain/TableSession.ts`
- `apps/api/src/__tests__/GetEODAuditReportUseCase.test.ts` (pattern reference)
- `apps/api/vitest.config.ts`
- `.ai/testing/missing-unit-tests.md`
Ignore:
- `.ai/ANALYTICS_SPEC.md`
- All adapters (primary and secondary)
- All frontend apps

---

### Task: Write Integration Tests for API Routes
Priority Context: Integration tests use Supertest against the Fastify app instance exported from `index.ts`. The test database is the local SQLite file at `packages/db/prisma/tablediner.db`. Tests must seed minimal required data (Tenant, Restaurant, Table, MenuItem) before each scenario. Reference the existing health and auth integration tests for setup patterns.
Load:
- `apps/api/src/index.ts`
- `apps/api/tests/integration/health.test.ts` (pattern reference)
- `apps/api/src/__tests__/authRoute.test.ts` (pattern reference)
- `apps/api/vitest.config.ts`
- `packages/db/prisma/schema.prisma`
- `packages/db/seed.ts`
- `.ai/testing/missing-integration-tests.md`
- `.ai/ARCHITECTURE.md` (route catalog)
Ignore:
- All domain entity files
- All analytics use cases
- `apps/api/src/adapters/secondary/csv/`
- All frontend apps

---

### Task: Fix tenantId Population Bug
Priority Context: Analytics queries (restaurant and platform dashboards) filter by `tenantId` (denormalized on `Session` and `Order`). However, `PrismaSessionRepository.createActiveSession()` and `PrismaOrderRepository.createOrder()` do not currently set `tenantId` or `businessDate` on the created records — causing all analytics to silently return zeros. The fix requires passing `tenantId` and computed `businessDate` through the repository creation calls.
Load:
- `apps/api/src/adapters/secondary/db/PrismaRepositories.ts` (createActiveSession, createOrder)
- `apps/api/src/core/ports/Repositories.ts` (ISessionRepository, IOrderRepository signatures)
- `apps/api/src/core/use-cases/AppUseCases.ts` (placeOrder — where tenantId must be sourced)
- `packages/db/prisma/schema.prisma` (Session.tenantId, Session.businessDate, Order.tenantId, Order.businessDate)
- `.ai/DECISIONS.md` (2026-10-09T00:19:00 — denormalization rationale)
Ignore:
- `.ai/ANALYTICS_SPEC.md`
- All frontend apps
- `apps/api/src/adapters/secondary/csv/`

---

### Task: Add New Analytics Metric
Priority Context: Restaurant-level metrics are computed in `GetRestaurantDashboardUseCase.execute()` by calling `PrismaRestaurantAnalyticsRepository`. Platform-level metrics are in `GetPlatformDashboardUseCase.execute()` and `PrismaPlatformAnalyticsRepository`. New metrics must: (1) add a method to the relevant port interface, (2) implement in the Prisma adapter, (3) call from the use case, (4) expose in the response type in `shared-types`. Never bypass the port interface.
Load:
- `.ai/ANALYTICS_SPEC.md`
- `apps/api/src/core/use-cases/GetRestaurantDashboardUseCase.ts`
- `apps/api/src/core/ports/RestaurantAnalyticsRepository.ts`
- `apps/api/src/adapters/secondary/db/PrismaRestaurantAnalyticsRepository.ts`
- `apps/api/src/core/use-cases/GetPlatformDashboardUseCase.ts`
- `apps/api/src/core/ports/PlatformAnalyticsRepository.ts`
- `apps/api/src/adapters/secondary/db/PrismaPlatformAnalyticsRepository.ts`
- `packages/shared-types/src/index.ts`
- `packages/db/prisma/schema.prisma`
Ignore:
- `apps/api/src/core/use-cases/AppUseCases.ts`
- `apps/api/src/adapters/secondary/db/PrismaRepositories.ts`
- All frontend apps

---

### Task: Debug Authentication Issue
Priority Context: Auth.js is integrated via `@auth/core` into the Fastify `/api/auth/*` route in `authRoute.ts`. `AUTH_SECRET` from `config.ts` is the JWT signing key — if unset, the fallback value means any environment without the env var will accept forged tokens. Frontend SPAs must use `redirect: 'manual'` on the credentials callback fetch and handle `opaqueredirect`/302 manually to avoid JSON parse errors.
Load:
- `apps/api/src/adapters/primary/http/authRoute.ts`
- `apps/api/src/config.ts`
- `apps/api/src/__tests__/authRoute.test.ts`
- `.ai/DECISIONS.md` (2026-10-08T23:46:00 Auth.js decision; 2026-10-09 SPA redirect fix)
Ignore:
- `.ai/ANALYTICS_SPEC.md`
- All analytics files
- All domain entities
- `apps/api/src/core/use-cases/AppUseCases.ts`

---

### Task: Add CSV Export Enhancement
Priority Context: `CsvExportAdapter.generateEodCsv()` manually builds CSV strings — no external CSV library is used. The `RestaurantEodReportResponse` type from `shared-types` is the only input contract. Escaping is manual (double-quote wrapping). If the enhancement requires streaming or complex nesting, the `DECISIONS.md` reversal trigger (switch to `fast-csv`) must be discussed with the user before implementation.
Load:
- `apps/api/src/adapters/secondary/csv/CsvExportAdapter.ts`
- `apps/api/src/core/ports/ReportExportAdapter.ts`
- `packages/shared-types/src/index.ts` (RestaurantEodReportResponse)
- `.ai/DECISIONS.md` (EOD Audit Report decision — fast-csv reversal trigger)
- `apps/api/src/core/use-cases/GetEODAuditReportUseCase.ts`
Ignore:
- All analytics query files (PrismaRestaurantAnalyticsRepository, PrismaPlatformAnalyticsRepository)
- `apps/api/src/core/use-cases/AppUseCases.ts`
- All domain entities
- All frontend apps

---

### Task: General Architecture Review
Priority Context: TableDiner is a Fastify + React monorepo using Hexagonal Architecture. The API is the sole DB boundary. All business logic lives in `core/use-cases/`; Prisma is confined to `adapters/secondary/db/`. The route-to-use-case wiring is in `index.ts`. Multi-tenancy is enforced via `tenantId` on all operational models.
Load:
- `.ai/PROJECT_INTELLIGENCE_PACK.md`
- `.ai/ARCHITECTURE.md`
- `.ai/DECISIONS.md`
- `.ai/PROJECT_STATE.md`
- `apps/api/src/index.ts`
- `packages/db/prisma/schema.prisma`
- `apps/api/src/core/ports/Repositories.ts`
- `.ai/ANALYTICS_SPEC.md`
- `.ai/testing/high-risk-areas.md`
Ignore:
- Individual use-case implementation files (unless a specific area needs deep dive)
- All frontend app source files
