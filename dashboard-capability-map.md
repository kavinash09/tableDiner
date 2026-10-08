# Dashboard Capability Map

**Audit Date**: 2026-10-09  
**Auditor**: Principal Analytics Architect  
**Scope**: All UI dashboard views across `apps/restaurant-admin` and `apps/platform-admin`.

---

## 1. Overview

TableDiner currently contains two dedicated analytical dashboard views:
1. **Restaurant Admin Operations & EOD Dashboard** (`apps/restaurant-admin/src/components/Dashboard.tsx`)
2. **Platform Super-Admin Overview Dashboard** (`apps/platform-admin/src/components/Dashboard.tsx`)

In addition, an operational **Kitchen Kanban Board** exists in `apps/restaurant-admin/src/App.tsx`.

---

## 2. Dashboard 1: Restaurant Admin Dashboard

**Component File**: `apps/restaurant-admin/src/components/Dashboard.tsx`  
**Target User**: Restaurant Owner / General Manager / Shift Lead  
**Consumed Endpoints**:
- `GET /api/v1/restaurants/:id/metrics/daily?date=<YYYY-MM-DD>`
- `GET /api/v1/restaurants/:id/audit/eod?date=<YYYY-MM-DD>`

### 2.1 Visible Metrics
- **Financial Metrics (Cards Row 1)**:
  - Net Revenue (`₹<amount>`)
  - Gross Revenue (`₹<amount>`)
  - Avg Ticket Size (`₹<amount>`)
  - Tips Collected (`₹<amount>`)
- **Utilization & Orders (Cards Row 2)**:
  - Total Orders (Count)
  - Covers Served (Pax count)
  - Spend Per Head (`₹<amount>`)
  - Cancellation Rate (`<pct>%`, colored red if > 10%, green otherwise)
- **Service Level Agreements (Cards Row 3)**:
  - Avg Table Turn Time (`<min> min`)
  - Avg Kitchen Prep Time (`<min> min`)
  - Avg Order Fulfillment (`<min> min`)
- **End-of-Day Session Ledger (Table View)**:
  - Table Name
  - Guests (Pax)
  - Net Amount (`₹`)
  - Tax Amount (`₹`)
  - Tip Amount (`₹`)
  - Total Amount (`₹`)
  - Payment Methods (`CASH, CARD, UPI`)
  - Closed Timestamp
  - Session Status badge (`CLOSED`, `OPEN`, `FINALIZED`)

### 2.2 Available Filters
- ❌ **No Table Filter**: Cannot view metrics or sessions for a specific table.
- ❌ **No Payment Method Filter**: Cannot filter ledger by Cash/Card/UPI.
- ❌ **No Status Filter**: Cannot toggle between closed vs open sessions.
- ❌ **No Party Size Filter**: Cannot filter by guest count.

### 2.3 Available Date Ranges
- **Granularity**: Single Day only (`<input type="date" />`).
- **Default Value**: `new Date().toISOString().split('T')[0]` (today's calendar date).
- ❌ **No Multi-Day Range**: No support for 7-day, 30-day, MTD, or custom `startDate` / `endDate`.
- ❌ **No Period Comparison**: Cannot compare Today vs Yesterday or Same Day Last Week.

### 2.4 Available Groupings
- ❌ **No Grouping Controls**: Data is pre-aggregated to the restaurant total.
- ❌ **No Daypart / Hourly Breakdown**: Cannot view Lunch vs Dinner or hourly heatmaps.
- ❌ **No Server / Waiter Grouping**: Server attribution does not exist in schema.

### 2.5 Export Capabilities
- ✅ **CSV Export**: Direct download button targeting `GET /api/v1/restaurants/:id/audit/eod/export?date=<date>`. Produces RFC 4180 CSV with summary block and itemized sessions.
- ✅ **Print / PDF**: Browser `window.print()` trigger with CSS print stylesheet hiding screen controls (`print:hidden`).

---

## 3. Dashboard 2: Platform Admin Super-Dashboard

**Component File**: `apps/platform-admin/src/components/Dashboard.tsx`  
**Target User**: TableDiner SaaS Platform Super-Admin / Investor / Executive  
**Consumed Endpoints**:
- `GET /api/v1/platform/metrics` (Hardcoded without date query parameter in UI!)

### 3.1 Visible Metrics
- **SaaS Financials (Cards Row 1)**:
  - Monthly Recurring Revenue (MRR) (`₹<amount>`)
  - Annual Run Rate (ARR) (`₹<amount>`)
  - New MRR (`₹<amount>`, currently hardcoded to ₹0.00)
  - Churn Rate (`<pct>%`, colored red if > 5%, green otherwise)
- **Global Volume / GMV (Cards Row 2)**:
  - Total GMV Processed (`₹<amount>`)
  - Global Orders Processed (Count)
  - Global Sessions Processed (Count)
  - Average Order Value (`₹<amount>`)
- **Tenant Lifecycle Funnel (Cards Row 3)**:
  - Leads Count
  - Onboarding Count
  - Active Tenants Count (highlighted green)
  - Suspended Tenants Count (highlighted red)
  - Decommissioned Tenants Count

### 3.2 Available Filters
- ❌ **Zero Filters Available**: View is completely static and unfilterable.
- ❌ **No Tenant Filter**: Cannot drill down into an individual restaurant chain or brand.
- ❌ **No Subscription Tier Filter**: Cannot segment by Pilot, Basic, Enterprise.

### 3.3 Available Date Ranges
- ❌ **Zero Date Selection**: The UI component makes a static `fetch('${API_URL}/api/v1/platform/metrics')` without passing any `date` query parameter. It always defaults to server today.
- ❌ **No Historical Lookback**: Cannot view past GMV or past funnel snapshots.

### 3.4 Available Groupings
- ❌ **No Regional or Cohort Grouping**: All tenants globally are lumped together.

### 3.5 Export Capabilities
- ❌ **No Export Functionality**: No CSV, JSON, or print export available.

---

## 4. Operational View: Kitchen Kanban Board

**Component File**: `apps/restaurant-admin/src/App.tsx` (Lines 142–185)  
**Target User**: Kitchen Display System (KDS) / Line Cook  
**Polling Frequency**: Every 5000ms (`setInterval`)  
**Consumed Endpoints**:
- `GET /kitchen/orders` (Scoped to current restaurant)

### 4.1 Visible Operational Metrics
- Ticket counts per Kanban column (`RECEIVED`, `PREPARING`, `READY`).
- Ticket elapsed indicators (`#<last4_id>`, Table Name, Item breakdown with line instructions).
- ❌ **No SLA Warning Timers**: No visual cues (e.g. turning yellow after 10m, red after 15m).

