# Analytics Inventory

**Audit Date**: 2026-10-09  
**Auditor**: Principal Analytics Architect  
**Scope**: Entire TableDiner monorepo (`apps/api`, `apps/restaurant-admin`, `apps/platform-admin`, `packages/db`, `packages/shared-types`)

---

## 1. Executive Summary

This inventory catalogs every analytics component present in the TableDiner codebase. The current analytics architecture follows a Hexagonal pattern where Fastify routes delegate to Use Cases, which query secondary Prisma analytics repositories. All aggregations run on-demand in SQLite/Node.js memory with no OLAP datastore, scheduled jobs, materialized views, or event buses.

---

## 2. Component Inventory

### 2.1 APIs (HTTP Endpoints)

#### 1. Daily Restaurant Metrics
- **File Location**: `apps/api/src/index.ts` (Lines 354–368)
- **Method & Route**: `GET /api/v1/restaurants/:id/metrics/daily`
- **Purpose**: Serves daily operational KPIs (financials, orders, utilization, SLAs) to the Restaurant Admin dashboard.
- **Inputs**:
  - URL Parameter: `id` (restaurantId: string)
  - Query Parameter: `date` (optional string, YYYY-MM-DD format; defaults to UTC server date)
- **Outputs**: `RestaurantDashboardResponse` JSON (`businessDate`, `financials`, `orders`, `utilization`, `slas`).
- **Dependencies**: `GetRestaurantDashboardUseCase`, Fastify, `@tablediner/shared-types`.

#### 2. End-of-Day (EOD) Audit Report
- **File Location**: `apps/api/src/index.ts` (Lines 370–382)
- **Method & Route**: `GET /api/v1/restaurants/:id/audit/eod`
- **Purpose**: Returns session-level financial audit data and daily summary for store closing reconciliation.
- **Inputs**:
  - URL Parameter: `id` (restaurantId: string)
  - Query Parameter: `date` (optional string, YYYY-MM-DD format)
- **Outputs**: `RestaurantEodReportResponse` JSON (`businessDate`, `financialSummary`, `sessions: EodSessionRecord[]`).
- **Dependencies**: `GetEODAuditReportUseCase`, Fastify, `@tablediner/shared-types`.

#### 3. EOD Audit Report CSV Export
- **File Location**: `apps/api/src/index.ts` (Lines 387–403)
- **Method & Route**: `GET /api/v1/restaurants/:id/audit/eod/export`
- **Purpose**: Streams raw CSV file attachment containing financial summary and itemized closed sessions for bookkeeping.
- **Inputs**:
  - URL Parameter: `id` (restaurantId: string)
  - Query Parameter: `date` (optional string, YYYY-MM-DD format)
- **Outputs**: `text/csv` stream with header `Content-Disposition: attachment; filename="eod_audit_<id>_<date>.csv"`.
- **Dependencies**: `GetEODAuditReportUseCase`, `CsvExportAdapter`, Fastify.

#### 4. Platform Super-Admin Metrics
- **File Location**: `apps/api/src/index.ts` (Lines 405–415)
- **Method & Route**: `GET /api/v1/platform/metrics`
- **Purpose**: Serves multi-tenant platform metrics (SaaS ARR/MRR, GMV, Tenant funnel) to Platform Admin.
- **Inputs**:
  - Query Parameter: `date` (optional string, YYYY-MM-DD format; defaults to UTC server date)
- **Outputs**: `PlatformDashboardResponse` JSON (`reportDate`, `financials`, `gmv`, `funnel`).
- **Dependencies**: `GetPlatformDashboardUseCase`, Fastify, `@tablediner/shared-types`.

---

### 2.2 Domain Services & Core Logic

#### 1. AnalyticsDomainService
- **File Location**: `apps/api/src/core/domain/AnalyticsDomainService.ts` (Lines 1–31)
- **Purpose**: Encapsulates business day cutoff calculation (`calculateBusinessDate`) to convert physical UTC timestamps into restaurant logical accounting dates.
- **Inputs**: `utcDate: Date`, `cutoffHour: number` (e.g. 4 for 04:00 AM).
- **Outputs**: Formatted date string (`YYYY-MM-DD`).
- **Dependencies**: Native JavaScript `Date`. No external libraries.

---

### 2.3 Use Cases (Application Core)

#### 1. GetRestaurantDashboardUseCase
- **File Location**: `apps/api/src/core/use-cases/GetRestaurantDashboardUseCase.ts` (Lines 4–30)
- **Purpose**: Coordinates concurrent retrieval of 4 metric domains (Financial, Order, Utilization, SLA) for a restaurant on a business day.
- **Inputs**: `restaurantId: string`, `businessDate: string`.
- **Outputs**: `Promise<RestaurantDashboardResponse>`.
- **Dependencies**: `RestaurantAnalyticsRepository` port, `@tablediner/shared-types`. Hardcoded constant: `ASSUMED_OPERATING_MINUTES = 720` (12 hours).

