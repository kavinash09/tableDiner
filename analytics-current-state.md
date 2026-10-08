# TableDiner Analytics Architecture: Current State Analysis

**Document**: `analytics-current-state.md`  
**Role**: Principal Systems Architect, Principal Analytics Architect  
**Status**: Comprehensive Baseline Assessment  
**Date**: 2026-10-09  

---

## 1. Executive Summary

TableDiner currently employs a **report-centric, synchronous OLTP-coupled analytics model**. All metrics displayed on restaurant dashboards, platform dashboards, and End-of-Day (EOD) audit exports are derived on-demand by querying live transactional database tables (`Session`, `Order`, `OrderItem`, `Payment`, `Table`, `Subscription`, `Tenant`).

While recent hardening sprints successfully resolved critical data integrity defects (persisting session closure timestamps `closedAt`, capturing order SLA timestamps `acceptedAt`/`readyAt`/`servedAt`, snapshotting financial values, and moving duration loops to SQL aggregations), the underlying paradigm remains fundamentally **monolithic, batch-tabular, and tightly coupled to the OLTP database**.

```
[ Current Report-Centric Model ]

      +-------------------------------------------------------------+
      |                   Live OLTP Database Tables                 |
      |   (Session, Order, OrderItem, Payment, Table, Tenant)       |
      +-------------------------------------------------------------+
                                     │
           Synchronous On-Demand     │ Raw SQL / Prisma Aggregations
           HTTP Request Triggered   │ (Runs during Dashboard page load)
                                     ▼
      +-------------------------------------------------------------+
      |       PrismaRestaurantAnalyticsRepository (Fastify API)    |
      +-------------------------------------------------------------+
                                     │
                                     ├──────────────────────────────┐
                                     ▼                              ▼
                      Restaurant Admin Dashboard           EOD Audit CSV Export
```

### The Core Architectural Dilemma
1. **Schema Fragility**: Every new business question (e.g., *"Which category drives the highest margin during dinner rush?"*, *"What is the drop-off rate between menu browsing and cart checkout?"*) requires schema modifications, new Prisma relations, and custom repository methods.
2. **Operational-Analytical Contention**: Heavy dashboard queries and aggregation scans compete directly for locks, memory, and I/O against diners placing orders and kitchen staff acknowledging tickets.
3. **Loss of Behavioral Context**: Ephemeral diner behaviors (menu item viewing, adding to cart, cart abandonment, modifier selections, table seating duration prior to first order) are permanently discarded because the OLTP database only stores the final persisted state.
4. **Historical Mutation Vulnerability**: If a menu item is renamed, recategorized, or soft-deleted, historical queries that join to catalog tables can misattribute or alter historical metrics retroactively.

---

## 2. Current Analytics Calculations & Metrics

The system currently produces 24 distinct operational and platform metrics categorized across five functional domains:

### 2.1 Financial Metrics (`getFinancialMetrics`)
Calculated synchronously via `PrismaRestaurantAnalyticsRepository.getFinancialMetrics` using `prisma.session.aggregate` on rows where `status != 'OPEN'` and `businessDate = ?`:
- **Gross Revenue**: `SUM(totalAmount)` — Total cash/digital tender received for closed dining sessions.
- **Net Revenue**: `SUM(totalAmount) - SUM(taxAmount) - SUM(tipAmount)` — True merchant earnings excluding government tax and staff gratuity.
- **Total Discounts**: `SUM(discountAmount)` — Total promotional deductions applied.
- **Total Tips**: `SUM(tipAmount)` — Gratuity collected on behalf of service staff.
- **Refunded Revenue**: `SUM(refundedAmount)` — Processed credit reversals and refunds.
- **Average Ticket Size**: `netRevenue / closedSessionsCount` — Average merchant spend per completed dining table.

### 2.2 Operational Order Metrics (`getOrderMetrics`)
Calculated synchronously via `PrismaRestaurantAnalyticsRepository.getOrderMetrics` using `prisma.order.groupBy({ by: ['status'] })`:
- **Total Orders**: Count of all order tickets created on the business date.
- **Completed Orders**: Count of orders with `status = 'SERVED'`.
- **Cancelled Orders**: Count of orders with `status IN ('CANCELLED', 'REJECTED')`.
- **Cancellation Rate**: `cancelledOrders / totalOrders` — Kitchen failure / diner cancellation index.

