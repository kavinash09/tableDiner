# Entity Analytics Coverage

**Audit Date**: 2026-10-09  
**Auditor**: Principal Analytics Architect  
**Scope**: In-depth inspection of all 9 core business entities against analytics capabilities.

---

## 1. Overview Matrix

| Entity | Analytics Implemented? | Production Metrics Calculated | Granularity / Grouping | Aggregation Engine | Historical Tracking in Code |
|---|---|---|---|---|---|
| **Tenant** | **Yes** | 8 metrics | System-wide | Prisma `groupBy`, `_sum`, `count` | Status only; AuditLog unpopulated |
| **Restaurant** | **Yes** | 18 metrics | Restaurant × Business Day | Prisma `aggregate`, in-memory Node.js | Single business day snapshot |
| **Table** | **Partial** | 1 metric (as denominator) | Restaurant total count | `table.count()` only | Soft deletes; no time-series |
| **Session** | **Yes** | 14 metrics | Session, Date, Restaurant | Prisma `_sum`, `_count`, in-memory diff | `createdAt`; `closedAt` runtime gap |
| **Order** | **Yes** | 8 metrics | Order status, Date | Prisma `groupBy`, in-memory diff | `createdAt`; SLA timestamps unpopulated |
| **OrderItem** | ❌ **No** | 0 metrics | None | None | Price snapshot; zero analytics queries |
| **MenuItem** | ❌ **No** | 0 metrics | None | None | Spec stub exists; zero queries |
| **Category** | ❌ **No** | 0 metrics | None | None | Zero queries |
| **Payment** | **Partial** | 1 metric (deduped methods) | Per session string list | In-memory `Set` | `createdAt` only |

---

## 2. Detailed Entity Breakdown

### 2.1 Tenant
- **What analytics currently exist?**
  Platform Admin Super-Dashboard (`GET /api/v1/platform/metrics`) queries Tenant onboarding funnel and Tenant subscriptions.
- **What metrics are calculated?**
  - Funnel stage counts: `leadCount`, `trialCount`, `activeCount`, `suspendedCount`, `decommissionedCount`
  - SaaS metrics: `mrr` (sum of active subscriptions), `arr` (`mrr * 12`), `churnRate` (`canceled / (active + canceled)`).
- **What dimensions are available?**
  `onboardingStatus`, `isActive`. (Missing: geography, creation date cohort, tier, currency).
- **What aggregations are supported?**
  `groupBy({ by: ['onboardingStatus'] })`, `subscription.aggregate({ _sum: { mrr } })`, `count()`.
- **What historical tracking exists?**
  `createdAt`, `updatedAt`, `deletedAt`. Note: `TenantAuditLog` table exists in Prisma schema but is **never written to or queried anywhere in application code**.

---

### 2.2 Restaurant
- **What analytics currently exist?**
  Full daily restaurant operations dashboard (`GET /api/v1/restaurants/:id/metrics/daily`) and End-of-Day audit report (`GET /api/v1/restaurants/:id/audit/eod`).
- **What metrics are calculated?**
  Gross Revenue, Net Revenue, Total Discounts, Total Tips, Refunded Revenue, Avg Ticket Size, Total Orders, Completed Orders, Cancelled Orders, Cancellation Rate, Covers Served, Avg Party Size, Spend Per Head, Occupancy %, Avg Table Turn Time, Avg Kitchen Prep Time, Avg Service Time, Avg Order Fulfillment.
- **What dimensions are available?**
  `restaurantId`, `businessDate`.
- **What aggregations are supported?**
  Scoped exclusively to one `restaurantId` and one `businessDate`. No multi-restaurant grouping, no weekly/monthly rollups, no comparison windows.
- **What historical tracking exists?**
  `businessDayCutoffHour` allows logical historical day grouping. `deletedAt` for soft deletes.

---

### 2.3 Table
- **What analytics currently exist?**
  Table entity has virtually **zero native analytics**. It is only queried as an active headcount denominator via `prisma.table.count({ where: { restaurantId, isActive: true } })` to calculate theoretical available capacity minutes (`tableCount * 720`). In EOD audit, table name is resolved as a string relation on sessions.
- **What metrics are calculated?**
  **Zero direct table metrics**. No revenue by table, no table occupancy percentage, no table turn frequency, no table idle time.
- **What dimensions are available?**
  `id`, `name`, `qrCode`, `restaurantId`, `isActive`.
- **What aggregations are supported?**
  Total row count only.