#### 2. GetEODAuditReportUseCase
- **File Location**: `apps/api/src/core/use-cases/GetEODAuditReportUseCase.ts` (Lines 4–19)
- **Purpose**: Coordinates retrieval of aggregate financial summary and raw session ledger records for daily closing audit.
- **Inputs**: `restaurantId: string`, `businessDate: string`.
- **Outputs**: `Promise<RestaurantEodReportResponse>`.
- **Dependencies**: `RestaurantAnalyticsRepository` port, `@tablediner/shared-types`.

#### 3. GetPlatformDashboardUseCase
- **File Location**: `apps/api/src/core/use-cases/GetPlatformDashboardUseCase.ts` (Lines 4–23)
- **Purpose**: Coordinates SaaS subscription revenue, cross-tenant GMV, and tenant onboarding funnel metrics.
- **Inputs**: `reportDate: string`.
- **Outputs**: `Promise<PlatformDashboardResponse>`.
- **Dependencies**: `PlatformAnalyticsRepository` port, `@tablediner/shared-types`.

---

### 2.4 Ports (Interface Contracts)

#### 1. RestaurantAnalyticsRepository Port
- **File Location**: `apps/api/src/core/ports/RestaurantAnalyticsRepository.ts` (Lines 9–15)
- **Purpose**: Decouples domain use cases from underlying DB queries for restaurant analytics.
- **Methods**:
  - `getFinancialMetrics(restaurantId, businessDate): Promise<DailyFinancialMetrics>`
  - `getOrderMetrics(restaurantId, businessDate): Promise<DailyOrderMetrics>`
  - `getUtilizationMetrics(restaurantId, businessDate, operatingMinutes): Promise<DailyUtilizationMetrics>`
  - `getSlaMetrics(restaurantId, businessDate): Promise<DailySlaMetrics>`
  - `getEodSessions(restaurantId, businessDate): Promise<EodSessionRecord[]>`

#### 2. PlatformAnalyticsRepository Port
- **File Location**: `apps/api/src/core/ports/PlatformAnalyticsRepository.ts` (Lines 7–11)
- **Purpose**: Decouples platform analytics use case from DB.
- **Methods**:
  - `getFinancialMetrics(): Promise<PlatformFinancialMetrics>`
  - `getGmvMetrics(reportDate): Promise<PlatformGmvMetrics>`
  - `getTenantFunnel(): Promise<TenantFunnelMetrics>`

#### 3. ReportExportAdapter Port
- **File Location**: `apps/api/src/core/ports/ReportExportAdapter.ts` (Lines 3–5)
- **Purpose**: Contract for transforming typed report data into export formats.
- **Methods**:
  - `generateEodCsv(report: RestaurantEodReportResponse): string`

---

### 2.5 Repositories & Secondary Adapters

#### 1. PrismaRestaurantAnalyticsRepository
- **File Location**: `apps/api/src/adapters/secondary/db/PrismaRestaurantAnalyticsRepository.ts` (Lines 11–178)
- **Purpose**: Primary database query engine for restaurant metrics using Prisma ORM.
- **Inputs**: Injected `PrismaClient`.
- **Outputs**: Concrete metric DTOs.
- **Implementation Mechanism**:
  - `getFinancialMetrics`: Executes `prisma.session.aggregate` over `subtotal, taxAmount, discountAmount, tipAmount, totalAmount, refundedAmount` where `status != 'OPEN'`.
  - `getOrderMetrics`: Executes `prisma.order.groupBy` by `status`.
  - `getUtilizationMetrics`: Executes `prisma.session.aggregate` for guest counts + `prisma.session.findMany` for timestamps + in-memory elapsed minute subtraction + `prisma.table.count`.
  - `getSlaMetrics`: Executes `prisma.order.findMany` for completed SLA timestamps + in-memory subtraction (`readyAt - acceptedAt`, `servedAt - readyAt`, `servedAt - createdAt`).
  - `getEodSessions`: Executes `prisma.session.findMany` with relations to `table` and completed `payments`.

#### 2. PrismaPlatformAnalyticsRepository
- **File Location**: `apps/api/src/adapters/secondary/db/PrismaPlatformAnalyticsRepository.ts` (Lines 9–87)
- **Purpose**: Primary database query engine for platform-wide metrics.
- **Inputs**: Injected `PrismaClient`.
- **Outputs**: Platform metrics DTOs.
- **Implementation Mechanism**:
  - `getFinancialMetrics`: Queries `prisma.subscription.aggregate` for sum of `mrr` where `status = 'ACTIVE'`, counts active & canceled for churn.
  - `getGmvMetrics`: Queries `prisma.session.aggregate` directly using denormalized `businessDate` without joins, counts valid orders.
  - `getTenantFunnel`: Queries `prisma.tenant.groupBy` on `onboardingStatus`.

