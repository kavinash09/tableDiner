# TableDiner Analytics Processing Model & Asynchronous Projections

**Document**: `analytics-processing-model.md`  
**Role**: Principal Analytics Architect, Principal Systems Architect  
**Status**: Architecture & Data Processing Pipeline Specification  
**Date**: 2026-10-09  

---

## 1. Architectural Mandate: Strict Decoupling

The cardinal rule of this architectural migration is:

> **The operational system must never perform analytics calculations, and analytics processing must never impede operational workflows.**

In the legacy architecture, opening the Restaurant Admin Dashboard caused Fastify to execute heavy aggregation queries and SQL scans over live tables (`Session`, `Order`, `Payment`). In the new **Event-Driven Analytics Platform**, analytics calculations run **entirely asynchronously via Event Projections (CQRS Read Models)**.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               OPERATIONAL WRITE SIDE (OLTP)                            │
│                                                                                        │
│   Diner Web / Kitchen Tablet ──► Fastify API ──► Operational DB + AnalyticsEvent Log   │
└─────────────────────────────────────────────────────────┬──────────────────────────────┘
                                                          │ (Async Outbox Polling)
                                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              ANALYTICS PROCESSING LAYER (OLAP)                         │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                         Outbox Relay & Event Router                            │   │
│   └──────┬──────────────────────┬──────────────────────┬────────────────────┬──────┘   │
│          │                      │                      │                    │          │
│          ▼                      ▼                      ▼                    ▼          │
│   ┌──────────────┐      ┌──────────────┐       ┌──────────────┐      ┌─────────────┐   │
│   │  Financial   │      │ Kitchen SLA  │       │     Dish     │      │ Utilization │   │
│   │  Projector   │      │  Projector   │       │  Projector   │      │  Projector  │   │
│   └──────┬───────┘      └──────┬───────┘       └──────┬───────┘      └──────┬──────┘   │
│          │                      │                      │                    │          │
│          ▼                      ▼                      ▼                    ▼          │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                    Materialized Analytical Read Projections                    │   │
│   │   (DailyFinancialSummary, HourlyOrderSlaSummary, DishSalesSummary, TableTurn)  │   │
│   └─────────────────────────────────────┬──────────────────────────────────────────┘   │
└─────────────────────────────────────────┼──────────────────────────────────────────────┘
                                          │
                                          ▼ Instant O(1) Key-Lookup
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               ANALYTICS READ SIDE (SERVING)                            │
│                                                                                        │
│   Dashboard UI ──────────────► Fastify API ──────────► Instant Pre-Aggregated View     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Asynchronous Ingestion & Processing Pipeline

The pipeline consists of four decoupled stages:

### Stage 1: Outbox Event Polling (The Relay)
- An asynchronous daemon runs inside the API service (or standalone worker process) using an event loop tick or lightweight scheduler interval (every 500ms–1000ms).
- Queries `AnalyticsEvent` for rows with `id > lastProcessedEventId` ordered by `id ASC` (using UUIDv7 natural chronological sorting).
- Dispatches batches of events (e.g., 100 events per tick) to registered **Domain Projectors**.

### Stage 2: Event Routing & Projector Distribution
The Event Router inspects `eventName` and forwards events to registered subscribers:

| Event Name | Subscribed Projectors |
|---|---|
| `dining.session.opened` | `UtilizationProjector` |
| `dining.session.closed` | `FinancialProjector`, `UtilizationProjector` |
| `kitchen.order.placed` | `DishProjector`, `CategoryProjector` |
| `kitchen.order.accepted` | `KitchenSlaProjector` |
| `kitchen.order.ready` | `KitchenSlaProjector` |
| `kitchen.order.served` | `KitchenSlaProjector`, `DishProjector` |
| `kitchen.order.cancelled` | `DishProjector`, `KitchenSlaProjector` |
| `payment.settlement.completed` | `FinancialProjector` |

### Stage 3: Incremental State Projection (CQRS Materialized Views)
Each projector updates pre-aggregated read models in atomic database transactions.
Crucially, **aggregations are incremental ($O(1)$ updates)**:
- When a `dining.session.closed` event arrives with `totalAmount: 500`:
  $$\text{grossRevenue} \leftarrow \text{grossRevenue} + 500$$
  $$\text{closedSessionsCount} \leftarrow \text{closedSessionsCount} + 1$$
- No full-table recalculation or historical scan is ever executed!

