# Query Flexibility Audit

**Audit Date**: 2026-10-09  
**Auditor**: Principal Analytics Architect  
**Scope**: Flexibility, configurability, and dynamic query capabilities of TableDiner analytics endpoints.

---

## 1. Classification Overview

The current analytics implementation is categorized as **OVERWHELMINGLY HARDCODED**.

- **Query Flexibility Classification**: **STATIC / HARDCODED**
- **Dynamic Query Engine (GraphQL, SQL generator, Cube.js, Metabase)**: **NONE**
- **Ad-Hoc Query Capability**: **0%**

All calculations, SQL projections, and aggregation groupings are hardcoded in repository TypeScript files. Clients have zero control over dimensions, metrics, or filters beyond providing a single business day string.

---

## 2. Endpoint-by-Endpoint Flexibility Matrix

| Capability Question | `GET .../metrics/daily` | `GET .../audit/eod` | `GET .../audit/eod/export` | `GET .../platform/metrics` |
|---|---|---|---|---|
| **Classification** | **Hardcoded** | **Hardcoded** | **Hardcoded** | **Hardcoded** |
| **Can users change date ranges?** | ⚠️ Partial (Single day only) | ⚠️ Partial (Single day only) | ⚠️ Partial (Single day only) | ⚠️ Partial (Single day via query; UI hardcoded) |
| **Can users change multi-day range?** | ❌ No | ❌ No | ❌ No | ❌ No |
| **Can users change grouping / granularity?** | ❌ No | ❌ No | ❌ No | ❌ No |
| **Can users filter by table?** | ❌ No | ❌ No | ❌ No | ❌ Not applicable |
| **Can users filter by menu item?** | ❌ No | ❌ No | ❌ No | ❌ Not applicable |
| **Can users filter by category?** | ❌ No | ❌ No | ❌ No | ❌ Not applicable |
| **Can users filter by session status?** | ❌ No | ❌ No | ❌ No | ❌ No |
| **Can users compare periods (WoW / MoM)?**| ❌ No | ❌ No | ❌ No | ❌ No |
| **Can users select custom metrics?** | ❌ No | ❌ No | ❌ No | ❌ No |
| **Can users sort results dynamically?** | ❌ No | ❌ No (Hardcoded `closedAt asc`) | ❌ No | ❌ No |

---

## 3. Detailed Endpoint Findings

### 3.1 `GET /api/v1/restaurants/:id/metrics/daily`
- **Flexibility Level**: **Hardcoded**
- **Date Control**: Only accepts `?date=YYYY-MM-DD`. If omitted, defaults to UTC current day. Cannot query date ranges (e.g. `startDate=...&endDate=...`), weeks, months, or quarters.
- **Operating Day Assumption**: Hardcoded to `ASSUMED_OPERATING_MINUTES = 720` (12 hours) in `GetRestaurantDashboardUseCase.ts` Line 13. Restaurants open for 16 hours or 8 hours will have inaccurate occupancy metrics.
- **Filtering**: Cannot isolate lunch vs dinner shifts, cannot filter by section (Patio vs Dining Room), cannot filter by VIP tables.
- **Dimensionality**: Fixed response payload of 4 fixed sub-objects (`financials`, `orders`, `utilization`, `slas`). No field selection or sparse fieldsets supported.

---

### 3.2 `GET /api/v1/restaurants/:id/audit/eod`
- **Flexibility Level**: **Hardcoded**
- **Sorting**: Hardcoded to `orderBy: { closedAt: 'asc' }` in `PrismaRestaurantAnalyticsRepository.ts` Line 158. Clients cannot sort by amount, guest count, or table name.
- **Pagination**: ❌ **No pagination**. Executes `findMany` across all closed sessions for the day. For high-volume restaurants with 1,000+ sessions/day, this will cause memory pressure and API payload bloating.
- **Filtering**: Always excludes `OPEN` sessions (`status: { not: 'OPEN' }`). Cannot query open tabs for midday audits.

---

### 3.3 `GET /api/v1/restaurants/:id/audit/eod/export`
- **Flexibility Level**: **Hardcoded**
- **Columns**: Exactly 11 fixed CSV columns hardcoded in `CsvExportAdapter.ts` Line 24.
- **Delimiters / Format**: Hardcoded comma delimiter and RFC-4180 quotes. No option for TSV, Excel (.xlsx), or custom column selections.

---

### 3.4 `GET /api/v1/platform/metrics`
- **Flexibility Level**: **Hardcoded**
- **SaaS Metric Logic**:
  - `newMrr`: Hardcoded return value of `0` in `PrismaPlatformAnalyticsRepository.ts` Line 27.
  - `churnedMrr`: Hardcoded return value of `0` in Line 28.
  - `churnRate`: Calculated over all time (`canceled / (active + canceled)`). Cannot view 30-day trailing churn or cohort churn.
- **Tenant Funnel**: Static aggregation across all historical tenants. Cannot filter by signup month or partner channel.

