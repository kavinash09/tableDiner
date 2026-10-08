# TableDiner Analytics Architecture: Migration Strategy & Roadmap

**Document**: `analytics-migration-roadmap.md`  
**Role**: Principal Systems Architect, Staff Software Engineer  
**Status**: 4-Phase Zero-Downtime Migration Blueprint  
**Date**: 2026-10-09  

---

## 1. Migration Philosophy: Zero Breaking Changes

To evolve TableDiner from its current report-centric model to an event-driven analytics platform without disrupting active restaurant operations, we follow the **Strangler Fig Pattern**.

### Guarantees During Migration:
1. **API Backward Compatibility**: The existing HTTP endpoints (`GET /api/v1/restaurants/:id/metrics/daily`, `GET /api/v1/restaurants/:id/audit/eod`, `GET /api/v1/platform/metrics`) will continue returning the exact same response shapes.
2. **Zero Downtime**: Operational transactions (`placeOrder`, `processCheckout`, `updateOrderStatus`) continue executing without interruption.
3. **Dual-Read Verification**: No cutover occurs until the event projections achieve **100.00% mathematical parity** against the legacy operational queries over an automated verification period.
4. **Instant Rollback**: Every phase is controlled by a dynamic environment feature flag (`ENABLE_EVENT_DRIVEN_ANALYTICS=false`).

---

## 2. The 4-Phase Migration Roadmap

```
Phase 1: Foundation & Event Capture (Dark Launch)
├── Add `AnalyticsEvent` outbox schema to Prisma
├── Instrument use cases & repositories with domain event creation
└── Emit events inside operational transactions (Silent Capture)

Phase 2: Asynchronous Projection & Dual-Read Verification
├── Implement Outbox Relay Daemon & Projection Workers
├── Build Materialized Read Models (AggDailyFinancialSummary, etc.)
└── Dual-Read Comparator: Run shadow verification & automated parity tests

Phase 3: Production Cutover & Operational Table Decoupling
├── Switch Dashboard APIs to serve from Materialized Projections
├── Free operational tables from analytical query overhead
└── Verify latency drop from >200ms to <3ms

Phase 4: Self-Serve Analytics & Semantic Layer Rollout
├── Expose `POST /api/v1/analytics/query` (Universal Query DSL)
├── Deploy dynamic charting UI in Restaurant & Platform Admin
└── Enable custom date ranges, dish popularity, and hourly slicing
```

---

## 3. Detailed Phase Breakdown

---

### Phase 1: Foundation & Event Store Capture (Dark Launch)

- **Objective**: Establish the immutable event store and start capturing domain events at transaction boundaries without altering existing read queries.
- **Actions**:
  1. Add `model AnalyticsEvent` to `packages/db/prisma/schema.prisma` with indices on `[tenantId, restaurantId, occurredAt]`.
  2. Implement `IEventStoreRepository` port in `apps/api/src/core/ports/EventStoreRepository.ts`.
  3. Update `PrismaRepositories.ts` to append domain events within existing `prisma.$transaction` blocks for:
     - `createActiveSession` → `dining.session.opened`
     - `createOrder` → `kitchen.order.placed`
     - `updateOrderStatus` → `kitchen.order.accepted`, `kitchen.order.ready`, `kitchen.order.served`, `kitchen.order.cancelled`
     - `processCheckout` → `dining.session.closed`, `payment.settlement.completed`
  4. Run backfill script to synthesize baseline historical events from historical sessions and orders.
- **Operational Impact**: Negligible (< 1.5ms overhead per transaction for single append). Existing analytics endpoints remain 100% on legacy queries.

---

### Phase 2: Asynchronous Projection & Dual-Read Verification

- **Objective**: Build the asynchronous processing pipeline and verify that event-driven aggregations match legacy reports to the penny.
- **Actions**:
  1. Implement `OutboxRelayDaemon` to poll unforwarded `AnalyticsEvent` rows.
  2. Implement Domain Projectors:
     - `FinancialProjector` → writes to `AggDailyFinancialSummary`
     - `KitchenSlaProjector` → writes to `AggDailySlaSummary`
     - `UtilizationProjector` → writes to `AggTableUtilizationSummary`
     - `DishProjector` → writes to `AggDishSalesSummary`
  3. Implement **Shadow Dual-Read Comparator**:
     - Fastify route handler calls both legacy `PrismaRestaurantAnalyticsRepository` and new `EventProjectionRepository`.
     - Logs any numerical discrepancy between the two results.
     - Automated test suite runs across 5,000 synthetic test transactions verifying parity.
- **Exit Criteria**: 7 consecutive days of zero discrepancies across all metrics.

---

### Phase 3: Production Cutover & Operational Decoupling

- **Objective**: Switch serving traffic to the pre-aggregated materialized projections, completely releasing operational tables from analytics contention.
- **Actions**:
  1. Enable feature flag `FEATURE_EVENT_ANALYTICS_PRIMARY=true`.
  2. `GetRestaurantDashboardUseCase` queries `AggDailyFinancialSummary`, `AggDailySlaSummary`, and `AggTableUtilizationSummary` via primary key lookups.
  3. Legacy query methods are retained in the codebase as fallback adapters.
  4. Measure latency drop and verify database CPU/memory stability during peak dinner rush.
- **Success Metrics**: Dashboard response latency drops to under 5ms; zero table locks on `Session` or `Order` during analytics reads.

---

### Phase 4: Self-Serve Analytics & Advanced Projections

- **Objective**: Roll out the Semantic Query Engine and dynamic dashboard visualization.
- **Actions**:
  1. Deploy `POST /api/v1/analytics/query` endpoint with Zod-validated Query DSL.
  2. Implement Semantic Query Compiler translating DSL into optimized SQL.
  3. Build new interactive widgets in `apps/restaurant-admin` and `apps/platform-admin`:
     - Dish Popularity & Margin Matrix
     - Category Revenue Contribution Pie Chart
     - Hourly Rush Hour Heatmap (00:00 - 23:00)
     - Table Turn Velocity Leaderboard
     - Diner QR-to-Order Conversion Funnel
- **Outcome**: TableDiner achieves complete, self-serve analytical autonomy.

---

## 4. Rollback Strategy & Risk Mitigation

| Failure Scenario | Automated Safeguard | Rollback Action |
|---|---|---|
| **Outbox Relay Stalls / Crashes** | Circuit breaker detects projector lag $> 60 \text{ seconds}$. | Automatically falls back to legacy operational query path. Alerts admin. |
| **Data Discrepancy Detected** | Dual-read comparator flags $> ₹0.01$ variance. | Replays projector from checkpoint; serves legacy query response until reconciled. |
| **Database Contention During Event Writes** | High-concurrency write stress test. | Outbox writes are decoupled to an in-memory buffer or WAL queue if SQLite lock contention occurs. |
| **Critical Regression in Production** | Feature flag check at startup and per-request. | Set `FEATURE_EVENT_ANALYTICS_PRIMARY=false` in `.env` — instant rollback with zero code deployment or server restart needed. |

