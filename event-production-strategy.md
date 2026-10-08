# TableDiner Event Production Strategy & Transaction Boundaries

**Document**: `event-production-strategy.md`  
**Role**: Principal Systems Architect, Staff Software Engineer  
**Status**: Architecture Pattern & Implementation Specification  
**Date**: 2026-10-09  

---

## 1. Architectural Problem: The Dual-Write Hazard

In distributed and event-driven architectures, the most common anti-pattern is the **Dual-Write Anti-Pattern**:

```
[ DUAL-WRITE ANTI-PATTERN: DO NOT IMPLEMENT ]

  HTTP Handler
      │
      ├─► 1. Write to Database (Prisma) ─────────► [ DB OK ]
      │
      └─► 2. Publish to Event Bus / Analytics ───► [ NETWORK / PROCESS CRASH ]
                                                   (CRITICAL DATA INCONSISTENCY!)
```

If the database write succeeds but the event emission fails (due to network timeout, broker unreachability, or process death), the operational system has moved forward, but the analytics platform has permanently missed the fact.

Conversely, if the event is emitted first and the database transaction fails, downstream analytics processes phantom data that does not exist in reality.

---

## 2. Chosen Pattern: The Transactional Outbox Pattern

To guarantee **100% consistency with zero dual-write vulnerabilities**, TableDiner adopts the **Transactional Outbox Pattern**:

```
[ TRANSACTIONAL OUTBOX PATTERN: MANDATORY STANDARD ]

  Domain Use Case / Secondary DB Adapter
      │
      ▼
  Prisma Interactive Transaction (prisma.$transaction)
      │
      ├───► 1. Commit Operational State (Session / Order / Payment)
      │
      └───► 2. Append Domain Event into Outbox (`AnalyticsEvent` table)
      │
      ▼
  [ ATOMIC COMMIT: BOTH SUCCEED OR BOTH ROLL BACK ]
      │
      ▼ (Asynchronous & Non-Blocking)
  Outbox Relay Daemon / Worker
      │
      ├─► 3. Poll / Read unforwarded events (`status = 'PENDING'`)
      ├─► 4. Dispatch to Async Event Bus / Analytics Projectors
      └─► 5. Mark event as `PROCESSED` (or update processed checkpoint)
```

### Architectural Guarantees:
1. **Zero Data Loss**: Operational state and analytics facts share the exact same ACID database transaction. If the operational write fails, no event is emitted. If the outbox write fails, the operational write is rolled back cleanly.
2. **Zero Operational Latency**: The client response (e.g. order placed, payment completed) does not wait for analytics calculations or event broker acknowledgements.
3. **At-Least-Once Delivery**: The outbox worker continuously retries until the event is acknowledged by all analytics projectors.

---

## 3. Emission Points Across Hexagonal Architecture

Following Rule 17 (Hexagonal Architecture / Ports and Adapters), event production is cleanly decoupled across architectural layers:

```
┌────────────────────────────────────────────────────────┐
│ PRIMARY ADAPTER (HTTP Fastify Routes)                 │
│ - Parses HTTP input, validates Zod schema, calls UC   │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ CORE DOMAIN (Use Cases & Rich Domain Entities)        │
│ - Business rules execute inside Entity (Rule 21)       │
│ - Entity records domain event internally:              │
│   `this.recordDomainEvent(new OrderPlacedEvent(...))` │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ SECONDARY ADAPTER (Prisma Database Repositories)      │
│ - Unrolls domain entity state into relational rows     │
│ - Writes operational entity AND outbox event in ONE    │
│   atomic `prisma.$transaction([opQuery, outboxQuery])`│
└────────────────────────────────────────────────────────┘
```

---

## 4. Workflows & Transaction Boundary Analysis

