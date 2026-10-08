# Self-Serve Readiness Report

**Audit Date**: 2026-10-09  
**Auditor**: Principal Analytics Architect  
**Scope**: Readiness evaluation of TableDiner for self-serve BI, ad-hoc reporting, and custom dashboarding.

---

## 1. Overall Readiness Score

- **Self-Service Readiness Score**: **14% (2 / 14 Supported)**
- **Verdict**: **NOT SELF-SERVE READY**.
- **Architecture State**: The current system is a rigid, hardcoded operational reporting prototype. It cannot support end-user self-service querying without significant semantic layer and API re-architecture.

---

## 2. Capability Evaluation Matrix

| Capability | Status | Root Cause & Code Evidence |
|---|---|---|
| **Revenue by Table** | **Partially Supported** | Data exists in `Session.tableId` + `Session.totalAmount`. However, no repository query, API endpoint, or index on `tableId` exists. |
| **Revenue by Menu Item** | **Partially Supported** | Data exists in `OrderItem.menuItemId` + `OrderItem.lineTotal`. Contracts exist in `shared-types` (`MenuItemInsight`), but no repository query or endpoint is built. |
| **Revenue by Category** | **Partially Supported** | Requires joining `OrderItem → MenuItem → MenuCategory`. DB schema can support it, but no query or API exists. |
| **Revenue by Hour** | **Partially Supported** | `Session.createdAt` exists. However, SQLite lacks native hour grouping and backend does not bucket timestamps. |
| **Revenue by Day** | **Supported** | ✅ Implemented via `GET /api/v1/restaurants/:id/metrics/daily?date=YYYY-MM-DD` querying `Session.businessDate`. |
| **Revenue by Week** | ❌ **Not Supported** | API only accepts a single `date` string. No range parameters (`startDate`, `endDate`), rolling 7-day windows, or weekly rollups. |
| **Occupancy by Table** | ❌ **Not Supported** | In-memory occupancy calculation in `PrismaRestaurantAnalyticsRepository.ts` lumps all table minutes into a single restaurant total. |
| **Order Funnel** | ❌ **Not Supported** | No event capture for QR scans, cart item additions, cart abandonment, or checkout drop-off. |
| **Popular Dishes** | **Partially Supported** | `OrderItem` has quantity and price snapshot. Contracts exist in `shared-types`. No use case or SQL/Prisma aggregation written. |
| **Least Popular Dishes** | **Partially Supported** | Same as Popular Dishes. Requires `OrderItem` group-by with zero-sales outer join on `MenuItem`. |
| **Table Heatmaps** | ❌ **Not Supported** | No floor plan coordinates, no spatial schema, and no table turnover frequency calculations. |
| **Time-Based Trends** | ❌ **Not Supported** | Cannot execute multi-period queries, trailing moving averages (7-day MA), or WoW/MoM comparisons. |
| **Custom Dashboards** | ❌ **Not Supported** | React UI is static (`apps/restaurant-admin/src/components/Dashboard.tsx`). No widget catalog, JSON dashboard config, or customizable layout. |
| **Ad Hoc Queries** | ❌ **Not Supported** | No semantic layer (e.g., Cube.js), no GraphQL, no dynamic SQL builder. Only 3 fixed REST endpoints exist. |

---

## 3. Detailed Capability Explanations

### 3.1 Revenue by Table (Partially Supported)
- **Why**: The relation `Table → Session` exists in `schema.prisma`. Every session records `tableId`.
- **Why Not Supported Today**: To produce revenue by table, an engineer would need to write a new Prisma query grouping `Session` by `tableId`. There is no index on `Session.tableId`, so table scans would occur on high session counts.

### 3.2 Revenue by Menu Item (Partially Supported)
- **Why**: `OrderItem` stores `menuItemId`, `quantity`, `unitPrice`, and `lineTotal`.
- **Why Not Supported Today**: The endpoint was designed in `packages/shared-types/src/index.ts` lines 179–190 (`RestaurantInsightsResponse`), but neither `RestaurantAnalyticsRepository` nor `PrismaRestaurantAnalyticsRepository` ever implemented the query.

### 3.3 Revenue by Category (Partially Supported)
- **Why**: `MenuItem` belongs to `MenuCategory`.
- **Why Not Supported Today**: Calculating category revenue requires joining `OrderItem → MenuItem → MenuCategory` and grouping by `MenuCategory.name`. In SQLite via Prisma, multi-level relational grouping is not directly supported in a single `aggregate` call and requires raw SQL or in-memory map-reduce.

### 3.4 Revenue by Hour (Partially Supported)
- **Why**: `Session.createdAt` stores full UTC timestamp.
- **Why Not Supported Today**: TableDiner operates on logical business dates (`YYYY-MM-DD`). There is no hourly bucket field on `Session` (e.g. `hourOfDay: 14`), requiring JavaScript parsing of timestamps in memory.

### 3.5 Revenue by Day (Supported)
- **Why**: Fully functional. Users provide a date query parameter (`?date=2026-10-09`) to `GET /api/v1/restaurants/:id/metrics/daily`, which filters `Session.businessDate` and returns gross and net revenue.

### 3.6 Revenue by Week (Not Supported)
- **Why Not Supported Today**: The API contract strictly defines `businessDate: string` as an individual date. Neither the Fastify route nor the use-case accepts `startDate` and `endDate` or interval groupings.

### 3.7 Occupancy by Table (Not Supported)
- **Why Not Supported Today**: In `PrismaRestaurantAnalyticsRepository.getUtilizationMetrics`, the code counts all active tables globally and sums all session durations into a single variable `totalOccupiedMinutes`. It does not calculate metrics per `table.id`.

### 3.8 Order Funnel (Not Supported)
- **Why Not Supported Today**: The system only records when an order is created (`Order` row inserted). There are no data tables, analytics events, or tracking pixels capturing when a diner views the menu, adds an item to cart, or closes the tab without buying.

### 3.9 Popular / Least Popular Dishes (Partially Supported)
- **Why Not Supported Today**: Data exists in `OrderItem`, but no endpoint or repository method executes `groupBy({ by: ['menuItemId'], _sum: { quantity: true, lineTotal: true } })`.

### 3.10 Table Heatmaps (Not Supported)
- **Why Not Supported Today**: `Table` model only contains `id`, `name`, `qrCode`, and `restaurantId`. It has no layout metadata (X, Y coordinates, floor/zone assignments).

### 3.11 Time-Based Trends (Not Supported)
- **Why Not Supported Today**: The architecture only computes point-in-time single-day snapshots. Trendlines (e.g. 30-day revenue chart) are completely unsupported.

### 3.12 Custom Dashboards & Ad Hoc Queries (Not Supported)
- **Why Not Supported Today**: The application has no BI abstraction layer. The frontend UI hardcodes every metric card directly in JSX.

