# Metric Catalog

**Audit Date**: 2026-10-09  
**Auditor**: Principal Analytics Architect  
**Scope**: All analytical calculations found in TableDiner codebase.

---

## 1. Restaurant Operational & Financial Metrics

### 1.1 Gross Revenue
- **Metric Name**: Gross Revenue (`grossRevenue`)
- **Business Meaning**: Total top-line monetary volume billed to diners across closed sessions on a business day, inclusive of taxes and tips.
- **Formula**: `SUM(Session.totalAmount)` where `Session.status != 'OPEN'`
- **Source Tables**: `Session`
- **Source Fields**: `totalAmount`, `status`, `businessDate`, `restaurantId`
- **Aggregation Method**: Prisma `_sum` aggregation
- **Date Logic**: Filtered by `Session.businessDate = targetDate`
- **Current API**: `GET /api/v1/restaurants/:id/metrics/daily` → `financials.grossRevenue`
- **Current UI Usage**: `apps/restaurant-admin/src/components/Dashboard.tsx` (`MetricCard title="Gross Revenue"`)

---

### 1.2 Net Revenue
- **Metric Name**: Net Revenue (`netRevenue`)
- **Business Meaning**: Actual operational intake retained by the restaurant, excluding sales taxes collected for the government and tips reserved for staff.
- **Formula**: `(SUM(Session.totalAmount) - SUM(Session.taxAmount) - SUM(Session.tipAmount))`
- **Source Tables**: `Session`
- **Source Fields**: `totalAmount`, `taxAmount`, `tipAmount`
- **Aggregation Method**: In-memory subtraction of Prisma `_sum` results
- **Date Logic**: Filtered by `Session.businessDate = targetDate`
- **Current API**: `GET /api/v1/restaurants/:id/metrics/daily` → `financials.netRevenue`
- **Current UI Usage**: `apps/restaurant-admin/src/components/Dashboard.tsx` (`MetricCard title="Net Revenue"`)

---

### 1.3 Total Discounts
- **Metric Name**: Total Discounts (`totalDiscounts`)
- **Business Meaning**: Aggregate value of promotional discounts deducted from diners.
- **Formula**: `SUM(Session.discountAmount)`
- **Source Tables**: `Session`
- **Source Fields**: `discountAmount`
- **Aggregation Method**: Prisma `_sum` aggregation
- **Date Logic**: Filtered by `Session.businessDate = targetDate`
- **Current API**: `GET /api/v1/restaurants/:id/metrics/daily` → `financials.totalDiscounts`
- **Current UI Usage**: Present in API contract; consumed by EOD CSV export.

---

### 1.4 Total Tips
- **Metric Name**: Total Tips (`totalTips`)
- **Business Meaning**: Aggregate gratuity paid by guests to front-of-house staff.
- **Formula**: `SUM(Session.tipAmount)`
- **Source Tables**: `Session`
- **Source Fields**: `tipAmount`
- **Aggregation Method**: Prisma `_sum` aggregation
- **Date Logic**: Filtered by `Session.businessDate = targetDate`
- **Current API**: `GET /api/v1/restaurants/:id/metrics/daily` → `financials.totalTips`
- **Current UI Usage**: `apps/restaurant-admin/src/components/Dashboard.tsx` (`MetricCard title="Tips Collected"`)

---

### 1.5 Refunded Revenue
- **Metric Name**: Refunded Revenue (`refundedRevenue`)
- **Business Meaning**: Total money returned to guests post-settlement.
- **Formula**: `SUM(Session.refundedAmount)`
- **Source Tables**: `Session`
- **Source Fields**: `refundedAmount`
- **Aggregation Method**: Prisma `_sum` aggregation
- **Date Logic**: Filtered by `Session.businessDate = targetDate`
- **Current API**: `GET /api/v1/restaurants/:id/metrics/daily` → `financials.refundedRevenue`
- **Current UI Usage**: Present in API contract; rendered in EOD CSV summary.

---

