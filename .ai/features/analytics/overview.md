# Analytics — Overview

## Business Purpose
Daily KPI dashboard for restaurant managers and platform admins. Provides financial, order, utilisation, SLA, and platform-level funnel metrics scoped to a `businessDate`.

## Metric Categories

| Category | Audience | Metrics |
|---|---|---|
| Financial | Restaurant manager | Revenue, tax, tips, discounts, refunds, AOV |
| Order | Restaurant manager | Order count, item count, avg items/order |
| SLA | Restaurant manager | Avg accept/ready/serve times |
| Utilisation | Restaurant manager | Table turns, avg session duration, occupancy % |
| Platform GMV | Platform admin | GMV, active tenants, MRR, onboarding funnel |

## Responsibilities
- `GET /api/v1/restaurants/:id/metrics/daily?date=YYYY-MM-DD` → `RestaurantDashboardResponse`
- `GET /api/v1/platform/metrics?date=YYYY-MM-DD` → `PlatformDashboardResponse`

## Architecture Notes
- SQLite lacks native `DATEDIFF` / window functions → SLA and occupancy metrics are computed in-memory in Node.js after a raw DB fetch.
- Assumed operating day = 720 minutes (12 hours) for occupancy percentage calculation.
- `businessDayCutoffHour` determines the day boundary for query filtering (applied at query time only; not applied when Sessions are created — see BUG-O2).

## Critical Limitation
> [!CAUTION]
> `Session.businessDate` is never set on creation (BUG-O2). All analytics queries filter by `businessDate` and will return zeros for all real production sessions until this is fixed.
