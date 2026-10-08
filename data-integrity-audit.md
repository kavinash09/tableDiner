# Data Integrity & Lifecycle Audit

**Audit Date**: 2026-10-09  
**Auditor**: Principal Analytics & Data Architect  
**Classification**: High-Priority Technical Audit  
**Target Repository**: TableDiner Monorepo (`apps/api`, `packages/db`, `packages/shared-types`)

---

## 1. Executive Summary

This audit examines the business workflows of TableDiner to identify risks where:
- State transitions occur without recording timestamps.
- Financial transactions occur without snapshotting immutable totals.
- Historical reporting data can become silently corrupted or drift.
- Analytics rely on nullable or mutable fields.

### Key Finding
The database schema (`packages/db/prisma/schema.prisma`) was thoughtfully designed with timestamp and snapshot fields (`acceptedAt`, `readyAt`, `servedAt`, `closedAt`, `subtotal`, `taxAmount`, `totalAmount`). **However, the active repository layer (`PrismaRepositories.ts`) completely omits writing to these fields during runtime state transitions.** As a result, critical operational metrics (revenue, occupancy, kitchen SLAs) currently evaluate to `0` or null in production.

---

## 2. Entity-by-Entity Integrity Analysis

---

### 2.1 Tenant

```
[ LEAD ] ──► [ ONBOARDING ] ──► [ ACTIVE ] ──► [ SUSPENDED ] ──► [ DECOMMISSIONED ]
```

- **Lifecycle States**: `LEAD`, `ONBOARDING`, `ACTIVE`, `SUSPENDED`, `DECOMMISSIONED`
- **Required Timestamps**: `createdAt`, `updatedAt`, `deletedAt`, `activatedAt`, `suspendedAt`, `decommissionedAt`
- **Currently Captured Timestamps**: `createdAt` (`DateTime @default(now())`), `updatedAt` (`DateTime @updatedAt`), `deletedAt` (`DateTime?`)
- **Missing Timestamps**:
  - `activatedAt`: When tenant converted from Onboarding to Active.
  - `suspendedAt`: When tenant was locked out for non-payment or breach.
  - `decommissionedAt`: When tenant offboarded.
- **Financial Snapshots**: None on Tenant directly. (Subscription has `mrr: Float`, but plan changes overwrite `mrr` in-place).
- **Missing Snapshots**: Historical subscription ledger (MRR snapshot at time of billing cycle change).
- **Analytics Impact**:
  - `getTenantFunnel()` groups by current `onboardingStatus`. Because transition timestamps do not exist, the platform **cannot calculate Time-in-Funnel, Stage Conversion Velocity, or Churn Cohorts**.
  - `TenantAuditLog` exists in `schema.prisma` but is **never written to by any service or repository**.
- **Severity**: **P2 (Medium)**

---

### 2.2 Restaurant

```
[ ACTIVE: true ] ──► [ ACTIVE: false (Soft-Deleted) ]
```

- **Lifecycle States**: Active (`isActive = true`), Inactive (`isActive = false`)
- **Required Timestamps**: `createdAt`, `updatedAt`, `deletedAt`, `activatedAt`, `deactivatedAt`
- **Currently Captured Timestamps**: `createdAt`, `updatedAt`, `deletedAt`
- **Missing Timestamps**: `activatedAt`, `deactivatedAt`
- **Financial Snapshots**: None.
- **Missing Snapshots**: `businessDayCutoffHour` configuration versioning.
- **Analytics Impact**:
  - **Retroactive Date Corruption**: `Restaurant.businessDayCutoffHour` (default `4` for 04:00 AM) is mutable via `updateSettings`. If a restaurant shifts cutoff from 4 AM to 2 AM, sessions created between 2 AM and 4 AM would change logical business dates if historical data is ever recalculated.
- **Severity**: **P2 (Medium)**

---

### 2.3 Table

```
[ ACTIVE: true ] ──► [ ACTIVE: false (Soft-Deleted) ]
```

