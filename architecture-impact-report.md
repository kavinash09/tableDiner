# TableDiner Event-Driven Analytics: Architecture Impact Report

**Document**: `architecture-impact-report.md`  
**Role**: Principal Architect  
**Status**: Comprehensive Impact Assessment  
**Date**: 2026-10-09  

---

## 1. Executive Summary

This report evaluates the systemic impact of evolving TableDiner from a synchronous report-centric model (where Fastify route handlers query relational operational tables on demand) to an asynchronous event-driven model (where business transactions append immutable events and read models are updated out-of-band).

The assessment spans all 8 architectural dimensions of the TableDiner system.

---

## 2. Deep Impact Analysis Across 8 Architectural Dimensions

---

### 2.1 Backend Architecture

- **Current State**:
  Monolithic Fastify API server (`apps/api/src/index.ts`). Routes receive HTTP requests, parse inputs via Zod, and delegate directly to use cases (`AppUseCases`, `GetRestaurantDashboardUseCase`). Dashboard endpoints trigger synchronous database aggregations (`PrismaRestaurantAnalyticsRepository`) using `prisma.session.aggregate`, `prisma.order.groupBy`, and raw SQL queries via `$queryRaw`.
- **Required Future State**:
  Dual-path backend architecture adhering strictly to Hexagonal Architecture:
  1. *Command Path (OLTP)*: Fastify routes invoke Use Cases $\to$ Domain Entities mutate state $\to$ Secondary DB Adapters write operational entities AND append outbox events in a single transaction.
  2. *Query Path (OLAP)*: Dashboard endpoints query pre-aggregated, materialized read models via instantaneous primary-key lookups ($O(1)$).
  3. *Background Relay*: An asynchronous worker daemon (`OutboxRelayDaemon`) runs on an event-loop interval, dispatching unforwarded events to domain projectors.
- **Infrastructure Changes**:
  Zero external infrastructure required for Phase 1. Worker runs as an in-process background daemon managed within Fastify's lifecycle hooks (`app.addHook('onReady', ...)` and `app.addHook('onClose', ...)`).
- **Code Changes**:
  - Add `apps/api/src/core/ports/EventStoreRepository.ts`
  - Add `apps/api/src/adapters/secondary/db/PrismaEventStoreRepository.ts`
  - Add `apps/api/src/core/services/OutboxRelayDaemon.ts`
  - Add domain projectors (`FinancialProjector`, `KitchenSlaProjector`, `UtilizationProjector`, `DishSalesProjector`)
  - Modify `PrismaRepositories.ts` to include outbox event appends within `prisma.$transaction`
- **Schema Changes**:
  Add `AnalyticsEvent` outbox table and `AnalyticsProjectorCheckpoint` table to `schema.prisma`.
- **Testing Changes**:
  Add unit tests for projectors, integration tests for outbox transaction atomicity, and cursor pagination verification tests.
- **Migration Risks**:
  Outbox polling could contend with operational queries if polling intervals are too aggressive.
- **Operational Risks**:
  If the background daemon encounters an unhandled exception and crashes, projections stall (eventual consistency lag grows).
- **Developer Experience Impact**:
  Low-to-moderate. Developers must remember to append domain events when adding new transactional state transitions.

---

### 2.2 Database Architecture

- **Current State**:
  Single SQLite database (`packages/db/prisma/tablediner.db`) accessed via Prisma ORM singleton. Schema contains 12 operational models (`Tenant`, `Restaurant`, `Table`, `MenuCategory`, `MenuItem`, `Session`, `Order`, `OrderItem`, `Payment`, `User`, `Account`, `Subscription`).
- **Required Future State**:
  Single SQLite database with Write-Ahead Logging (WAL) enabled, partitioned logically into:
  - *Operational Tables* (`Session`, `Order`, `Payment`, etc.)
  - *Append-Only Event Log* (`AnalyticsEvent`)
  - *Materialized Read Models* (`AggDailyFinancialSummary`, `AggDailySlaSummary`, `AggDishSalesSummary`, `AggTableUtilizationSummary`)
- **Infrastructure Changes**:
  Ensure SQLite `PRAGMA journal_mode = WAL;` and `PRAGMA busy_timeout = 5000;` are configured at startup to eliminate table lock contention between outbox appends and background relay reads.
- **Code Changes**:
  Configure Prisma connection string or execution hooks with WAL pragmas.
- **Schema Changes**:
  - Add `AnalyticsEvent` table with indexes on `[tenantId, restaurantId, occurredAt]`, `[occurredAt]`, `[eventName]`.
  - Add projection summary tables.
- **Testing Changes**:
  Database concurrency integration test simulating simultaneous dining checkout writes and outbox polling reads.