- **What historical tracking exists?**
  `createdAt`, `updatedAt`, `deletedAt`. No spatial/floor plan data, no table merging history.

---

### 2.4 Session
- **What analytics currently exist?**
  Session is the primary unit of accounting in TableDiner. Powers all financial totals, customer cover counts, and table occupancy minutes.
- **What metrics are calculated?**
  Sum of gross revenue, net revenue, tips, discounts, refunds; average ticket size; covers served; party size; spend per cover; table turn time in minutes; platform total GMV and session volume.
- **What dimensions are available?**
  `tenantId`, `restaurantId`, `tableId`, `businessDate`, `status`, `createdAt`, `closedAt`.
- **What aggregations are supported?**
  Prisma `_sum` over financial float fields; Prisma `_count.id`; in-memory elapsed minute calculation (`closedAt - createdAt`).
- **What historical tracking exists?**
  `createdAt`, `closedAt`. Schema defines `reopenedAt`, `reopenedBy`, `reopenReason`, but these are **dead fields** with no use cases or mutations.
- **Implementation Flaws**:
  `closedAt` and financial rollups (`subtotal`, `taxAmount`, `totalAmount`) are not updated on the `Session` row when payments occur, leaving values at schema defaults (`0` and `null`).

---

### 2.5 Order
- **What analytics currently exist?**
  Order volume counts, status breakdown, kitchen SLA fulfillment metrics.
- **What metrics are calculated?**
  Total orders, completed orders, cancelled orders, cancellation rate, kitchen prep time, service time, full fulfillment time.
- **What dimensions are available?**
  `status`, `businessDate`, `tenantId`, `sessionId`.
- **What aggregations are supported?**
  `groupBy` by `status`, `_count.id`, in-memory timestamp differences.
- **What historical tracking exists?**
  `createdAt`, `updatedAt`. Timestamps `acceptedAt`, `readyAt`, `servedAt`, `cancelledAt` exist in schema but are **not populated by order status mutations**.

---

### 2.6 OrderItem
- **What analytics currently exist?**
  ❌ **Zero analytics exist for OrderItem**.
- **What metrics are calculated?**
  **None**. OrderItem is completely ignored by both analytics repositories.
- **What dimensions are available?**
  `menuItemId`, `orderId`, `tenantId`, `unitPrice`, `lineTotal`, `quantity`, `isVoided`.
- **What aggregations are supported?**
  None.
- **What historical tracking exists?**
  Has snapshotted `unitPrice` and `lineTotal`. Has `isVoided`, `voidReason`, `voidedAt`, `voidedBy` columns (unpopulated).

---

### 2.7 MenuItem
- **What analytics currently exist?**
  ❌ **Zero analytics exist for MenuItem**.
- **What metrics are calculated?**
  **None**. Contracts exist in `@tablediner/shared-types` (`MenuItemInsight`, `RestaurantInsightsResponse`: `topSellers`, `bottomSellers`, `quantitySold`, `revenueGenerated`), but **no use case, repository method, or endpoint implements them**.
- **What dimensions are available?**
  `id`, `name`, `price`, `categoryId`, `restaurantId`, `isAvailable`.
- **What aggregations are supported?**
  None.
- **What historical tracking exists?**
  `createdAt`, `updatedAt`, `deletedAt`. Menu item price changes do not maintain historical price tier logs (only snapshotted forward on OrderItem).

---

### 2.8 MenuCategory
- **What analytics currently exist?**
  ❌ **Zero analytics exist for MenuCategory**.
- **What metrics are calculated?**
  **None**. No category revenue, no category sales volume, no category order share.
- **What dimensions are available?**
  `id`, `name`, `restaurantId`, `isActive`.
- **What aggregations are supported?**
  None.
- **What historical tracking exists?**
  `createdAt`, `updatedAt`, `deletedAt`.

---

### 2.9 Payment
- **What analytics currently exist?**
  Only used in `getEodSessions` to extract unique payment method names per closed session.
- **What metrics are calculated?**
  **Zero standalone payment metrics**. No payment volume by method (Cash vs Card vs UPI), no settlement reconciliation, no gateway success/failure rate.
- **What dimensions are available?**
  `method`, `status`, `amount`, `tenantId`, `sessionId`.
- **What aggregations are supported?**
  In-memory `Array.from(new Set(...))` deduplication.
- **What historical tracking exists?**
  `createdAt`, `updatedAt`. `providerId` column is currently unpopulated (mock payments).