- **Lifecycle States**: Active (`isActive = true`), Soft-Deleted (`isActive = false`)
- **Required Timestamps**: `createdAt`, `updatedAt`, `deletedAt`
- **Currently Captured Timestamps**: `createdAt`, `updatedAt`, `deletedAt`
- **Missing Timestamps**: None.
- **Financial Snapshots**: None.
- **Missing Snapshots**: Historical Table Capacity Snapshot.
- **Analytics Impact**:
  - **Historical Metric Drift (P1)**: In `PrismaRestaurantAnalyticsRepository.ts` Line 110, occupancy is calculated as:
    ```typescript
    const tableCount = await this.prisma.table.count({ where: { restaurantId, isActive: true } });
    const availableMinutes = tableCount * operatingMinutes;
    ```
    If a restaurant adds 5 tables or soft-deletes 3 tables today, **historical occupancy percentages for 6 months ago will retroactively change** because `availableMinutes` dynamically evaluates the *current* active table count instead of the table count active on that historical date.
- **Severity**: **P1 (High)**

---

### 2.4 Session

```
[ OPEN ] ──► [ CLOSED ] ──► (REOPENED) ──► (FINALIZED)
```

- **Lifecycle States**: `OPEN`, `CLOSED`, `REOPENED`, `FINALIZED`
- **Required Timestamps**: `createdAt`, `openedAt`, `closedAt`, `reopenedAt`, `finalizedAt`
- **Currently Captured Timestamps**: `createdAt` (`default(now())`), `updatedAt` (`@updatedAt`)
- **Missing Timestamps**:
  - ⚠️ **`closedAt` is NEVER populated during checkout!** In `PrismaRepositories.ts` Line 91:
    ```typescript
    prisma.session.update({ where: { id: sessionId }, data: { status: 'CLOSED' } })
    ```
    It writes `status: 'CLOSED'`, but **omits `closedAt: new Date()`**.
  - `openedAt` is null in schema; `createdAt` is used as fallback.
  - `reopenedAt` is declared in schema but never populated.
- **Financial Snapshots**:
  - `subtotal`: Float
  - `taxAmount`: Float
  - `discountAmount`: Float
  - `tipAmount`: Float
  - `totalAmount`: Float
  - `refundedAmount`: Float
- **Missing Snapshots**:
  - ⚠️ **CRITICAL CORRUPTION: All financial snapshot columns remain `0.0` or `null`!**
  - During `processCheckout` (`PrismaRepositories.ts` Lines 88–94), the code creates a `Payment` record and sets `status = 'CLOSED'`, but **never updates `Session.totalAmount`, `subtotal`, `taxAmount`, or `tipAmount`**.
- **Analytics Impact**:
  - **`getFinancialMetrics` Returns ₹0.00**: Queries `_sum: { totalAmount: true }` on `Session`. Because `totalAmount` was never written on checkout, gross revenue, net revenue, and average ticket size calculate to 0.
  - **`getUtilizationMetrics` Returns 0**: Queries `where: { closedAt: { not: null } }`. Because `closedAt` is null, it finds 0 closed sessions, and occupancy % and table turn time calculate to 0.
  - **Platform GMV Returns ₹0.00**: `PrismaPlatformAnalyticsRepository.getGmvMetrics` sums `Session.totalAmount`, returning 0.
- **Severity**: **P0 (Critical Blocker)**

---

### 2.5 Order

```
[ RECEIVED ] ──► [ PREPARING ] ──► [ READY ] ──► [ SERVED ]
       │                │                │
       ▼                ▼                ▼
[ CANCELLED ]    [ CANCELLED ]    [ REJECTED ]
```

- **Lifecycle States**: `RECEIVED`, `PREPARING`, `READY`, `SERVED`, `CANCELLED`, `REJECTED`
- **Required Timestamps**: `createdAt`, `updatedAt`, `acceptedAt`, `readyAt`, `servedAt`, `cancelledAt`
- **Currently Captured Timestamps**: `createdAt` (`default(now())`), `updatedAt` (`@updatedAt`)
- **Missing Timestamps**:
  - ⚠️ **`acceptedAt` is NEVER written**.
  - ⚠️ **`readyAt` is NEVER written**.
  - ⚠️ **`servedAt` is NEVER written**.
  - ⚠️ **`cancelledAt` is NEVER written**.
  - **Code Proof**: In `PrismaRepositories.ts` Lines 79–84:
    ```typescript
    async updateOrderStatus(orderId: string, status: string) {
      return prisma.order.update({
        where: { id: orderId },
        data: { status }, // Only status is written!
      });
    }
    ```
