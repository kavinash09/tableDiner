# TableDiner Event-Driven Analytics Platform: Implementation Plan

**Document**: `implementation-plan.md`  
**Role**: Principal Systems Architect, Staff Software Engineer  
**Status**: Prioritized Engineering Backlog  
**Date**: 2026-10-09  

---

## 1. Backlog Overview & Phasing

This backlog translates the architectural blueprint into an actionable, incremental sequence of tasks. Following the project rules, no code or schema change will be applied until explicit review and sign-off.

```
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: FOUNDATION & EVENT STORE CAPTURE (Tasks 1.1 - 1.5)           │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 2: ASYNCHRONOUS PROJECTIONS & DUAL-READ (Tasks 2.1 - 2.4)        │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 3: PRODUCTION CUTOVER & OPERATIONAL DECOUPLING (Tasks 3.1 - 3.3) │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 4: SELF-SERVE ANALYTICS & SEMANTIC QUERY ENGINE (Tasks 4.1 - 4.4)│
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase 1: Foundation & Event Store Capture

### Task 1.1: Event Store Relational Model
- **Description**: Add `AnalyticsEvent` and `AnalyticsProjectorCheckpoint` models to Prisma schema. Run non-destructive migration.
- **Affected Files**:
  - `packages/db/prisma/schema.prisma`
  - `packages/db/README.md`
- **Risk**: P1 (Schema addition, zero changes to existing operational tables).
- **Dependencies**: None.
- **Estimated Complexity**: 2 Story Points.
- **Testing Requirements**: Migration verification test, verify composite indices created.
- **Migration Requirements**: Run `npx prisma db push` or create Prisma migration script.

---

### Task 1.2: Domain Event Type Contracts
- **Description**: Define TypeScript interfaces and Zod schemas for all domain event payloads in `packages/shared-types` and `packages/shared-validation`.
- **Affected Files**:
  - `packages/shared-types/src/index.ts`
  - `packages/shared-validation/src/index.ts`
- **Risk**: P2 (Contract definition).
- **Dependencies**: Task 1.1.
- **Estimated Complexity**: 3 Story Points.
- **Testing Requirements**: Schema parse unit tests for each event payload type.
- **Migration Requirements**: None.

---

### Task 1.3: Event Store Port & Secondary Adapter
- **Description**: Create `IEventStoreRepository` port in core and implement `PrismaEventStoreRepository` in secondary database adapters. Supports appending events, checking idempotency, and streaming batches by offset.
- **Affected Files**:
  - `apps/api/src/core/ports/EventStoreRepository.ts`
  - `apps/api/src/adapters/secondary/db/PrismaEventStoreRepository.ts`
- **Risk**: P1.
- **Dependencies**: Task 1.1, Task 1.2.
- **Estimated Complexity**: 3 Story Points.
- **Testing Requirements**: Unit tests for appending events, duplicate idempotency rejection, and chronological batch retrieval.
- **Migration Requirements**: None.

---

### Task 1.4: Instrument Operational Transactions with Outbox Appends
- **Description**: Update `PrismaRepositories.ts` to append domain events within existing `prisma.$transaction` calls during session open/close, order placement, order status transitions, and payment completion.
- **Affected Files**:
  - `apps/api/src/adapters/secondary/db/PrismaRepositories.ts`
  - `apps/api/src/__tests__/SessionCheckout.integration.test.ts`
  - `apps/api/src/__tests__/OrderLifecycle.integration.test.ts`
- **Risk**: P0 (Touches core operational transactions).
- **Dependencies**: Task 1.3.
- **Estimated Complexity**: 5 Story Points.
- **Testing Requirements**: Integration tests verifying that operational mutations and event appends commit atomically; verify rollback if either fails.
- **Migration Requirements**: Silent capture (no changes to read queries).

---

### Task 1.5: Historical Event Backfill Utility
- **Description**: Create script `packages/db/scripts/backfill-historical-events.ts` to synthesize baseline `dining.session.closed`, `kitchen.order.served`, and `payment.settlement.completed` events for legacy records.
- **Affected Files**:
  - `packages/db/scripts/backfill-historical-events.ts`
  - `apps/api/src/__tests__/HistoricalBackfill.integration.test.ts`
- **Risk**: P2 (Offline script, idempotent).
- **Dependencies**: Task 1.4.
- **Estimated Complexity**: 3 Story Points.
- **Testing Requirements**: Idempotency test (running twice produces zero duplicates).
- **Migration Requirements**: Standalone execution in dev and staging.

---

## 3. Phase 2: Asynchronous Projections & Dual-Read Verification

### Task 2.1: Materialized Read Models Schema
- **Description**: Add projection tables `AggDailyFinancialSummary`, `AggDailySlaSummary`, `AggTableUtilizationSummary`, and `AggDishSalesSummary` to Prisma schema.
- **Affected Files**:
  - `packages/db/prisma/schema.prisma`
- **Risk**: P1.
- **Dependencies**: Task 1.1.
- **Estimated Complexity**: 3 Story Points.
- **Testing Requirements**: Database schema verification test.
- **Migration Requirements**: Prisma migration script.

---

### Task 2.2: Outbox Relay Daemon & Asynchronous Dispatcher
- **Description**: Implement `OutboxRelayDaemon` background worker that polls unforwarded `AnalyticsEvent` rows using UUIDv7 cursor pagination and dispatches to registered projectors.
- **Affected Files**:
  - `apps/api/src/core/services/OutboxRelayDaemon.ts`
  - `apps/api/src/index.ts`
- **Risk**: P1.
- **Dependencies**: Task 2.1.
- **Estimated Complexity**: 5 Story Points.
- **Testing Requirements**: Polling interval test, checkpoint persistence test, error handling & retry backoff tests.
- **Migration Requirements**: Runs in background without blocking API request threads.

---

### Task 2.3: Implement Domain Projectors
- **Description**: Implement specialized projectors that incrementally update materialized summary tables:
  - `FinancialProjector`
  - `KitchenSlaProjector`
  - `UtilizationProjector`
  - `DishSalesProjector`
- **Affected Files**:
  - `apps/api/src/core/projectors/FinancialProjector.ts`
  - `apps/api/src/core/projectors/KitchenSlaProjector.ts`
  - `apps/api/src/core/projectors/UtilizationProjector.ts`
  - `apps/api/src/core/projectors/DishSalesProjector.ts`
- **Risk**: P1.
- **Dependencies**: Task 2.2.
- **Estimated Complexity**: 5 Story Points.
- **Testing Requirements**: Unit tests for each projector verifying mathematical formulas and running averages.
- **Migration Requirements**: None.

---

### Task 2.4: Dual-Read Comparator & Automated Parity Test Suite
- **Description**: Create shadow verification adapter that executes both the legacy operational queries and the event projection lookups, logging any discrepancies.
- **Affected Files**:
  - `apps/api/src/adapters/secondary/db/DualReadAnalyticsComparator.ts`
  - `apps/api/src/__tests__/AnalyticsParity.integration.test.ts`
- **Risk**: P1.
- **Dependencies**: Task 2.3.
- **Estimated Complexity**: 5 Story Points.
- **Testing Requirements**: Automated parity suite running across 1,000 synthetic sessions verifying 100% numerical match.
- **Migration Requirements**: Dark-launch shadow execution in staging/dev.

---

## 4. Phase 3: Production Cutover & Operational Decoupling

### Task 3.1: Event Projection Analytics Repository
- **Description**: Implement `EventProjectionAnalyticsRepository` satisfying `RestaurantAnalyticsRepository` port by reading directly from `AggDailyFinancialSummary`, `AggDailySlaSummary`, etc. via $O(1)$ key lookups.
- **Affected Files**:
  - `apps/api/src/adapters/secondary/db/EventProjectionAnalyticsRepository.ts`
- **Risk**: P1.
- **Dependencies**: Task 2.4.
- **Estimated Complexity**: 3 Story Points.
- **Testing Requirements**: Contract adherence unit tests.
- **Migration Requirements**: None.

---

### Task 3.2: Dashboard Wiring & Feature Flag Cutover
- **Description**: Introduce `FEATURE_EVENT_ANALYTICS_PRIMARY` env configuration in `config.ts`. In `index.ts`, conditionally inject `EventProjectionAnalyticsRepository` into `GetRestaurantDashboardUseCase` and `GetPlatformDashboardUseCase`.
- **Affected Files**:
  - `apps/api/src/config.ts`
  - `apps/api/src/index.ts`
- **Risk**: P0.
- **Dependencies**: Task 3.1.
- **Estimated Complexity**: 3 Story Points.
- **Testing Requirements**: End-to-end integration tests for dashboard endpoints with flag enabled and disabled.
- **Migration Requirements**: Enable flag in staging, verify performance, then enable in production.

---

### Task 3.3: Operational Load & Latency Verification
- **Description**: Benchmark dashboard response times before and after cutover under simulated 1,000 concurrent dining orders.
- **Affected Files**:
  - `apps/api/src/__tests__/AnalyticsPerformance.benchmark.ts`
- **Risk**: P2.
- **Dependencies**: Task 3.2.
- **Estimated Complexity**: 2 Story Points.
- **Testing Requirements**: Measure and assert p95 latency drops below 10ms.
- **Migration Requirements**: Document performance gains in `.ai/DECISIONS.md`.

---

## 5. Phase 4: Self-Serve Analytics & Semantic Query Engine

### Task 4.1: Universal Analytics Query DSL & Validator
- **Description**: Add `AnalyticsQuerySchema` and response DTO types to `@tablediner/shared-validation` and `@tablediner/shared-types`.
- **Affected Files**:
  - `packages/shared-validation/src/index.ts`
  - `packages/shared-types/src/index.ts`
- **Risk**: P2.
- **Dependencies**: None.
- **Estimated Complexity**: 3 Story Points.
- **Testing Requirements**: Zod validation test cases for valid and malicious query payloads.
- **Migration Requirements**: None.

---

### Task 4.2: Semantic Query Compiler & API Endpoint
- **Description**: Implement `SemanticQueryCompiler` and expose Fastify route `POST /api/v1/analytics/query`. Secure with tenant-scoping authorization.
- **Affected Files**:
  - `apps/api/src/core/services/SemanticQueryCompiler.ts`
  - `apps/api/src/index.ts`
- **Risk**: P1.
- **Dependencies**: Task 4.1.
- **Estimated Complexity**: 5 Story Points.
- **Testing Requirements**: Compiler unit tests verifying safe SQL generation and SQL-injection immunity.
- **Migration Requirements**: New endpoint, zero impact on existing routes.

---

### Task 4.3: Dynamic Analytics Explorer UI Widgets
- **Description**: Build new visual reporting components in `restaurant-admin` and `platform-admin`:
  - Dish Popularity & Margin Matrix
  - Hourly Rush Hour Heatmap
  - Category Revenue Contribution Breakdown
  - Table Turn Velocity Chart
- **Affected Files**:
  - `apps/restaurant-admin/src/components/AnalyticsExplorer.tsx`
  - `apps/restaurant-admin/src/App.tsx`
  - `apps/platform-admin/src/components/AnalyticsExplorer.tsx`
- **Risk**: P2.
- **Dependencies**: Task 4.2.
- **Estimated Complexity**: 5 Story Points.
- **Testing Requirements**: Component unit tests and visual rendering checks.
- **Migration Requirements**: Integrated as new tab in admin portals.

---

### Task 4.4: Nightly EOD Reconciliation Job
- **Description**: Implement scheduled EOD reconciliation cron that calculates ground-truth figures from raw `AnalyticsEvent` records and flags any discrepancies against projection read models.
- **Affected Files**:
  - `apps/api/src/core/services/EodReconciliationJob.ts`
  - `apps/api/src/index.ts`
- **Risk**: P2.
- **Dependencies**: Task 3.2.
- **Estimated Complexity**: 3 Story Points.
- **Testing Requirements**: Cron trigger unit tests, simulated discrepancy self-healing tests.
- **Migration Requirements**: Add schedule definition in configuration.

---

## 6. Backlog Summary & Effort Estimation

| Phase | Tasks | Total Story Points | Estimated Timeline | Risk Level |
|---|---|---|---|---|
| **Phase 1: Foundation & Event Store Capture** | 1.1 – 1.5 | 16 SP | Sprint 1 | Low / Dark Launch |
| **Phase 2: Projections & Dual-Read Verification** | 2.1 – 2.4 | 18 SP | Sprint 2 | Low / Shadow Verification |
| **Phase 3: Production Cutover & Decoupling** | 3.1 – 3.3 | 8 SP | Sprint 3 | Medium / Flag Controlled |
| **Phase 4: Self-Serve Analytics & Semantic Engine**| 4.1 – 4.4 | 16 SP | Sprint 4 | Low / Feature Expansion |
| **Total** | **16 Tasks** | **58 Story Points** | **4 Sprints** | **Safe, Zero-Downtime** |