### 4.1 Dining Session Checkout & Settlement Workflow
- **Trigger**: Diner calls `POST /table/:qrCode/pay`
- **Method**: `PrismaPaymentRepository.processCheckout`
- **Atomic Transaction Boundary**:
  ```typescript
  return await this.prisma.$transaction(async (tx) => {
    // 1. Operational Mutation: Update Session to CLOSED + financial snapshots
    const session = await tx.session.update({
      where: { id: sessionId },
      data: {
        status: 'CLOSED',
        subtotal: calculatedSubtotal,
        totalAmount: paymentAmount,
        closedAt: new Date()
      }
    });

    // 2. Operational Mutation: Create COMPLETED Payment record
    const payment = await tx.payment.create({
      data: {
        tenantId: session.tenantId,
        sessionId: session.id,
        amount: paymentAmount,
        status: 'COMPLETED',
        method: paymentMethod
      }
    });

    // 3. Outbox Event 1: dining.session.closed
    await tx.analyticsEvent.create({
      data: {
        id: generateUUIDv7(),
        tenantId: session.tenantId,
        restaurantId: session.restaurantId,
        businessDate: session.businessDate,
        eventName: 'dining.session.closed',
        entityType: 'Session',
        entityId: session.id,
        correlationId: `ses-${session.id}`,
        idempotencyKey: `session:close:${session.id}`,
        occurredAt: session.closedAt,
        payload: JSON.stringify({
          sessionId: session.id,
          tableId: session.tableId,
          totalAmount: session.totalAmount,
          subtotal: session.subtotal,
          turnTimeMinutes: (session.closedAt.getTime() - session.createdAt.getTime()) / 60000.0
        }),
        metadata: JSON.stringify({ actorId: 'diner_web_client' })
      }
    });

    // 4. Outbox Event 2: payment.settlement.completed
    await tx.analyticsEvent.create({
      data: {
        id: generateUUIDv7(),
        tenantId: session.tenantId,
        restaurantId: session.restaurantId,
        businessDate: session.businessDate,
        eventName: 'payment.settlement.completed',
        entityType: 'Payment',
        entityId: payment.id,
        correlationId: `ses-${session.id}`,
        idempotencyKey: `payment:completed:${payment.id}`,
        occurredAt: payment.createdAt,
        payload: JSON.stringify({
          paymentId: payment.id,
          sessionId: session.id,
          amount: payment.amount,
          method: payment.method
        }),
        metadata: JSON.stringify({ actorId: 'payment_gateway' })
      }
    });

    return { session, payment };
  });
  ```

### 4.2 Order Placement Workflow
- **Trigger**: `POST /table/:qrCode/order`
- **Method**: `PrismaOrderRepository.createOrder`
- **Atomic Transaction Boundary**:
  - Creates/verifies `Session`.
  - Creates `Order` with `status: 'RECEIVED'`.
  - Creates `OrderItem` array with snapshotted `unitPrice` and `lineTotal`.
  - Creates `AnalyticsEvent` (`kitchen.order.placed`) containing full nested item array snapshot.

### 4.3 Kitchen SLA Status Progression Workflow
- **Trigger**: `PATCH /kitchen/orders/:orderId`
- **Method**: `PrismaOrderRepository.updateOrderStatus`
- **Atomic Transaction Boundary**:
  - Validates legal state machine progression (Rule 21).
  - Updates `Order` status and stamps lifecycle timestamp (`acceptedAt`, `readyAt`, `servedAt`, or `cancelledAt`).
  - Creates matching `AnalyticsEvent`:
    - `kitchen.order.accepted`
    - `kitchen.order.ready`
    - `kitchen.order.served`
    - `kitchen.order.cancelled`

---

## 5. Client-Side Telemetry Ingestion Strategy

For purely behavioral events generated on the browser (e.g. `digital.menu.viewed`, `digital.category.browsed`, `digital.cart.item_added`):

1. **Dedicated Ingestion Endpoint**: `POST /api/v1/telemetry/events` (High-throughput, lightweight).
2. **Client Buffer & Debounce**: The React client batches events and flushes every 3 seconds or on page unload via `navigator.sendBeacon()`.
3. **Zero Operational Coupling**: Ingestion writes directly to the `AnalyticsEvent` table without touching operational business tables. If telemetry drops or fails due to poor diner cellular reception, diner ordering and payments remain completely unaffected.

---

## 6. Failure Handling, Dead Letter Queue (DLQ) & Retry Policy

```
[ Asynchronous Event Processing & Retry Lifecycle ]

                  ┌───────────────────────────────┐
                  │ Outbox Worker Reads New Event │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                   ┌─────────────────────────────┐
                   │ Execute Analytics Projector │
                   └──────────────┬──────────────┘
                                  │
                  ┌───────────────┴───────────────┐
             [ SUCCESS ]                     [ FAILURE ]
                  │                               │
                  ▼                               ▼
       Update Projector Offset       Exponential Backoff Retry
       (Checkpoint Advanced)         - Attempt 1: 500ms
                                     - Attempt 2: 2000ms
                                     - Attempt 3: 8000ms
                                                  │
                                            [ Max Retries ]
                                                  │
                                                  ▼
                                      Dead Letter Queue (DLQ)
                                      `analytics_dlq_events`
                                      (Alerts DevOps, System Continues)
```

### Safety Rules:
1. **Idempotent Consumers**: Every projection worker uses `ON CONFLICT (idempotencyKey) DO NOTHING` or maintains a watermark table (`analytics_checkpoints`). Processing the same event twice never doubles financial totals.
2. **Poison Pill Isolation**: An unparseable or corrupted event payload is moved to `analytics_dlq_events` after 3 failed attempts, preventing the pipeline from stalling.
3. **No Cascading Operational Failures**: Even if the entire analytics subsystem or worker crashes, diners can still scan QR codes, place orders, cook food, and pay bills with zero disruption.