- **Financial Snapshots**: None on Order entity directly (line items hold financials).
- **Missing Snapshots**: Order gross total snapshot.
- **Analytics Impact**:
  - **All SLA Metrics Return 0.0 Minutes**: `PrismaRestaurantAnalyticsRepository.getSlaMetrics` queries `where: { status: 'SERVED' }` and computes:
    ```typescript
    if (o.acceptedAt && o.readyAt && o.servedAt) {
      totalPrep += (o.readyAt.getTime() - o.acceptedAt.getTime()) / 60000;
      totalService += (o.servedAt.getTime() - o.readyAt.getTime()) / 60000;
      totalFulfillment += (o.servedAt.getTime() - o.createdAt.getTime()) / 60000;
    }
    ```
    Because `acceptedAt`, `readyAt`, and `servedAt` are permanently null, `count` remains `0` and all SLA averages return `0`.
- **Severity**: **P0 (Critical Blocker)**

---

### 2.6 OrderItem

```
[ CREATED (isVoided: false) ] ──► [ VOIDED (isVoided: true) ]
```

- **Lifecycle States**: Active (`isVoided: false`), Voided (`isVoided: true`)
- **Required Timestamps**: `createdAt`, `updatedAt`, `voidedAt`
- **Currently Captured Timestamps**: `createdAt`, `updatedAt`
- **Missing Timestamps**: `voidedAt` (field exists in schema, but no void method updates it).
- **Financial Snapshots**: `unitPrice`, `lineTotal`
- **Currently Captured Snapshots**:
  - ✅ `unitPrice` = `menuItem.price` (snapshotted in `AppUseCases.placeOrder`)
  - ✅ `lineTotal` = `menuItem.price * quantity` (snapshotted in `AppUseCases.placeOrder`)
- **Missing Snapshots**:
  - Line-level Tax Rate / Tax Amount snapshot.
  - Line-level Discount allocation snapshot.
  - Line-level Cost of Goods Sold (COGS) / Raw food cost snapshot.
- **Analytics Impact**:
  - Dish pricing snapshotting works properly on insert, protecting bill calculation from future menu price modifications.
  - Void reasons and void timestamps are untracked.
  - Dish-level profit margins and tax liability breakdowns cannot be calculated.
- **Severity**: **P1 (High)**

---

### 2.7 Payment

```
[ PENDING ] ──► [ COMPLETED ] / [ FAILED ]
```

- **Lifecycle States**: `PENDING`, `COMPLETED`, `FAILED`
- **Required Timestamps**: `createdAt`, `updatedAt`, `completedAt`, `failedAt`
- **Currently Captured Timestamps**: `createdAt` (`default(now())`), `updatedAt` (`@updatedAt`)
- **Missing Timestamps**: `completedAt`, `failedAt` (Status is directly inserted as `COMPLETED`, using `createdAt`).
- **Financial Snapshots**: `amount: Float`
- **Currently Captured Snapshots**: ✅ `amount` captured on insert.
- **Missing Snapshots**:
  - `gatewayFee`: Processing fee charged by payment provider (e.g. Razorpay/Stripe).
  - `netSettlementAmount`: `amount - gatewayFee`.
  - `currency`: Implicitly assumed INR (`₹`); no ISO currency code stored.
  - `providerId`: Payment gateway transaction ID (currently null in mock checkout).
- **Analytics Impact**:
  - EOD audit reports gross payment amount, but cannot report net cash settled in merchant bank account after payment gateway fee deductions.
- **Severity**: **P1 (High)**

---

## 3. Systematic Findings & Ranking Matrix

---

### P0 Findings (Critical Data Integrity & Analytics Blockers)

