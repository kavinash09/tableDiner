# Analytics — Tests

## Existing Tests
**None.** 0 test files cover the analytics feature.

## Missing Tests

| Type | Description |
|---|---|
| Unit | `GetRestaurantDashboardUseCase` — mock repo, assert correct response shape for all metric categories |
| Unit | `GetRestaurantDashboardUseCase` — no closed sessions → all metrics are zero |
| Unit | `GetPlatformDashboardUseCase` — mock repo, assert GMV, MRR, funnel counts |
| Unit | `getFinancialMetrics` repo method — correct sum of revenue fields |
| Unit | `getOrderMetrics` repo method — correct order/item counts and averages |
| Unit | `getSlaMetrics` repo method — correct in-memory time-delta computation |
| Unit | `getUtilizationMetrics` repo method — occupancy % formula with 720-min operating day |
| Integration | `GET /api/v1/restaurants/:id/metrics/daily` — seeded closed sessions appear in response |
| Integration | `GET /api/v1/platform/metrics` — correct GMV and MRR aggregation |
| Regression | Sessions with null `businessDate` do not inflate metrics for any date |
