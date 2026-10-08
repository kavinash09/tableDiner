# 05 — Use Case Catalog

> **Sources**:  
> - `apps/api/src/AppUseCases.ts` — monolithic use-case class (MVP)  
> - `apps/api/src/usecases/GetRestaurantDashboardUseCase.ts`  
> - `apps/api/src/usecases/GetPlatformDashboardUseCase.ts`  
> - `apps/api/src/usecases/GetEODAuditReportUseCase.ts`

⚠️ = known bug or architectural defect.

---

## AppUseCases Methods

| Name | Class | Input | Output | Side Effects | Known Issues |
|---|---|---|---|---|---|
| `getTableDetails` | `AppUseCases` | `qrCode: string` | Table record + active Session + MenuCategories with items | None | — |
| `placeOrder` | `AppUseCases` | `qrCode: string`, `items: { menuItemId, quantity }[]` | Created `Order` with `OrderItem`s | Creates `Session` (OPEN) if none exists; creates `Order`; creates `OrderItem`s with snapshotted `unitPrice` / `lineTotal` | — |
| `getBill` | `AppUseCases` | `qrCode: string` | Bill total + line items | None | ⚠️ Reads `MenuItem.price` (live) instead of `OrderItem.unitPrice` (snapshot). Bill total can diverge from actual charged amounts if prices changed mid-session. |
| `payBill` | `AppUseCases` | `qrCode: string`, `amount: number` | Payment confirmation | Delegates to internal `processCheckout`; creates `Payment` record; closes `Session` (status → CLOSED) | — |
| `getKitchenOrders` | `AppUseCases` | *(tenant from session)* | List of active `Order`s with items and table info | None | — |
| `updateOrderStatus` | `AppUseCases` | `orderId: string`, `status: OrderStatus` | Updated `Order` | Mutates `Order.status` | No guard against invalid state transitions (e.g. SERVED → RECEIVED) |
| `getPlatformTenants` | `AppUseCases` | *(none)* | List of all `Tenant`s with `Restaurant`s | None | No pagination |
| `createPlatformTenant` | `AppUseCases` | `tenantName: string`, `restaurantName: string`, `tablesCount: number` | Created `Tenant` + `Restaurant` + `Table`s | Creates Tenant, Restaurant, and N Table records in a transaction | — |
| `getCurrentRestaurant` | `AppUseCases` | *(tenant from session)* | Single `Restaurant` | None | ⚠️ Returns `findFirst` — always returns the first restaurant. Multi-restaurant tenants are silently unsupported. |
| `updateRestaurantSettings` | `AppUseCases` | `id: string`, `theme: string`, `qrTemplate: string` | Updated `Restaurant` | Mutates `Restaurant.theme` and `Restaurant.qrTemplate` | — |
| `updateRestaurantBanner` | `AppUseCases` | `id: string`, `bannerUrl: string` | Updated `Restaurant` | Mutates `Restaurant.bannerUrl` | — |
| `updateMenuItemImage` | `AppUseCases` | `id: string`, `imageUrl: string` | Updated `MenuItem` | Mutates `MenuItem.imageUrl` | — |
| `createMenuCategory` | `AppUseCases` | `restaurantId: string`, `name: string` | Created `MenuCategory` | Inserts `MenuCategory` | — |
| `deleteMenuCategory` | `AppUseCases` | `categoryId: string` | Deleted count | Hard-deletes `MenuCategory` record | ⚠️ Hard delete. No check for associated `MenuItem`s. Deleting a category with items may leave orphaned items or violate FK constraints. |
| `createMenuItem` | `AppUseCases` | `restaurantId: string`, `data: any` | Created `MenuItem` | Inserts `MenuItem` | ⚠️ Input typed as `any` — no compile-time safety beyond Zod route validation |
| `updateMenuItem` | `AppUseCases` | `id: string`, `data: any` | Updated `MenuItem` | Mutates `MenuItem` fields | ⚠️ Input typed as `any`; price update affects live price — does not recompute existing `OrderItem` snapshots |
| `deleteMenuItem` | `AppUseCases` | `id: string` | Deleted count | Hard-deletes `MenuItem` record | ⚠️ Hard delete. Existing `OrderItem`s reference this `menuItemId`; deletion may break FK integrity and historical order reads. |

---

## Separate Use Case Classes

| Name | Class | Input | Output | Side Effects | Known Issues |
|---|---|---|---|---|---|
| Daily restaurant metrics | `GetRestaurantDashboardUseCase` | `restaurantId: string`, `businessDate: string (YYYY-MM-DD)` | Aggregated metrics: revenue, order counts, covers, avg ticket — scoped to `businessDate` | None | — |
| Platform-wide metrics | `GetPlatformDashboardUseCase` | `reportDate: string (YYYY-MM-DD)` | Cross-tenant aggregated metrics for the platform on the given date | None | — |
| EOD audit report | `GetEODAuditReportUseCase` | `restaurantId: string`, `businessDate: string (YYYY-MM-DD)` | Full end-of-day audit report: sessions, orders, payments, revenue reconciliation | None (read-only); export variant may stream a file | — |

---

## Known Issues Summary

| # | Use Case | Issue |
|---|---|---|
| 1 | `getBill` | ⚠️ Uses `MenuItem.price` (live) not `OrderItem.unitPrice` (snapshot) — bill can diverge from actual order totals |
| 2 | `getCurrentRestaurant` | ⚠️ Uses `findFirst` — silently ignores all but the first restaurant for multi-restaurant tenants |
| 3 | `deleteMenuCategory` | ⚠️ Hard delete — no guard for child `MenuItem`s; may leave orphans or violate FK constraints |
| 4 | `deleteMenuItem` | ⚠️ Hard delete — existing `OrderItem`s retain `menuItemId` FK; breaks historical reads and may violate constraints |
| 5 | `updateOrderStatus` | ⚠️ No state machine enforcement — any status can be set to any other status |
| 6 | `createMenuItem` / `updateMenuItem` | ⚠️ Internal `data` param typed as `any` — relies entirely on Zod validation at the route layer |