### 1.6 Average Ticket Size
- **Metric Name**: Average Ticket Size (`avgTicketSize`)
- **Business Meaning**: Average net spend per dining party/session.
- **Formula**: `netRevenue / closedSessionsCount` (or `0` if `closedSessionsCount === 0`)
- **Source Tables**: `Session`
- **Source Fields**: `totalAmount`, `taxAmount`, `tipAmount`, `id` count
- **Aggregation Method**: In-memory division of `netRevenue` by `_count.id`
- **Date Logic**: Filtered by `Session.businessDate = targetDate`
- **Current API**: `GET /api/v1/restaurants/:id/metrics/daily` → `financials.avgTicketSize`
- **Current UI Usage**: `apps/restaurant-admin/src/components/Dashboard.tsx` (`MetricCard title="Avg Ticket Size"`)

---

### 1.7 Total Orders
- **Metric Name**: Total Orders (`totalOrders`)
- **Business Meaning**: Total kitchen tickets submitted during the business day regardless of outcome.
- **Formula**: `COUNT(Order.id)` where `Order.session.restaurantId = restaurantId` and `Order.businessDate = targetDate`
- **Source Tables**: `Order`, `Session` (via relation filter)
- **Source Fields**: `Order.id`, `Order.status`, `Order.businessDate`
- **Aggregation Method**: Prisma `groupBy({ by: ['status'] })` summed in memory
- **Date Logic**: Filtered by `Order.businessDate = targetDate`
- **Current API**: `GET /api/v1/restaurants/:id/metrics/daily` → `orders.totalOrders`
- **Current UI Usage**: `apps/restaurant-admin/src/components/Dashboard.tsx` (`MetricCard title="Total Orders"`)

---

### 1.8 Completed Orders
- **Metric Name**: Completed Orders (`completedOrders`)
- **Business Meaning**: Number of kitchen orders successfully prepared and served to diners.
- **Formula**: `COUNT(Order.id)` where `status = 'SERVED'`
- **Source Tables**: `Order`, `Session`
- **Source Fields**: `Order.status`, `Order.businessDate`
- **Aggregation Method**: In-memory count extracted from `groupBy` status bucket
- **Date Logic**: Filtered by `Order.businessDate = targetDate`
- **Current API**: `GET /api/v1/restaurants/:id/metrics/daily` → `orders.completedOrders`
- **Current UI Usage**: Present in API contract; available for analytics extensions.

---

### 1.9 Cancelled Orders
- **Metric Name**: Cancelled Orders (`cancelledOrders`)
- **Business Meaning**: Number of kitchen orders voided or rejected prior to service.
- **Formula**: `COUNT(Order.id)` where `status IN ('CANCELLED', 'REJECTED')`
- **Source Tables**: `Order`, `Session`
- **Source Fields**: `Order.status`, `Order.businessDate`
- **Aggregation Method**: In-memory summation of 'CANCELLED' and 'REJECTED' count buckets
- **Date Logic**: Filtered by `Order.businessDate = targetDate`
- **Current API**: `GET /api/v1/restaurants/:id/metrics/daily` → `orders.cancelledOrders`
- **Current UI Usage**: Present in API contract.

---

### 1.10 Cancellation Rate
- **Metric Name**: Cancellation Rate (`cancellationRate`)
- **Business Meaning**: Proportion of submitted orders that failed to reach the diner.
- **Formula**: `cancelledOrders / totalOrders` (decimal 0.0 - 1.0; 0 if `totalOrders === 0`)
- **Source Tables**: `Order`, `Session`
- **Source Fields**: `Order.status`
- **Aggregation Method**: In-memory arithmetic
- **Date Logic**: Filtered by `Order.businessDate = targetDate`
- **Current API**: `GET /api/v1/restaurants/:id/metrics/daily` → `orders.cancellationRate`
- **Current UI Usage**: `apps/restaurant-admin/src/components/Dashboard.tsx` (`MetricCard title="Cancellation Rate"`, highlighted red if > 10%)

---

### 1.11 Covers Served (Pax)
- **Metric Name**: Covers Served (`coversServed`)
- **Business Meaning**: Total individual guests dined at the restaurant during closed sessions.
- **Formula**: `SUM(Session.guestCount)` where `status != 'OPEN'`
- **Source Tables**: `Session`
- **Source Fields**: `guestCount`, `status`, `businessDate`
- **Aggregation Method**: Prisma `_sum.guestCount`
- **Date Logic**: Filtered by `Session.businessDate = targetDate`
- **Current API**: `GET /api/v1/restaurants/:id/metrics/daily` → `utilization.coversServed`
- **Current UI Usage**: `apps/restaurant-admin/src/components/Dashboard.tsx` (`MetricCard title="Covers Served (Pax)"`)

