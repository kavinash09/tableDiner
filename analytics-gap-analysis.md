# Analytics Gap Analysis

**Audit Date**: 2026-10-09  
**Auditor**: Principal Analytics Architect  
**Scope**: Comprehensive gap analysis comparing current codebase state against industry standard restaurant SaaS analytics.

---

## 1. Gap Classification Summary

| Domain | Critical Gaps | High Gaps | Medium Gaps | Low Gaps |
|---|---|---|---|---|
| **Restaurant Operations** | 1 | 2 | 1 | 0 |
| **Menu Performance** | 1 | 1 | 1 | 1 |
| **Table Performance** | 0 | 1 | 1 | 1 |
| **Occupancy Analytics** | 1 | 1 | 1 | 0 |
| **Revenue Analytics** | 1 | 1 | 1 | 1 |
| **Customer Journey** | 0 | 1 | 1 | 1 |
| **TOTALS** | **4** | **7** | **6** | **4** |

---

## 2. Detailed Gaps by Domain

### 2.1 Restaurant Operations Analytics

#### [CRITICAL] Gap 1.1: Kitchen SLA Timestamps Never Written
- **File**: `apps/api/src/adapters/secondary/db/PrismaRepositories.ts` (Lines 79–84)
- **Issue**: `PrismaOrderRepository.updateOrderStatus` updates `data: { status }` only. It **never sets `acceptedAt`, `readyAt`, `servedAt`, or `cancelledAt`**.
- **Impact**: All SLA metrics (`avgKitchenPrepTimeMinutes`, `avgServiceTimeMinutes`, `avgFulfillmentTimeMinutes`) in `PrismaRestaurantAnalyticsRepository.ts` query `where: { acceptedAt: { not: null }, readyAt: { not: null }, servedAt: { not: null } }`, evaluating to **0.0 minutes permanently**.
- **Severity**: **CRITICAL**

#### [HIGH] Gap 1.2: No Shift / Daypart Partitioning
- **Issue**: Analytics only groups by single 24-hour logical business date. Restaurants cannot differentiate Lunch service (12:00–16:00) from Dinner service (19:00–23:00).
- **Severity**: **HIGH**

#### [HIGH] Gap 1.3: No Real-Time Queue Depth or Bottleneck Alerts
- **Issue**: The KDS and analytics do not track kitchen backlog (tickets waiting > 20 min). No threshold alerts exist.
- **Severity**: **HIGH**

#### [MEDIUM] Gap 1.4: Hardcoded Operating Hours in Occupancy Logic
- **File**: `apps/api/src/core/use-cases/GetRestaurantDashboardUseCase.ts` (Line 13)
- **Issue**: `ASSUMED_OPERATING_MINUTES = 720` (12 hours) is hardcoded. Restaurants operating 6 hours or 16 hours receive distorted occupancy rates.
- **Severity**: **MEDIUM**

---

### 2.2 Menu Performance Analytics

#### [CRITICAL] Gap 2.1: Menu Item Sales Analytics Completely Unimplemented
- **Issue**: Contracts exist in `@tablediner/shared-types` (`MenuItemInsight`, `RestaurantInsightsResponse`), but **zero backend repository methods or endpoints exist** to calculate dish sales volume or item revenue.
- **Impact**: Restaurant owners cannot identify Top Sellers, Bottom Sellers, or dead menu stock.
- **Severity**: **CRITICAL**

#### [HIGH] Gap 2.2: No Menu Category Revenue Distribution
- **Issue**: No calculation of sales mix by category (e.g. Beverages 25%, Mains 55%, Desserts 20%).
- **Severity**: **HIGH**

#### [MEDIUM] Gap 2.3: No Waste, Cancellation, or Comp Reason Tracking
- **Issue**: Schema defines `OrderItem.voidReason` and `Order.cancellationReason`, but neither is exposed in analytics.
- **Severity**: **MEDIUM**

#### [LOW] Gap 2.4: No Item Modification / Add-on Analytics
- **Issue**: Special notes are treated as unparsed strings; no structured modifier revenue analytics.
- **Severity**: **LOW**

---

### 2.3 Table Performance Analytics

