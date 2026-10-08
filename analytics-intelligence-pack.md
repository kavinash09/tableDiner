# Analytics Intelligence Pack

**Audit Date**: 2026-10-09  
**Auditor**: Principal Analytics Architect  
**Classification**: Executive Technical Audit  
**Codebase Tracing**: All statements verified against `apps/api`, `packages/db`, `packages/shared-types`, and frontend apps.

---

## 1. Executive Summary

This Intelligence Pack synthesizes the complete analytics audit of the TableDiner monorepo. It establishes a factual baseline of existing analytics architecture, production metrics, dashboard views, database constraints, technical debt, and scalability risks.

---

## 2. Current Architecture

```
[ Frontend Dashboards ]
  - Restaurant Admin (Port 5174: Dashboard.tsx)
  - Platform Admin   (Port 5175: Dashboard.tsx)
          │
          │ HTTP GET (JSON / CSV)
          ▼
[ Primary Adapters (Fastify HTTP) ]
  - /api/v1/restaurants/:id/metrics/daily
  - /api/v1/restaurants/:id/audit/eod
  - /api/v1/restaurants/:id/audit/eod/export
  - /api/v1/platform/metrics
          │
          ▼
[ Core Use Cases ]
  - GetRestaurantDashboardUseCase (Hardcoded 720 min operating window)
  - GetEODAuditReportUseCase
  - GetPlatformDashboardUseCase
          │
          ▼
[ Secondary DB Repositories ]
  - PrismaRestaurantAnalyticsRepository (In-memory diff calculations)
  - PrismaPlatformAnalyticsRepository   (Denormalized tenant aggregations)
  - CsvExportAdapter                     (Manual string builder)
          │
          ▼
[ Storage Layer ]
  - SQLite (packages/db/tablediner.db via Prisma ORM)
  - OLTP single-file database. No OLAP, No Redis cache, No background cron jobs.
```

- **Architecture Pattern**: Hexagonal Architecture (Ports and Adapters).
- **Execution Model**: 100% On-Demand / Synchronous Compute. Every dashboard page load triggers direct aggregation queries against operational SQLite tables.
- **Data Warehouse / Caching**: **None**. No OLAP engine (DuckDB, ClickHouse), no Redis cache, and no materialized views exist.

---

## 3. Current Metrics Catalog

The codebase currently defines **28 operational & financial metrics**:

### Restaurant Daily Metrics (18)
1. **Gross Revenue**: `SUM(Session.totalAmount)` where `status != 'OPEN'`
2. **Net Revenue**: `totalAmount - taxAmount - tipAmount`
3. **Total Discounts**: `SUM(Session.discountAmount)`
4. **Total Tips**: `SUM(Session.tipAmount)`
5. **Refunded Revenue**: `SUM(Session.refundedAmount)`
6. **Avg Ticket Size**: `netRevenue / closedSessionsCount`
7. **Total Orders**: `COUNT(Order.id)`
8. **Completed Orders**: `COUNT(Order.id)` where `status = 'SERVED'`
9. **Cancelled Orders**: `COUNT(Order.id)` where `status IN ('CANCELLED', 'REJECTED')`
10. **Cancellation Rate**: `cancelledOrders / totalOrders`
11. **Covers Served**: `SUM(Session.guestCount)` where `status != 'OPEN'`
12. **Avg Party Size**: `coversServed / sessionCount`
13. **Spend Per Head**: `totalAmount / coversServed`
14. **Occupancy Percent**: `totalOccupiedMinutes / (tableCount * 720)`
15. **Avg Table Turn Time**: `totalOccupiedMinutes / sessionCount`
16. **Avg Kitchen Prep Time**: `(readyAt - acceptedAt) / 60000`
17. **Avg Service Time**: `(servedAt - readyAt) / 60000`
18. **Avg Order Fulfillment**: `(servedAt - createdAt) / 60000`

### Platform Super-Admin Metrics (10)
1. **MRR**: `SUM(Subscription.mrr)` where `status = 'ACTIVE'`
2. **ARR**: `mrr * 12`
3. **New MRR**: Hardcoded `0`
4. **Churned MRR**: Hardcoded `0`
5. **Churn Rate**: `canceled / (active + canceled)`
6. **Total GMV**: `SUM(Session.totalAmount)` for report date
7. **Global Orders Processed**: Valid order count for report date
8. **Global Sessions Processed**: Closed session count for report date
9. **Avg Order Value**: `totalGmv / sessionsProcessed`
10. **Tenant Funnel Counts**: Counts by `onboardingStatus` (Lead, Onboarding, Active, Suspended, Decommissioned)

---

## 4. Current Dashboards

1. **Restaurant Admin Dashboard** (`apps/restaurant-admin/src/components/Dashboard.tsx`):
   - Displays 11 metric cards + 1 session audit ledger table.
   - Filterable only by single business date.
   - Exports via CSV download and `window.print()`.
2. **Platform Admin Dashboard** (`apps/platform-admin/src/components/Dashboard.tsx`):
   - Displays 13 SaaS and GMV metric cards.
   - Zero filters or date pickers (hardcoded to server date).