---

### 1.12 Average Party Size
- **Metric Name**: Average Party Size (`avgPartySize`)
- **Business Meaning**: Average headcount per table session.
- **Formula**: `coversServed / sessionCount`
- **Source Tables**: `Session`
- **Source Fields**: `guestCount`, `id`
- **Aggregation Method**: In-memory division of `_sum.guestCount` by `_count.id`
- **Date Logic**: Filtered by `Session.businessDate = targetDate`
- **Current API**: `GET /api/v1/restaurants/:id/metrics/daily` → `utilization.avgPartySize`
- **Current UI Usage**: Present in API contract.

---

### 1.13 Revenue Per Cover (Spend Per Head)
- **Metric Name**: Revenue Per Cover (`revenuePerCover`)
- **Business Meaning**: Average revenue contribution per individual diner.
- **Formula**: `totalAmount / coversServed` (Note: Implementation uses `totalAmount` rather than `netRevenue`)
- **Source Tables**: `Session`
- **Source Fields**: `totalAmount`, `guestCount`
- **Aggregation Method**: In-memory division
- **Date Logic**: Filtered by `Session.businessDate = targetDate`
- **Current API**: `GET /api/v1/restaurants/:id/metrics/daily` → `utilization.revenuePerCover`
- **Current UI Usage**: `apps/restaurant-admin/src/components/Dashboard.tsx` (`MetricCard title="Spend Per Head"`)

---

### 1.14 Occupancy Percent
- **Metric Name**: Occupancy Percent (`occupancyPercent`)
- **Business Meaning**: Proportion of total table capacity-time occupied by dining parties during the operating window.
- **Formula**: `totalOccupiedMinutes / availableMinutes` where:
  - `totalOccupiedMinutes = SUM((closedAt - createdAt) in minutes)`
  - `availableMinutes = tableCount * operatingMinutes` (operatingMinutes hardcoded to 720)
- **Source Tables**: `Session`, `Table`
- **Source Fields**: `Session.createdAt`, `Session.closedAt`, `Table.id`
- **Aggregation Method**: In-memory iterative timestamp subtraction + `prisma.table.count`
- **Date Logic**: Filtered by `Session.businessDate = targetDate` and `Session.closedAt != null`
- **Current API**: `GET /api/v1/restaurants/:id/metrics/daily` → `utilization.occupancyPercent`
- **Current UI Usage**: Present in API contract.

---

### 1.15 Average Table Turn Time
- **Metric Name**: Average Table Turn Time (`avgTableTurnTimeMinutes`)
- **Business Meaning**: Mean duration (in minutes) a table is occupied from opening to settlement.
- **Formula**: `totalOccupiedMinutes / sessionCount`
- **Source Tables**: `Session`
- **Source Fields**: `Session.createdAt`, `Session.closedAt`, `Session.id`
- **Aggregation Method**: In-memory duration loop divided by session count
- **Date Logic**: Filtered by `Session.businessDate = targetDate` and `Session.closedAt != null`
- **Current API**: `GET /api/v1/restaurants/:id/metrics/daily` → `utilization.avgTableTurnTimeMinutes`
- **Current UI Usage**: `apps/restaurant-admin/src/components/Dashboard.tsx` (`MetricCard title="Avg Table Turn Time"`)

---

### 1.16 Kitchen Prep Time SLA
- **Metric Name**: Average Kitchen Prep Time (`avgKitchenPrepTimeMinutes`)
- **Business Meaning**: Duration between chef accepting an order and ticket marked ready in kitchen.
- **Formula**: `SUM((readyAt - acceptedAt) in minutes) / count`
- **Source Tables**: `Order`
- **Source Fields**: `acceptedAt`, `readyAt`, `servedAt` (requires all 3 non-null and `status = 'SERVED'`)
- **Aggregation Method**: In-memory iterative timestamp difference
- **Date Logic**: Filtered by `Order.businessDate = targetDate`
- **Current API**: `GET /api/v1/restaurants/:id/metrics/daily` → `slas.avgKitchenPrepTimeMinutes`
- **Current UI Usage**: `apps/restaurant-admin/src/components/Dashboard.tsx` (`MetricCard title="Avg Kitchen Prep Time"`)

---