#### [HIGH] Gap 3.1: Zero Table-Level Financial Performance Metrics
- **Issue**: The system cannot report Revenue by Table, Average Ticket by Table, or Table Turn Count.
- **Impact**: Managers cannot determine which tables are high-performing (window seats vs drafty corners).
- **Severity**: **HIGH**

#### [MEDIUM] Gap 3.2: No Floor Plan / Section Analytics
- **Issue**: Tables are flat entities with no grouping by Dining Room, Patio, Bar, or VIP private rooms.
- **Severity**: **MEDIUM**

#### [LOW] Gap 3.3: No Table Idle Time Tracking
- **Issue**: Cannot measure elapsed time between one session closing and the next guest seating.
- **Severity**: **LOW**

---

### 2.4 Occupancy Analytics

#### [CRITICAL] Gap 4.1: `Session.closedAt` Unpopulated During Checkout
- **File**: `apps/api/src/adapters/secondary/db/PrismaRepositories.ts` (Lines 88–94)
- **Issue**: `processCheckout` executes `session.update({ data: { status: 'CLOSED' } })`, leaving `closedAt` as `null`.
- **Impact**: `getUtilizationMetrics` queries `closedAt: { not: null }`. Because `closedAt` is null, the query returns zero rows, causing **Occupancy % and Table Turn Time to always report 0**.
- **Severity**: **CRITICAL**

#### [HIGH] Gap 4.2: In-Memory Node.js Loop for Timestamp Differences
- **File**: `apps/api/src/adapters/secondary/db/PrismaRestaurantAnalyticsRepository.ts` (Lines 94–103)
- **Issue**: All closed sessions are fetched into Node.js memory to subtract `closedAt - createdAt` in JavaScript.
- **Impact**: Will cause massive garbage collection pauses and OOM crashes at scale.
- **Severity**: **HIGH**

#### [MEDIUM] Gap 4.3: Headcount vs Table Capacity Mismatch
- **Issue**: Occupancy calculates table duration only, ignoring whether a 4-person table was occupied by 1 person (25% capacity) or 4 persons (100% capacity).
- **Severity**: **MEDIUM**

---

### 2.5 Revenue Analytics

#### [CRITICAL] Gap 5.1: Session Financial Snapshot Fields Unpopulated
- **File**: `apps/api/src/adapters/secondary/db/PrismaRepositories.ts` (Lines 88–94)
- **Issue**: When a payment of ₹500 is made, `Session.totalAmount`, `subtotal`, `taxAmount`, and `tipAmount` are **never updated** (remain at default `0.0`).
- **Impact**: `getFinancialMetrics` queries `_sum: { totalAmount: true }` on `Session`. In practice, gross and net revenue will calculate to ₹0.00 unless the session row is explicitly populated.
- **Severity**: **CRITICAL**

#### [HIGH] Gap 5.2: No Multi-Day Time-Series or Trend Analytics
- **Issue**: System cannot query weekly, monthly, or quarterly trends (MTD, YTD, WoW, MoM).
- **Severity**: **HIGH**

#### [MEDIUM] Gap 5.3: No Payment Method Revenue Breakdown
- **Issue**: Cannot view total cash vs total card vs total UPI intake for daily bank deposit verification.
- **Severity**: **MEDIUM**

#### [LOW] Gap 5.4: No Discount Campaign ROI Analytics
- **Issue**: Discounts lack promo codes or campaign IDs.
- **Severity**: **LOW**

---

### 2.6 Customer Journey Analytics

#### [HIGH] Gap 6.1: Diners are Anonymous (No Guest Profiles)
- **Issue**: No customer ID, phone, or email is attached to `Session` or `Order`.
- **Impact**: Zero ability to calculate Repeat Diner Rate, Visit Frequency, or Customer LTV.
- **Severity**: **HIGH**

#### [MEDIUM] Gap 6.2: No Funnel Drop-off Tracking
- **Issue**: No tracking of QR scans, cart abandoned sessions, or payment aborts.
- **Severity**: **MEDIUM**

#### [LOW] Gap 6.3: No Diner Feedback / Rating Analytics
- **Issue**: No post-meal ratings or reviews captured.
- **Severity**: **LOW**