#### 1. [P0] `Session.closedAt` is Never Written During Checkout
- **File**: `apps/api/src/adapters/secondary/db/PrismaRepositories.ts` (Lines 88–94)
- **Workflow**: Diner completes payment (`POST /table/:qrCode/pay`).
- **Corruption**: `session.update` sets `data: { status: 'CLOSED' }` but omits `closedAt: new Date()`.
- **Damage**:
  - `PrismaRestaurantAnalyticsRepository.getUtilizationMetrics` queries `where: { closedAt: { not: null } }`, finding 0 closed sessions.
  - **Avg Table Turn Time** evaluates to `0 min`.
  - **Occupancy %** evaluates to `0%`.
  - EOD Session Ledger falls back to displaying `createdAt` as closing time.

#### 2. [P0] `Session` Financial Totals Never Snapshotted on Checkout
- **File**: `apps/api/src/adapters/secondary/db/PrismaRepositories.ts` (Lines 88–94)
- **Workflow**: Diner completes payment.
- **Corruption**: The session is closed without writing `totalAmount`, `subtotal`, `taxAmount`, or `tipAmount`.
- **Damage**:
  - `PrismaRestaurantAnalyticsRepository.getFinancialMetrics` queries `_sum: { totalAmount: true }` on `Session`.
  - **Gross Revenue**, **Net Revenue**, and **Avg Ticket Size** evaluate to `₹0.00`.
  - Platform GMV (`PrismaPlatformAnalyticsRepository.getGmvMetrics`) evaluates to `₹0.00`.
  - EOD Audit table lists session amounts as ₹0.00.

#### 3. [P0] Order SLA Timestamps Never Written in `updateOrderStatus`
- **File**: `apps/api/src/adapters/secondary/db/PrismaRepositories.ts` (Lines 79–84)
- **Workflow**: Kitchen staff transitions ticket from `RECEIVED` → `PREPARING` → `READY` → `SERVED`.
- **Corruption**: `PrismaOrderRepository.updateOrderStatus` updates `data: { status }` only. It never populates `acceptedAt`, `readyAt`, `servedAt`, or `cancelledAt`.
- **Damage**:
  - `getSlaMetrics` queries `where: { acceptedAt: { not: null }, readyAt: { not: null }, servedAt: { not: null } }`.
  - **Avg Kitchen Prep Time**, **Avg Service Time**, and **Avg Order Fulfillment** evaluate permanently to `0 min`.

---

### P1 Findings (High-Risk Metric Inaccuracies & Historical Drift)

#### 4. [P1] Historical Table Count Drift in Occupancy Calculation
- **File**: `apps/api/src/adapters/secondary/db/PrismaRestaurantAnalyticsRepository.ts` (Line 110)
- **Workflow**: Restaurant manager adds new tables or soft-deletes broken tables.
- **Corruption**: Occupancy formula uses current `prisma.table.count({ where: { isActive: true } })`.
- **Damage**:
  - If a restaurant operated 10 tables in January and expands to 20 tables in October, running January's occupancy report in October divides January's occupied minutes by 20 tables instead of 10 tables, **halving historical occupancy figures retroactively**.

#### 5. [P1] In-Place State Mutation Without Audit Log / History Ledger
- **Files**: `Session`, `Order`, `Payment` tables.
- **Workflow**: Any operational state change.
- **Corruption**: Previous statuses are overwritten in-place. If an order transitions `RECEIVED` → `PREPARING` → `CANCELLED`, all historical evidence that the kitchen spent 15 minutes preparing the dish is destroyed.
- **Damage**:
  - Cannot measure kitchen scrap/waste from cancelled in-flight orders.
  - Cannot trace who changed order status or when reopening occurred.

#### 6. [P1] In-Memory Node.js Loops for Date Math
- **File**: `apps/api/src/adapters/secondary/db/PrismaRestaurantAnalyticsRepository.ts` (Lines 94–103 & 124–136)
- **Workflow**: Analytics API request execution.
- **Corruption**: Rather than delegating duration arithmetic to the database engine, raw arrays of session and order dates are loaded into the Node.js process heap.
- **Damage**:
  - High risk of process crash (OOM) under concurrent requests or high order volume.