### 1.17 Service Time SLA
- **Metric Name**: Average Service Time (`avgServiceTimeMinutes`)
- **Business Meaning**: Duration between kitchen marking order ready and runner serving it to table.
- **Formula**: `SUM((servedAt - readyAt) in minutes) / count`
- **Source Tables**: `Order`
- **Source Fields**: `readyAt`, `servedAt`
- **Aggregation Method**: In-memory iterative timestamp difference
- **Date Logic**: Filtered by `Order.businessDate = targetDate`
- **Current API**: `GET /api/v1/restaurants/:id/metrics/daily` → `slas.avgServiceTimeMinutes`
- **Current UI Usage**: Present in API contract.

---

### 1.18 Full Order Fulfillment SLA
- **Metric Name**: Average Order Fulfillment (`avgFulfillmentTimeMinutes`)
- **Business Meaning**: Total cycle time from customer submitting order on phone to food landing on table.
- **Formula**: `SUM((servedAt - createdAt) in minutes) / count`
- **Source Tables**: `Order`
- **Source Fields**: `createdAt`, `servedAt`
- **Aggregation Method**: In-memory iterative timestamp difference
- **Date Logic**: Filtered by `Order.businessDate = targetDate`
- **Current API**: `GET /api/v1/restaurants/:id/metrics/daily` → `slas.avgFulfillmentTimeMinutes`
- **Current UI Usage**: `apps/restaurant-admin/src/components/Dashboard.tsx` (`MetricCard title="Avg Order Fulfillment"`)

---

## 2. Platform Multi-Tenant Super-Admin Metrics

### 2.1 Monthly Recurring Revenue (MRR)
- **Metric Name**: Monthly Recurring Revenue (`mrr`)
- **Business Meaning**: Normalized monthly recurring subscription fees contracted across all active tenants.
- **Formula**: `SUM(Subscription.mrr)` where `status = 'ACTIVE'`
- **Source Tables**: `Subscription`
- **Source Fields**: `mrr`, `status`
- **Aggregation Method**: Prisma `_sum.mrr`
- **Date Logic**: Snapshot across active subscriptions (no date filter applied)
- **Current API**: `GET /api/v1/platform/metrics` → `financials.mrr`
- **Current UI Usage**: `apps/platform-admin/src/components/Dashboard.tsx` (`MetricCard title="Monthly Recurring Revenue"`)

---

### 2.2 Annual Run Rate (ARR)
- **Metric Name**: Annual Run Rate (`arr`)
- **Business Meaning**: Annualized projection of active MRR.
- **Formula**: `mrr * 12`
- **Source Tables**: Computed from MRR
- **Source Fields**: None
- **Aggregation Method**: In-memory multiplication
- **Date Logic**: Current snapshot
- **Current API**: `GET /api/v1/platform/metrics` → `financials.arr`
- **Current UI Usage**: `apps/platform-admin/src/components/Dashboard.tsx` (`MetricCard title="Annual Run Rate (ARR)"`)

---

### 2.3 New MRR
- **Metric Name**: New MRR (`newMrr`)
- **Business Meaning**: Incremental MRR acquired during the reporting period.
- **Formula**: Hardcoded to `0` in `PrismaPlatformAnalyticsRepository.ts` line 27.
- **Source Tables**: None
- **Source Fields**: None
- **Aggregation Method**: Hardcoded constant
- **Date Logic**: None
- **Current API**: `GET /api/v1/platform/metrics` → `financials.newMrr`
- **Current UI Usage**: `apps/platform-admin/src/components/Dashboard.tsx` (`MetricCard title="New MRR"`)

---

### 2.4 Churned MRR
- **Metric Name**: Churned MRR (`churnedMrr`)
- **Business Meaning**: Lost MRR from canceled subscriptions.
- **Formula**: Hardcoded to `0` in `PrismaPlatformAnalyticsRepository.ts` line 28.
- **Source Tables**: None
- **Source Fields**: None
- **Aggregation Method**: Hardcoded constant
- **Date Logic**: None
- **Current API**: `GET /api/v1/platform/metrics` → `financials.churnedMrr`
- **Current UI Usage**: Present in API contract.

---