### Stage 4: Checkpointing & Watermarking
- The processor maintains a single watermark record per projector:
  ```prisma
  model AnalyticsProjectorCheckpoint {
    projectorName   String   @id // e.g. "FinancialProjector"
    lastEventId     String   // UUIDv7 of latest processed event
    lastOccurredAt  DateTime
    updatedAt       DateTime @updatedAt
  }
  ```
- If the server restarts or crashes, processing resumes precisely from `lastEventId` without skipping or double-counting facts.

---

## 3. Dedicated Materialized Read Models (OLAP Tables)

Rather than querying operational tables, dashboard endpoints read from these optimized read models:

### 3.1 `AggDailyFinancialSummary`
```prisma
model AggDailyFinancialSummary {
  id              String   @id // Composite: `${tenantId}:${restaurantId}:${businessDate}`
  tenantId        String
  restaurantId    String
  businessDate    String
  
  grossRevenue    Float    @default(0.0)
  netRevenue      Float    @default(0.0)
  totalTax        Float    @default(0.0)
  totalTips       Float    @default(0.0)
  totalDiscounts  Float    @default(0.0)
  refundedAmount  Float    @default(0.0)
  closedSessions  Int      @default(0)
  avgTicketSize   Float    @default(0.0)
  
  updatedAt       DateTime @updatedAt

  @@index([tenantId, businessDate])
}
```

### 3.2 `AggDailySlaSummary`
```prisma
model AggDailySlaSummary {
  id                  String   @id // Composite: `${tenantId}:${restaurantId}:${businessDate}`
  tenantId            String
  restaurantId        String
  businessDate        String
  
  totalServedOrders   Int      @default(0)
  totalCancelledOrders Int     @default(0)
  
  // Running sums in minutes for incremental average computation
  sumKitchenPrepMinutes   Float @default(0.0)
  sumServiceMinutes       Float @default(0.0)
  sumFulfillmentMinutes   Float @default(0.0)
  
  avgKitchenPrepMinutes   Float @default(0.0)
  avgServiceMinutes       Float @default(0.0)
  avgFulfillmentMinutes   Float @default(0.0)

  updatedAt           DateTime @updatedAt

  @@index([tenantId, businessDate])
}
```

### 3.3 `AggDishSalesSummary`
```prisma
model AggDishSalesSummary {
  id              String   @id // Composite: `${restaurantId}:${businessDate}:${menuItemId}`
  tenantId        String
  restaurantId    String
  businessDate    String
  menuItemId      String
  itemName        String
  categoryId      String
  categoryName    String
  
  quantitySold    Int      @default(0)
  grossRevenue    Float    @default(0.0)
  voidedQuantity  Int      @default(0)

  updatedAt       DateTime @updatedAt

  @@index([restaurantId, businessDate])
  @@index([restaurantId, categoryId])
}
```

---

## 4. Serving Model: Instantaneous $O(1)$ Query Execution

When the Restaurant Dashboard loads:

```typescript
// Legacy Model: 4 heavy joins & full-table aggregations (50ms - 2000ms+)
const [financials, orders, utilization, slas] = await Promise.all([...]);

// Event-Driven Model: Instant single-row primary key lookup (< 2ms)
const summary = await prisma.aggDailyFinancialSummary.findUnique({
  where: { id: `${restaurantId}:${businessDate}` }
});
```

### Operational Performance Comparison:

| Metric | Legacy Report-Centric Model | Event-Driven Projection Model |
|---|---|---|
| **Query Complexity** | $O(N)$ table scan over all day's orders/sessions | $O(1)$ indexed lookup by primary key |
| **Response Latency** | 50ms – 2500ms (grows with volume) | **1ms – 3ms (constant time)** |
| **Database Locks** | Shared locks on active operational tables | Zero locks on operational tables |
| **Node.js Memory** | Buffer allocations for raw rows | Single flat DTO |
| **Dashboard Polling Impact** | CPU & I/O contention during peak hours | Negligible impact on database |

---

## 5. Graceful Degradation & Failure Isolation

1. **Complete Write Immunity**: If the event projector fails or stalls, diners can still place orders, food can still be cooked in the kitchen, and bills can still be paid. The operational system has zero dependency on projector uptime.
2. **Deterministic Replayability**: Because all events are preserved in the immutable `AnalyticsEvent` store, any projection table can be dropped, recreated, and fully reconstructed from scratch at any time by replaying events from genesis ($t=0$).
3. **Self-Healing Catchup**: If the API server is restarted during high traffic, the outbox worker resumes at `lastEventId` and catches up all projections to real-time within seconds.