#### 3. CsvExportAdapter
- **File Location**: `apps/api/src/adapters/secondary/csv/CsvExportAdapter.ts` (Lines 4–52)
- **Purpose**: Formats EOD report into RFC 4180-compliant CSV text with quoted fields and double-quote escaping.
- **Inputs**: `RestaurantEodReportResponse`.
- **Outputs**: UTF-8 CSV formatted string.

---

### 2.6 Database Entities & Source Tables

| Table | File | Key Analytics Columns | Indexing Support for Analytics |
|---|---|---|---|
| `Session` | `packages/db/prisma/schema.prisma` (L143-189) | `tenantId`, `restaurantId`, `businessDate`, `guestCount`, `subtotal`, `taxAmount`, `discountAmount`, `tipAmount`, `refundedAmount`, `totalAmount`, `status`, `createdAt`, `closedAt` | `@@index([tenantId, businessDate])`<br>`@@index([tenantId, createdAt])`<br>`@@index([tenantId, closedAt])`<br>`@@index([tenantId, status])`<br>`@@index([restaurantId, businessDate])`<br>`@@index([businessDate])` |
| `Order` | `packages/db/prisma/schema.prisma` (L191-224) | `tenantId`, `sessionId`, `status`, `businessDate`, `createdAt`, `acceptedAt`, `readyAt`, `servedAt`, `cancelledAt` | `@@index([tenantId, acceptedAt])`<br>`@@index([tenantId, readyAt])`<br>`@@index([tenantId, servedAt])`<br>`@@index([tenantId, status])`<br>`@@index([sessionId])` |
| `OrderItem` | `packages/db/prisma/schema.prisma` (L226-255) | `tenantId`, `orderId`, `menuItemId`, `quantity`, `unitPrice`, `lineTotal`, `isVoided`, `voidedAt` | `@@index([tenantId, menuItemId])`<br>`@@index([orderId])` |
| `Payment` | `packages/db/prisma/schema.prisma` (L257-278) | `tenantId`, `sessionId`, `status`, `amount`, `method`, `createdAt` | `@@index([tenantId, method])`<br>`@@index([sessionId])` |
| `Subscription` | `packages/db/prisma/schema.prisma` (L32-45) | `tenantId`, `billingCycle`, `mrr`, `status` | `@@index([tenantId])` |
| `Tenant` | `packages/db/prisma/schema.prisma` (L10-30) | `id`, `onboardingStatus`, `isActive` | None |
| `Table` | `packages/db/prisma/schema.prisma` (L84-99) | `id`, `restaurantId`, `isActive` | `@@index([restaurantId])` |

---

### 2.7 UI Dashboard Widgets

#### 1. Restaurant Admin Dashboard View
- **File Location**: `apps/restaurant-admin/src/components/Dashboard.tsx` (Lines 1–178)
- **Consumed API**: `GET /api/v1/restaurants/:id/metrics/daily`, `GET /api/v1/restaurants/:id/audit/eod`
- **Rendered Widgets**:
  1. *Financials Grid*: Net Revenue, Gross Revenue, Avg Ticket Size, Tips Collected.
  2. *Utilization & Orders Grid*: Total Orders, Covers Served (Pax), Spend Per Head, Cancellation Rate.
  3. *SLA Grid*: Avg Table Turn Time, Avg Kitchen Prep Time, Avg Order Fulfillment.
  4. *EOD Audit Table*: Detailed session ledger with Print Report and CSV export links.

#### 2. Platform Admin Dashboard View
- **File Location**: `apps/platform-admin/src/components/Dashboard.tsx` (Lines 1–87)
- **Consumed API**: `GET /api/v1/platform/metrics`
- **Rendered Widgets**:
  1. *SaaS Financials Grid*: Monthly Recurring Revenue (MRR), Annual Run Rate (ARR), New MRR, Churn Rate.
  2. *Global Volume (GMV) Grid*: Total GMV Processed, Global Orders Processed, Global Sessions Processed, Average Order Value.
  3. *Tenant Lifecycle Funnel Grid*: Leads, Onboarding, Active, Suspended, Decommissioned.

---

### 2.8 Views, Scheduled Jobs & Audit Generation

- **Database Views**: **None**. (SQLite does not support materialized views; no SQL views defined in Prisma schema).
- **Scheduled / Cron Jobs**: **None**. (No background workers, no agenda/bullmq queues, no rollups).
- **Audit Generation**: On-demand query only via `GetEODAuditReportUseCase`. No dedicated permanent audit rollup table.