---

### P2 Findings (Medium-Risk Metadata & Configuration Gaps)

#### 7. [P2] Unversioned `businessDayCutoffHour` Configuration
- **File**: `Restaurant.businessDayCutoffHour`
- **Workflow**: Restaurant changes closing cutoff hour in settings.
- **Corruption**: Past session business dates are calculated at runtime if not snapshotted.
- **Damage**: Inconsistency between historical dates and current reporting boundaries.

#### 8. [P2] Tenant Funnel Stages Lack Timestamps
- **File**: `Tenant.onboardingStatus`
- **Corruption**: State is overwritten in-place without `activatedAt`, `suspendedAt`, `decommissionedAt`.
- **Damage**: SaaS funnel metrics cannot measure conversion lag or tenant lifetime before churn.

#### 9. [P2] `OrderItem` Lacks Tax & Discount Snapshots
- **File**: `OrderItem`
- **Corruption**: Line items snapshot price and total, but omit tax rate and discount allocation.
- **Damage**: Menu category tax reporting and dish profitability cannot be audited.

---

### P3 Findings (Low-Risk Conventions & Assumptions)

#### 10. [P3] Implicit Currency
- **Files**: `Session`, `Order`, `Payment`
- **Corruption**: All financial fields are raw `Float` numbers with implicit assumption of INR (₹).
- **Damage**: Multi-currency expansion will cause currency mixing.

#### 11. [P3] Anonymous Diners Prevent Customer Analytics
- **File**: `Session`
- **Corruption**: No foreign key or token linking diners across sessions.
- **Damage**: Customer repeat rate, cohort retention, and lifetime value are impossible to calculate.

#### 12. [P3] Hardcoded 12-Hour Operating Day Constant
- **File**: `GetRestaurantDashboardUseCase.ts` (Line 13)
- **Corruption**: `ASSUMED_OPERATING_MINUTES = 720` hardcoded.
- **Damage**: Distorts occupancy for 24-hour diners or 6-hour cafes.

---

## 4. Summary of Affected Reports & Dashboards

| Report / Dashboard | File / Endpoint | Root Causes | Symptoms / Inaccurate Outputs |
|---|---|---|---|
| **Daily Operations Dashboard** | `apps/restaurant-admin/src/components/Dashboard.tsx` (`GET .../metrics/daily`) | Findings 1, 2, 3, 4 | - Net Revenue: ₹0.00<br>- Gross Revenue: ₹0.00<br>- Avg Ticket: ₹0.00<br>- Occupancy %: 0.0%<br>- Turn Time: 0 min<br>- Kitchen SLAs: 0 min |
| **EOD Audit Report** | `apps/api/src/index.ts` (`GET .../audit/eod`) | Findings 1, 2 | - Ledger sessions show ₹0.00 net/tax/total<br>- Closing times default to `createdAt` |
| **EOD CSV Export** | `apps/api/src/adapters/secondary/csv/CsvExportAdapter.ts` | Findings 1, 2 | - Financial summary block exports 0s<br>- All session rows have 0.0 amounts |
| **Platform Admin Dashboard** | `apps/platform-admin/src/components/Dashboard.tsx` (`GET .../platform/metrics`) | Finding 2 | - Total GMV Processed: ₹0.00<br>- Average Order Value: ₹0.00 |

---

## 5. Scalability & Architectural Risk Summary

1. **State Snapshot Immutability Principle Violated**:
   Transactions should freeze state at the moment of settlement. In TableDiner, the session state is marked `CLOSED`, but the financial snapshot values are omitted, leaving the system dependent on ad-hoc recalculation from order lines.
2. **Missing Operational Transition Triggers**:
   The primary Fastify HTTP routes interact directly with raw Prisma updates instead of using domain entity methods (e.g. `order.markServed()`, `tableSession.closeSession()`), which prevents lifecycle hooks and timestamp setters from executing.
3. **Database Engine Mismatch**:
   SQLite's lack of date math forces runtime heap memory consumption in Node.js, presenting a severe concurrency bottleneck that will fail under production loads.