### 2.3 Utilization & Capacity Metrics (`getUtilizationMetrics`)
Calculated via `prisma.session.aggregate` and `$queryRaw` SQL aggregation:
- **Covers Served**: `SUM(guestCount)` across non-open sessions.
- **Average Party Size**: `coversServed / closedSessionsCount`.
- **Revenue Per Cover (RevPASH proxy)**: `netRevenue / coversServed`.
- **Total Occupied Minutes**: `SUM(CASE WHEN closedAt > createdAt THEN (closedAt - createdAt) / 60000.0 ELSE 0.0 END)`.
- **Occupancy Percentage**: `totalOccupiedMinutes / (activeTableCount * operatingMinutes)`.
- **Average Table Turn Time**: `totalOccupiedMinutes / closedSessionsCount` (in minutes).

### 2.4 Kitchen SLA Funnel Metrics (`getSlaMetrics`)
Calculated via `$queryRaw` SQL aggregation on `Order` joined to `Session` for `status = 'SERVED'`:
- **Average Kitchen Prep Time**: `AVG((readyAt - acceptedAt) / 60000.0)`.
- **Average Service Time**: `AVG((servedAt - readyAt) / 60000.0)` — Waiter pickup to table delivery duration.
- **Average Fulfillment Time**: `AVG((servedAt - createdAt) / 60000.0)` — End-to-end customer wait time from order submission to consumption.

### 2.5 Platform SaaS & GMV Metrics (`getGmvMetrics`, `getFinancialMetrics`, `getTenantFunnel`)
Calculated via `PrismaPlatformAnalyticsRepository`:
- **Monthly Recurring Revenue (MRR)**: `SUM(Subscription.mrr)` for `status = 'ACTIVE'`.
- **Annual Recurring Revenue (ARR)**: `MRR * 12`.
- **SaaS Churn Rate**: `canceledSubscriptions / (activeSubscriptions + canceledSubscriptions)`.
- **Platform GMV**: `SUM(Session.totalAmount)` across all tenants for a specified date.
- **Total Platform Orders**: Count of non-cancelled orders across all tenants.
- **Tenant Funnel Distribution**: Group count of tenants by `onboardingStatus` (`LEAD`, `ONBOARDING`, `ACTIVE`, `SUSPENDED`, `DECOMMISSIONED`).

---

## 3. Current Dashboards & Reporting Surfaces

| Surface | File Location | Consumer | Query Trigger | Primary Bottleneck |
|---|---|---|---|---|
| **Restaurant Dashboard** | `apps/restaurant-admin/src/components/Dashboard.tsx` | Restaurant Owner / Manager | On mount / Manual date picker change | Runs 4 database aggregation queries simultaneously via `Promise.all` on OLTP tables. |
| **Platform Dashboard** | `apps/platform-admin/src/components/Dashboard.tsx` | Platform Super-Admin | On mount / Date selection | Scans cross-tenant `Session` and `Subscription` tables globally without index partition by tenant. |
| **EOD Audit Report (JSON)** | `apps/api/src/core/use-cases/GetEODAuditReportUseCase.ts` | Restaurant Auditor / Cashier | On demand (`GET /api/v1/restaurants/:id/audit/eod?date=`) | Queries all individual sessions with nested table and payment records, joins in memory. |
| **EOD Audit Report (CSV)** | `apps/api/src/adapters/secondary/csv/CsvExportAdapter.ts` | Accounting / Operations | On demand download (`GET .../audit/eod/export`) | Serializes all table, guest, gross, tax, tip, and payment method data into a single CSV string. |

---

## 4. Operational Table Dependencies & Schema Couplings

All analytics currently query raw transactional models defined in `packages/db/prisma/schema.prisma`:

```
┌──────────────┐       1:N       ┌──────────────┐       1:N       ┌──────────────┐
│    Tenant    │ ─────────────── │  Restaurant  │ ─────────────── │    Table     │
└──────────────┘                 └──────────────┘                 └──────────────┘
       │                                │                                │
       │ 1:N                            │ 1:N                            │ 1:N
       ▼                                ▼                                ▼
┌──────────────┐       1:N       ┌──────────────┐       1:N       ┌──────────────┐
│ Subscription │                 │   Session    │ ─────────────── │    Order     │
└──────────────┘                 └──────────────┘                 └──────────────┘
                                        │                                │
                                        │ 1:N                            │ 1:N
                                        ▼                                ▼
                                 ┌──────────────┐                 ┌──────────────┐
                                 │   Payment    │                 │  OrderItem   │
                                 └──────────────┘                 └──────────────┘
```