### 2.5 Subscription Churn Rate
- **Metric Name**: Churn Rate (`churnRate`)
- **Business Meaning**: Percentage of all customer subscriptions that have canceled.
- **Formula**: `canceledCount / (activeCount + canceledCount)`
- **Source Tables**: `Subscription`
- **Source Fields**: `status`
- **Aggregation Method**: Prisma `count` queries + in-memory division
- **Date Logic**: Lifetime snapshot across all historical subscriptions
- **Current API**: `GET /api/v1/platform/metrics` → `financials.churnRate`
- **Current UI Usage**: `apps/platform-admin/src/components/Dashboard.tsx` (`MetricCard title="Churn Rate"`, highlighted red if > 5%)

---

### 2.6 Total GMV Processed
- **Metric Name**: Total GMV Processed (`totalGmv`)
- **Business Meaning**: Gross Merchandise Volume processed across all restaurants on the platform on a given date.
- **Formula**: `SUM(Session.totalAmount)` where `Session.businessDate = reportDate` and `Session.status != 'OPEN'`
- **Source Tables**: `Session`
- **Source Fields**: `totalAmount`, `businessDate`, `status`
- **Aggregation Method**: Prisma `_sum.totalAmount`
- **Date Logic**: Filtered by `Session.businessDate = reportDate`
- **Current API**: `GET /api/v1/platform/metrics` → `gmv.totalGmv`
- **Current UI Usage**: `apps/platform-admin/src/components/Dashboard.tsx` (`MetricCard title="Total GMV Processed"`)

---

### 2.7 Global Orders Processed
- **Metric Name**: Global Orders Processed (`ordersProcessed`)
- **Business Meaning**: Total non-cancelled kitchen orders processed platform-wide on the date.
- **Formula**: `COUNT(Order.id)` where `businessDate = reportDate` and `status NOT IN ('CANCELLED', 'REJECTED')`
- **Source Tables**: `Order`
- **Source Fields**: `id`, `businessDate`, `status`
- **Aggregation Method**: Prisma `_count.id`
- **Date Logic**: Filtered by `Order.businessDate = reportDate`
- **Current API**: `GET /api/v1/platform/metrics` → `gmv.ordersProcessed`
- **Current UI Usage**: `apps/platform-admin/src/components/Dashboard.tsx` (`MetricCard title="Global Orders Processed"`)

---

### 2.8 Global Sessions Processed
- **Metric Name**: Global Sessions Processed (`sessionsProcessed`)
- **Business Meaning**: Total customer dining sessions completed platform-wide on the date.
- **Formula**: `COUNT(Session.id)` where `businessDate = reportDate` and `status != 'OPEN'`
- **Source Tables**: `Session`
- **Source Fields**: `id`, `businessDate`, `status`
- **Aggregation Method**: Prisma `_count.id`
- **Date Logic**: Filtered by `Session.businessDate = reportDate`
- **Current API**: `GET /api/v1/platform/metrics` → `gmv.sessionsProcessed`
- **Current UI Usage**: `apps/platform-admin/src/components/Dashboard.tsx` (`MetricCard title="Global Sessions Processed"`)

---

### 2.9 Platform Average Order Value (AOV)
- **Metric Name**: Average Order Value (`avgOrderValue`)
- **Business Meaning**: Cross-restaurant average ticket size per dining session.
- **Formula**: `totalGmv / sessionsProcessed` (Note: Uses sessions as denominator, not orders)
- **Source Tables**: `Session`
- **Source Fields**: `totalAmount`, `id`
- **Aggregation Method**: In-memory division
- **Date Logic**: Filtered by `Session.businessDate = reportDate`
- **Current API**: `GET /api/v1/platform/metrics` → `gmv.avgOrderValue`
- **Current UI Usage**: `apps/platform-admin/src/components/Dashboard.tsx` (`MetricCard title="Average Order Value"`)

---

### 2.10 Tenant Funnel Counts
- **Metric Names**: `leadCount`, `trialCount`, `activeCount`, `suspendedCount`, `decommissionedCount`
- **Business Meaning**: Distribution of SaaS tenants across lifecycle onboarding stages.
- **Formula**: `COUNT(Tenant.id)` grouped by `onboardingStatus`
- **Source Tables**: `Tenant`
- **Source Fields**: `onboardingStatus`
- **Aggregation Method**: Prisma `groupBy({ by: ['onboardingStatus'], _count: { id: true } })`
- **Date Logic**: Current system snapshot (no date filtering)
- **Current API**: `GET /api/v1/platform/metrics` → `funnel.*`
- **Current UI Usage**: `apps/platform-admin/src/components/Dashboard.tsx` (5-card Tenant Lifecycle Funnel row)

