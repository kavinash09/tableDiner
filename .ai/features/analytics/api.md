# Analytics — API

## Routes

### `GET /api/v1/restaurants/:id/metrics/daily`
Returns daily KPI dashboard for a single restaurant.

**Query param**: `date` (required) — `YYYY-MM-DD`

**Response** (`RestaurantDashboardResponse`)
```json
{
  "businessDate": "2024-01-15",
  "financial": {
    "totalRevenue": 0.0,
    "taxAmount": 0.0,
    "tipAmount": 0.0,
    "discountAmount": 0.0,
    "refundedAmount": 0.0,
    "averageOrderValue": 0.0
  },
  "orders": {
    "totalOrders": 0,
    "totalItems": 0,
    "averageItemsPerOrder": 0.0
  },
  "sla": {
    "avgAcceptTimeMinutes": 0.0,
    "avgReadyTimeMinutes": 0.0,
    "avgServeTimeMinutes": 0.0
  },
  "utilisation": {
    "tableTurns": 0,
    "avgSessionDurationMinutes": 0.0,
    "occupancyPercent": 0.0
  }
}
```

---

### `GET /api/v1/platform/metrics`
Returns platform-wide KPI dashboard (admin only in intent; no auth guard in place).

**Query param**: `date` (required) — `YYYY-MM-DD`

**Response** (`PlatformDashboardResponse`)
```json
{
  "businessDate": "2024-01-15",
  "gmv": 0.0,
  "mrr": 0.0,
  "activeTenants": 0,
  "onboardingFunnel": {
    "LEAD": 0, "ONBOARDING": 0, "ACTIVE": 0, "SUSPENDED": 0, "DECOMMISSIONED": 0
  }
}
```

**Gaps**
- No auth guard on either route.
- No caching.
- Missing `date` param not handled gracefully in all paths.
