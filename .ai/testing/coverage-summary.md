# Test Coverage Summary

**Last Updated**: 2026-10-09
**Test Runner**: Vitest (`apps/api/vitest.config.ts`)
**Overall Coverage**: ~5% (3 tested / ~60+ testable scenarios)

---

## Unit Testable — Business Logic

| Unit | Tested | File |
|------|--------|------|
| `Order.markPreparing()` | ❌ | `apps/api/src/core/domain/Order.ts` |
| `Order.markReady()` | ❌ | `apps/api/src/core/domain/Order.ts` |
| `Order.markServed()` | ❌ | `apps/api/src/core/domain/Order.ts` |
| `Order.cancel()` | ❌ | `apps/api/src/core/domain/Order.ts` |
| `Order.calculateTotal()` | ❌ | `apps/api/src/core/domain/Order.ts` |
| `TableSession.addOrder()` | ❌ | `apps/api/src/core/domain/TableSession.ts` |
| `TableSession.closeSession()` | ❌ | `apps/api/src/core/domain/TableSession.ts` |
| `TableSession.calculateRunningSubtotal()` | ❌ | `apps/api/src/core/domain/TableSession.ts` |
| `ArchivableEntity.softDelete()` | ❌ | `apps/api/src/core/domain/ArchivableEntity.ts` |
| `ArchivableEntity.restore()` | ❌ | `apps/api/src/core/domain/ArchivableEntity.ts` |
| `GetEODAuditReportUseCase.execute()` | ✅ | `apps/api/src/__tests__/GetEODAuditReportUseCase.test.ts` |
| `GetRestaurantDashboardUseCase.execute()` | ❌ | `apps/api/src/core/use-cases/GetRestaurantDashboardUseCase.ts` |
| `GetPlatformDashboardUseCase.execute()` | ❌ | `apps/api/src/core/use-cases/GetPlatformDashboardUseCase.ts` |
| `AppUseCases.placeOrder()` | ❌ | `apps/api/src/core/use-cases/AppUseCases.ts` |
| `AppUseCases.getBill()` | ❌ | `apps/api/src/core/use-cases/AppUseCases.ts` |
| `AppUseCases.payBill()` | ❌ | `apps/api/src/core/use-cases/AppUseCases.ts` |
| `AppUseCases.getTableDetails()` | ❌ | `apps/api/src/core/use-cases/AppUseCases.ts` |
| `AppUseCases.createMenuItem()` | ❌ | `apps/api/src/core/use-cases/AppUseCases.ts` |
| `AppUseCases.deleteMenuItem()` | ❌ | `apps/api/src/core/use-cases/AppUseCases.ts` |
| `CsvExportAdapter.generateEodCsv()` | ❌ | `apps/api/src/adapters/secondary/csv/CsvExportAdapter.ts` |

---

## Integration Testable — HTTP Routes

| Route | Tested | Source |
|-------|--------|--------|
| `GET /health` | ✅ | `apps/api/tests/integration/health.test.ts` |
| `POST /api/auth/callback/credentials` | ✅ partial (415 only) | `apps/api/src/__tests__/authRoute.test.ts` |
| `GET /table/:qrCode` | ❌ | `apps/api/src/index.ts` |
| `POST /table/:qrCode/order` | ❌ | `apps/api/src/index.ts` |
| `GET /table/:qrCode/bill` | ❌ | `apps/api/src/index.ts` |
| `POST /table/:qrCode/pay` | ❌ | `apps/api/src/index.ts` |
| `GET /kitchen/orders` | ❌ | `apps/api/src/index.ts` |
| `PATCH /kitchen/orders/:orderId` | ❌ | `apps/api/src/index.ts` |
| `GET /admin/restaurants` | ❌ | `apps/api/src/index.ts` |
| `POST /admin/restaurants` | ❌ | `apps/api/src/index.ts` |
| `GET /restaurant/current` | ❌ | `apps/api/src/index.ts` |
| `PATCH /restaurant/:id/settings` | ❌ | `apps/api/src/index.ts` |
| `GET /api/v1/restaurants/:id/metrics/daily` | ❌ | `apps/api/src/index.ts` |
| `GET /api/v1/restaurants/:id/audit/eod` | ❌ | `apps/api/src/index.ts` |
| `GET /api/v1/restaurants/:id/audit/eod/export` | ❌ | `apps/api/src/index.ts` |
| `GET /api/v1/platform/metrics` | ❌ | `apps/api/src/index.ts` |

---

## Priority Queue

| Priority | Area | Risk |
|----------|------|------|
| 1 | Order state machine (all transitions + guards) | HIGH |
| 2 | `TableSession.closeSession()` payment validation | HIGH |
| 3 | `AppUseCases.getBill()` — price snapshot bug | CRITICAL |
| 4 | `AppUseCases.placeOrder()` + `payBill()` | HIGH |
| 5 | Integration: POST/GET /table/:qrCode/* | HIGH |
| 6 | Integration: PATCH /kitchen/orders/:orderId | HIGH |
| 7 | `GetRestaurantDashboardUseCase`, `GetPlatformDashboardUseCase` | MEDIUM |
| 8 | `CsvExportAdapter.generateEodCsv()` | MEDIUM |
| 9 | `ArchivableEntity` lifecycle | LOW |

> [!TIP] Add tests in the order above. The CRITICAL `getBill()` price-snapshot bug is undetected precisely because it has no test.