3. **Kitchen Operational Board** (`apps/restaurant-admin/src/App.tsx`):
   - 3-column Kanban board (`RECEIVED`, `PREPARING`, `READY`) with 5-second polling.

---

## 5. Current Events

The system executes **18 discrete business events**, but possesses **zero event-driven infrastructure**:
- All events are synchronous database mutations triggered by REST requests.
- No event log table, outbox pattern, Kafka, RabbitMQ, or Redis Pub/Sub.
- State changes overwrite previous states in-place.

---

## 6. Current Limitations & Implementation Realities

1. **SLA Metrics Always Return 0 in Practice**:
   - `PrismaOrderRepository.updateOrderStatus` updates `data: { status }` only.
   - It **never writes `acceptedAt`, `readyAt`, or `servedAt`** (`apps/api/src/adapters/secondary/db/PrismaRepositories.ts` Lines 79–84).
   - Because these timestamps are null, SLA calculations evaluate to zero.
2. **Occupancy & Table Turn Return 0 in Practice**:
   - `PrismaPaymentRepository.processCheckout` writes `data: { status: 'CLOSED' }` but **omits `closedAt: new Date()`** (Lines 88–94).
   - `getUtilizationMetrics` queries `closedAt: { not: null }`, returning empty sets.
3. **Session Financial Snapshot Columns Remain 0.0**:
   - `Session.totalAmount`, `subtotal`, `taxAmount`, and `tipAmount` are never populated during checkout, leaving default values.
4. **Hardcoded Assumptions**:
   - Operating hours are hardcoded to 12 hours (720 min) in `GetRestaurantDashboardUseCase.ts`.
   - Platform `newMrr` and `churnedMrr` are hardcoded to `0`.

---

## 7. Data Model Constraints

1. **SQLite Engine Limitations**:
   - SQLite lacks date arithmetic functions (`DATE_DIFF`, `EXTRACT`, `AGE`).
   - Forces the repository to query all raw session and order timestamps and compute durations in **Node.js process memory**.
2. **Anonymous Diners**:
   - No customer table or identity linking on `Session`.
   - Customer retention, repeat visit rates, and LTV are impossible to compute.
3. **Absence of Historical Transition Logs**:
   - No `OrderStatusHistory` or `SessionHistory`.
   - Past status durations cannot be reconstructed if timestamps are lost.

---

## 8. Technical Debt

1. **Unimplemented Type Contracts**:
   - `packages/shared-types/src/index.ts` lines 179–190 defines `MenuItemInsight` and `RestaurantInsightsResponse` (`topSellers`, `bottomSellers`).
   - Neither the use case, repository, nor API endpoint exists.
2. **Unpaginated Audit Ledger**:
   - `GET /api/v1/restaurants/:id/audit/eod` executes unpaginated `findMany` over all closed sessions.
3. **Repository Imports Discrepancy**:
   - `PrismaRepositories.ts` uses the `@tablediner/db` singleton.
   - `PrismaRestaurantAnalyticsRepository.ts` and `PrismaPlatformAnalyticsRepository.ts` instantiate a raw `new PrismaClient()` in `index.ts`.

---

## 9. Scalability Risks

1. **Node.js Memory Exhaustion (OOM)**:
   - For a restaurant with 1,500 daily sessions and 5,000 orders, `getUtilizationMetrics` and `getSlaMetrics` load thousands of raw date objects into memory.
   - Under concurrent dashboard traffic, this will exhaust heap memory.
2. **SQLite Database Locking**:
   - SQLite uses file-level locking for writes.
   - Heavy aggregate queries during lunch/dinner rushes will block incoming table order creations and payments.
3. **No Connection Pooling**:
   - Separate `PrismaClient` instances increase connection count and SQLite file handle contention.

---

## 10. Missing Analytics Capabilities

| Capability Category | Missing Capabilities |
|---|---|
| **Menu Performance** | Top/Bottom sellers, dish profitability, category sales mix, void reasons |
| **Table Performance** | Revenue by table, turn count by table, table heatmaps, section analysis |
| **Time-Series / Trends** | Multi-day ranges, weekly/monthly trends, WoW / MoM comparisons |
| **Customer Journey** | Funnel conversion (QR → Cart → Pay), repeat diners, guest frequency |
| **Financial Reconciliations** | Cash vs Card vs UPI daily settlement breakdown, tax liability ledgers |

---

## 11. Self-Service Readiness Score

- **Readiness Score**: **14% (2 / 14 Supported)**
- **Status**: **NOT READY**.
- **Explanation**: The analytics surface is completely static and hardcoded. End-users cannot customize filters, select dimensions, change date ranges beyond a single day, or build ad-hoc reports.

---

## 12. Future Migration Risks

1. **PostgreSQL Migration**:
   - Will require refactoring Node.js in-memory timestamp differences into native SQL `EXTRACT(EPOCH FROM ...)` or window functions.
2. **OLAP Warehouse Introduction (ClickHouse / Snowflake)**:
   - Currently impossible to stream clean CDC (Change Data Capture) because tables mutate in-place without event logs or sequence versioning.
3. **Timezone Conversion**:
   - `AnalyticsDomainService.ts` lines 9–12 explicitly notes that server local/UTC time is used instead of converting to the tenant's IANA timezone, which will cause date rollover errors for international tenants.