### High-Risk Dependencies:
1. **Dynamic State Filtering**: Queries rely on `status != 'OPEN'` or `status = 'SERVED'`. If an operational bug marks a session with an unexpected status string or fails to advance an order, analytical metrics completely drop the transaction.
2. **Denormalization Fragility**: `tenantId` and `businessDate` are manually stamped on `Session`, `Order`, `OrderItem`, and `Payment`. If any application use-case omits these fields during operational writes, multi-tenant partitioning fails.
3. **No Time-Series Bucketing**: To calculate hourly revenue, the database would have to parse and group SQLite integer timestamps at runtime, causing table scans and CPU spikes.

---

## 5. Current Lifecycle Transitions & Timestamp Capture

| Entity | Transition | Captured Timestamps | Mechanism | Integrity Status |
|---|---|---|---|---|
| **Session** | `OPEN` (Creation) | `createdAt` | Prisma default (`now()`) | Healthy |
| **Session** | `OPEN` → `CLOSED` | `closedAt`, `updatedAt` | Explicit write in `PrismaPaymentRepository.processCheckout` | Healthy (Enforced via integration tests) |
| **Session** | `CLOSED` → `REOPENED` | `reopenedAt` | Prisma column exists | Partially implemented in UI |
| **Session** | `REOPENED` → `FINALIZED`| `updatedAt` | Prisma column exists | Reserved for night audit |
| **Order** | `RECEIVED` | `createdAt` | Prisma default (`now()`) | Healthy |
| **Order** | `RECEIVED` → `PREPARING` | `acceptedAt`, `updatedAt` | Explicit write in `PrismaOrderRepository.updateOrderStatus` | Healthy (State machine enforced) |
| **Order** | `PREPARING` → `READY` | `readyAt`, `updatedAt` | Explicit write in `PrismaOrderRepository.updateOrderStatus` | Healthy (State machine enforced) |
| **Order** | `READY` → `SERVED` | `servedAt`, `updatedAt` | Explicit write in `PrismaOrderRepository.updateOrderStatus` | Healthy (State machine enforced) |
| **Order** | `*` → `CANCELLED` | `cancelledAt`, `updatedAt` | Explicit write in `PrismaOrderRepository.updateOrderStatus` | Healthy (Terminal state protected) |
| **Payment** | `PENDING` → `COMPLETED` | `createdAt` | Prisma default (`now()`) | Healthy |

---

## 6. Structural Limitations of Current Model

1. **Inability to Support Custom Dimensions**: A manager cannot ask: *"Show me cocktail revenue versus food revenue between 8 PM and 11 PM on Fridays"* without writing dedicated code and querying the transactional database.
2. **Missing Customer Interaction Telemetry**: We cannot analyze the digital conversion funnel:
   - Scanned QR → Viewed Menu (0% captured)
   - Viewed Menu → Added Item to Cart (0% captured)
   - Cart Abandonment Rate (0% captured)
3. **Lack of Immutable Historical Facts**: Operational databases update in place. If an order is cancelled or a table is deleted, the operational row changes. In an event-driven platform, facts are immutable; cancellation is an event, not an overwritten row.
4. **OLTP Performance Degradation**: As TableDiner scales across hundreds of restaurants with thousands of simultaneous diners, real-time dashboard polling (every 5–15 seconds) against live relational tables degrades transactional write throughput.

---

## 7. Migration Target Vision

The target architecture must transition TableDiner to an **Event-Driven Analytics Platform**:
- **Operational Core**: Records immutable domain facts as events at transaction boundaries.
- **Asynchronous Decoupling**: Background event bus / outbox relay insulates operational workflows from analytics overhead.
- **Analytics Event Store**: Append-only, multi-tenant, auditable historical truth.
- **Materialized Projections**: Asynchronously calculated analytical read models optimized for instant $O(1)$ dashboard rendering.
- **Self-Serve Semantic Layer**: Dynamic dimensional slicing (Time, Table, Category, Dish, Channel) without schema changes or backend redeployments.