- **Migration Risks**:
  Increased database file size growth due to immutable append-only event records.
- **Operational Risks**:
  SQLite database file vacuuming and WAL checkpoint management required over multi-month operating horizons.
- **Developer Experience Impact**:
  Minimal. Prisma migrations handle schema synchronization seamlessly.

---

### 2.3 Domain Model

- **Current State**:
  Domain entities (`apps/api/src/core/domain/TableSession.ts`, `Order.ts`) exist but are largely anaemic. `AppUseCases.ts` and `PrismaRepositories.ts` perform most mutations directly against raw Prisma client objects.
- **Required Future State**:
  Rich Domain Entities (enforcing Rule 21). Entities encapsulate business rules, state invariants, and **stage Domain Events internally**:
  ```typescript
  class Order extends BaseEntity {
    public markServed(): void {
      if (this.status !== 'READY') throw new Error('Cannot serve unready order');
      this.status = 'SERVED';
      this.servedAt = new Date();
      this.recordDomainEvent(new OrderServedEvent({ orderId: this.id, ... }));
    }
  }
  ```
  Repositories extract and commit staged domain events into the outbox.
- **Infrastructure Changes**:
  None.
- **Code Changes**:
  Refactor `TableSession` and `Order` entities to support domain event staging via `recordDomainEvent()` and `pullDomainEvents()`.
- **Schema Changes**:
  None.
- **Testing Changes**:
  Pure unit tests asserting that domain entities emit correct event payloads upon valid transitions and throw on invalid transitions.
- **Migration Risks**:
  Low. Domain logic refactoring can be completed incrementally use-case by use-case.
- **Operational Risks**:
  None. Pure in-memory TypeScript logic.
- **Developer Experience Impact**:
  **Significantly improved**. Domain logic becomes self-documenting, pure, and easily testable without mocking Prisma or database connections.

---

### 2.4 Lifecycle Management

- **Current State**:
  State changes occur via imperative procedural calls in `PrismaRepositories.ts` (`updateOrderStatus`, `processCheckout`). Timestamps are stamped directly on entity columns (`acceptedAt`, `readyAt`, `servedAt`, `closedAt`).
- **Required Future State**:
  Lifecycle transitions become the primary trigger for domain event production. State transitions are strictly monotonic and irreversible. Every transition generates a discrete, immutable fact.
- **Infrastructure Changes**:
  None.
- **Code Changes**:
  Hook domain event emission into:
  - Session lifecycle: Open $\to$ Reopen $\to$ Close $\to$ Finalize
  - Order lifecycle: Placed $\to$ Accepted $\to$ Ready $\to$ Served / Cancelled
  - Payment lifecycle: Initiated $\to$ Completed $\to$ Failed $\to$ Refunded
- **Schema Changes**:
  None on operational tables.
- **Testing Changes**:
  Regression tests verifying that skipped state transitions (e.g. `RECEIVED` $\to$ `SERVED`) are rejected and emit zero events.
- **Migration Risks**:
  Zero risk to operational flows because state validation is already enforced.
- **Operational Risks**:
  None.
- **Developer Experience Impact**:
  Clearer mental model of system behavior; state changes are auditable via event logs.

---

### 2.5 Analytics Calculations

- **Current State**:
  Calculations run synchronously during HTTP requests to `/metrics/daily`, `/audit/eod`, and `/platform/metrics`. Database scans rows on demand, computing sums, averages, and durations in SQL `$queryRaw`.
- **Required Future State**:
  Calculations occur **incrementally and asynchronously** in projectors. When an event arrives:
  $$\text{revenue}_{\text{new}} = \text{revenue}_{\text{current}} + \Delta_{\text{event}}$$
  $$\text{count}_{\text{new}} = \text{count}_{\text{current}} + 1$$
  $$\text{avg}_{\text{new}} = \text{sum}_{\text{new}} / \text{count}_{\text{new}}$$
  Dashboard APIs perform simple primary-key reads ($O(1)$) on pre-calculated projection rows.
- **Infrastructure Changes**:
  None for Phase 1.
- **Code Changes**:
  Implement projector classes: `FinancialProjector`, `KitchenSlaProjector`, `UtilizationProjector`, `DishSalesProjector`.
- **Schema Changes**:
  Materialized projection tables in `schema.prisma`.
- **Testing Changes**:
  Mathematical precision tests comparing projector incremental outputs against full-batch historical recalculations.
- **Migration Risks**:
  Discrepancy between legacy queries and projector outputs during initial deployment. Mitigated by Dual-Read verification phase.
- **Operational Risks**:
  Projections lagging behind operational state by 500ms–2000ms. Cashiers and managers must understand that dashboards update within ~1 second of transaction completion.
