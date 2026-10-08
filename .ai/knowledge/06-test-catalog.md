# 06 — Test Catalog

## Existing Tests

| File | Test Name | Type | What It Covers | Assertions |
|------|-----------|------|----------------|------------|
| `authRoute.test.ts` | auth form-encoded request | Unit/Integration | `authRoute` middleware parses `application/x-www-form-urlencoded` without returning HTTP 415 | 1 — `status !== 415` |
| `health.test.ts` | GET /health | Integration | API health endpoint returns 200 with `{status:'ok'}` | 1 — status 200 + body shape |
| `GetEODAuditReportUseCase.test.ts` | execute() output structure | Unit | `GetEODAuditReportUseCase.execute()` with mocked `RestaurantAnalyticsRepository`; asserts returned DTO shape | 1 — output structure |
| `SessionCheckout.integration.test.ts` | Session Checkout & Snapshotting | Integration | Atomic subtotal, totalAmount, and closedAt timestamp persistence; idempotency on multiple checkouts | 3 — timestamps, snapshot match, idempotency |
| `OrderLifecycle.integration.test.ts` | Order State Machine & Timestamps | Integration | Sequential timestamp recording (acceptedAt, readyAt, servedAt, cancelledAt); state skipping prevention; terminal state protection | 3 — timestamps recorded, invalid transition rejected, terminal state immutable |
| `HistoricalBackfill.integration.test.ts` | Historical Session Backfill | Integration | Non-destructive backfill of legacy sessions missing closedAt and financial snapshot values | 1 — repaired count, verified values |
| `AnalyticsPerformance.integration.test.ts` | Analytics DB Aggregations | Integration | Database-level SQL aggregations for table turn time, occupancy, and SLA prep/service/fulfillment durations | 4 — turn time & occupancy, zero session handling, SLA stage durations, zero order handling |

**Total: 14 tests across 7 files.**

---

## Coverage Matrix

### Use Cases

| Use Case | Covered |
|----------|---------|
| `GetEODAuditReportUseCase` | ✅ |
| `AppUseCases.getTableDetails` | ❌ |
| `AppUseCases.placeOrder` | ✅ |
| `AppUseCases.getBill` | ❌ |
| `AppUseCases.payBill` | ✅ |
| `AppUseCases.getKitchenOrders` | ❌ |
| `AppUseCases.updateOrderStatus` | ✅ |
| `AppUseCases.getPlatformTenants` | ❌ |
| `AppUseCases.createPlatformTenant` | ❌ |
| `GetRestaurantDashboardUseCase` | ✅ |
| `GetPlatformDashboardUseCase` | ❌ |

### Menu CRUD

| Operation | Covered |
|-----------|---------|
| `createMenuItem` | ❌ |
| `updateMenuItem` | ❌ |
| `deleteMenuItem` | ❌ |
| `createMenuCategory` | ❌ |
| `deleteMenuCategory` | ❌ |

### Domain Entities

| Entity / Method | Covered |
|-----------------|---------|
| `Order` state machine — `markPreparing` | ❌ |
| `Order` state machine — `markReady` | ❌ |
| `Order` state machine — `markServed` | ❌ |
| `Order` state machine — `cancel` | ❌ |
| `TableSession.closeSession` | ❌ |
| `TableSession.calculateRunningSubtotal` | ❌ |
| `ArchivableEntity.softDelete` | ❌ |
| `ArchivableEntity.restore` | ❌ |

### Infrastructure / Adapters

| Component | Covered |
|-----------|---------|
| `CsvExportAdapter.generateEodCsv` | ❌ |
| All Prisma repository implementations | ❌ |
| `PrismaRestaurantAnalyticsRepository` | ❌ |
| `PrismaPlatformAnalyticsRepository` | ❌ |

### API Routes (Integration)

| Route Group | Covered |
|-------------|---------|
| `GET /health` | ✅ |
| `POST /auth/*` (content-type guard) | ✅ (partial — 415 check only) |
| All analytics routes | ❌ |
| All menu admin routes | ❌ |
| All kitchen routes | ❌ |
| All customer routes | ❌ |
| Platform admin routes | ❌ |

---

## Priority Gaps

Ranked by blast radius (production risk × frequency of code change):

1. **Order state machine** — core business logic, no guard rails; illegal state transitions are undetected.
2. **`AppUseCases.placeOrder` / `payBill`** — revenue-critical paths with no regression net.
3. **Prisma repository implementations** — any schema migration can silently break queries.
4. **`CsvExportAdapter.generateEodCsv`** — manually written CSV logic, no lib safety net.
5. **`authRoute.test.ts` completeness** — current test only checks content-type; credential validation, JWT issuance, and CSRF handling are untested.
6. **`TableSession.calculateRunningSubtotal`** — financial calculation with no arithmetic assertion.
7. **Menu CRUD** — high change frequency during onboarding; missing coverage risks regressions.
8. **`ArchivableEntity.softDelete/restore`** — used across multiple models; logic errors silently corrupt data.