- **Developer Experience Impact**:
  Extremely positive. Dashboard routes become trivial 5-line findUnique queries.

---

### 2.6 Testing Strategy

- **Current State**:
  14 automated tests in Vitest covering route authentication, health, order lifecycle validation, checkout snapshotting, backfill idempotency, and SQL aggregation performance.
- **Required Future State**:
  Multi-tier testing pyramid tailored for event-driven systems:
  1. *Unit Tests*: Entity event emission, Projector mathematical increment logic.
  2. *Transactional Outbox Integration Tests*: Atomic commit and rollback verification.
  3. *Relay & Idempotency Tests*: Simulating duplicate event deliveries and asserting zero duplicate counting.
  4. *Dual-Read Parity Tests*: Automated tests verifying 100% numerical parity between legacy queries and projection read models across thousands of synthetic sessions.
- **Infrastructure Changes**:
  None. Runs in existing Vitest setup.
- **Code Changes**:
  Add `apps/api/src/__tests__/EventStore.integration.test.ts`, `Projector.unit.test.ts`, `DualReadParity.integration.test.ts`.
- **Schema Changes**:
  None.
- **Testing Changes**:
  Total test count expands from 14 to ~35 automated tests.
- **Migration Risks**:
  None. Tests guarantee safety.
- **Operational Risks**:
  None.
- **Developer Experience Impact**:
  Higher confidence during refactoring; bugs caught in pure unit tests before touching DB.

---

### 2.7 Deployment Architecture

- **Current State**:
  Pnpm workspaces monorepo. Fastify API runs as a single Node.js process (`tsx src/index.ts` on port 3001). Frontend apps run as Vite static SPAs on ports 5173, 5174, 5175.
- **Required Future State (Phase 1 & 2)**:
  Zero change to process topology! Fastify API process hosts the lightweight in-process outbox daemon using `setInterval` or Node.js `setImmediate` ticks. Zero separate worker services required.
- **Future State (Phase 3 - Enterprise Scale)**:
  Decouple the outbox relay and projectors into a dedicated worker process (`apps/worker`) running alongside `apps/api`.
- **Infrastructure Changes**:
  None for Phase 1.
- **Code Changes**:
  Lifecycle management in `apps/api/src/index.ts` to cleanly initialize and terminate the outbox daemon on `SIGTERM` / `SIGINT`.
- **Schema Changes**:
  None.
- **Testing Changes**:
  Graceful shutdown integration test verifying no event is partially committed during process termination.
- **Migration Risks**:
  Zero deployment disruption.
- **Operational Risks**:
  None. Single process model preserves simplicity.
- **Developer Experience Impact**:
  Identical startup workflow: `pnpm run dev` continues running everything.

---

### 2.8 Operational Complexity

- **Current State**:
  Low operational complexity. Standard relational queries. Zero asynchronous state to monitor. If a query is slow, it blocks the HTTP request.
- **Required Future State**:
  Slightly higher operational awareness:
  - Eventual consistency lag (projector watermark tracking).
  - Dead Letter Queue (DLQ) inspection for poisoned events.
  - Periodic event store vacuuming/pruning for storage hygiene.
- **Infrastructure Changes**:
  None for Phase 1.
- **Code Changes**:
  Add health check metrics: expose `/health/analytics` returning projector lag in milliseconds.
- **Schema Changes**:
  `analytics_dlq_events` table for quarantined poison pills.
- **Testing Changes**:
  DLQ quarantine integration test.
- **Migration Risks**:
  Low. Fallback to legacy queries remains available.
- **Operational Risks**:
  Operators need visibility into whether the analytics pipeline is running.
- **Developer Experience Impact**:
  Provides complete audit logs of every event in the system, making debugging customer issues significantly easier.

---

## 3. Summary Assessment Matrix

| Dimension | Architectural Disruption | Complexity Delta | Business Value Unlocked |
|---|---|---|---|
| **Backend Architecture** | Low (Internal refactor) | +15% | High (CQRS decoupling, $O(1)$ reads) |
| **Database Architecture**| Low (Additive schema) | +10% | Very High (WAL mode, zero locks on OLTP) |
| **Domain Model** | Medium (Rich domain entities)| +10% | High (Encapsulated rules & event staging)|
| **Lifecycle Management** | Low (Hooks existing paths) | +5% | High (Immutable audit trace) |
| **Analytics Calculations**| High (Incremental projectors)| +20% | Exceptional (Sub-3ms dashboard loads) |
| **Testing Strategy** | Low (Vitest additions) | +15% | Very High (Deterministic parity tests) |
| **Deployment Architecture**| None (In-process daemon) | 0% | High (Zero infrastructure cost) |
| **Operational Complexity**| Low (Lag monitoring, DLQ) | +10% | High (Complete auditability & replay) |
