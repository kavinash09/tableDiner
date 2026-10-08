# Complete Remediation Blueprint: Lifecycle Timestamps, Financial Snapshots & Analytics Performance

**Document**: `remediation-blueprint.md`  
**Authors**: Principal Software Architect & Principal Analytics Architect  
**Scope**: End-to-end architectural remediation design for data integrity, domain lifecycle enforcement, financial snapshotting, and analytics performance optimization.  
**Constraint**: Blueprint & design only. No implementation code executed in this step.

---

## Phase 1: Root Cause Analysis

### Issue 1: Order Lifecycle Timestamps Never Recorded
- **Root Cause**: An architectural bypass between the primary HTTP adapter and the database repository. In `apps/api/src/adapters/secondary/db/PrismaRepositories.ts` (Lines 79–84), `PrismaOrderRepository.updateOrderStatus` executes a raw, unvalidated update:
  ```typescript
  async updateOrderStatus(orderId: string, status: string) {
    return prisma.order.update({
      where: { id: orderId },
      data: { status }, // Timestamps completely ignored!
    });
  }
  ```
  The rich domain entity `apps/api/src/core/domain/Order.ts`—which implements `markPreparing()`, `markReady()`, and `markServed()`—is completely bypassed.
- **Affected Files**:
  - `apps/api/src/adapters/secondary/db/PrismaRepositories.ts`
  - `apps/api/src/core/use-cases/AppUseCases.ts`
  - `apps/api/src/index.ts`
- **Affected Workflows**: Kitchen Display System ticket transitions (`PATCH /kitchen/orders/:orderId`).
- **Affected APIs**: `PATCH /kitchen/orders/:orderId`, `GET /api/v1/restaurants/:id/metrics/daily`.
- **Affected Dashboards & Reports**: Restaurant Admin Dashboard (`Dashboard.tsx` SLA metrics row); Daily Kitchen SLA Report.
- **Affected Metrics**: `avgKitchenPrepTimeMinutes`, `avgServiceTimeMinutes`, `avgFulfillmentTimeMinutes`.
- **Severity**: **P0 (Critical Blocker)**

---

### Issue 2: Session Closure Timestamps Never Recorded
- **Root Cause**: In `apps/api/src/adapters/secondary/db/PrismaRepositories.ts` (Lines 88–94), `PrismaPaymentRepository.processCheckout` updates session status to `CLOSED` but omits `closedAt`:
  ```typescript
  async processCheckout(tenantId: string, sessionId: string, amount: number) {
    await prisma.$transaction([
      prisma.payment.create({ data: { tenantId, sessionId, status: 'COMPLETED', amount } }),
      prisma.session.update({ where: { id: sessionId }, data: { status: 'CLOSED' } }), // closedAt omitted!
    ]);
  }
  ```
  The domain method `TableSession.closeSession()` (which sets `_closedAt = new Date()`) is never invoked.
- **Affected Files**: `PrismaRepositories.ts`, `AppUseCases.ts`, `index.ts`.
- **Affected Workflows**: Customer payment and tab closure (`POST /table/:qrCode/pay`).
- **Affected APIs**: `POST /table/:qrCode/pay`, `GET /api/v1/restaurants/:id/metrics/daily`, `GET /api/v1/restaurants/:id/audit/eod`, `GET /api/v1/restaurants/:id/audit/eod/export`.
- **Affected Dashboards & Reports**: Restaurant Admin Dashboard (Occupancy %, Table Turn Time, EOD Ledger Table); EOD CSV Export.
- **Affected Metrics**: `occupancyPercent`, `avgTableTurnTimeMinutes`, `EodSessionRecord.closedAt`.
- **Severity**: **P0 (Critical Blocker)**

---

### Issue 3: Financial Snapshot Fields Never Persisted
- **Root Cause**: `processCheckout` creates a `Payment` record with `amount`, but leaves `Session.totalAmount`, `subtotal`, `taxAmount`, `tipAmount`, and `discountAmount` at their database default values (`0.0` or `null`).
- **Affected Files**: `PrismaRepositories.ts`, `AppUseCases.ts`.
- **Affected Workflows**: Payment settlement and session closure.
- **Affected APIs**:
  - `GET /api/v1/restaurants/:id/metrics/daily`
  - `GET /api/v1/restaurants/:id/audit/eod`
  - `GET /api/v1/restaurants/:id/audit/eod/export`
  - `GET /api/v1/platform/metrics`
- **Affected Dashboards & Reports**:
  - Restaurant Admin: Net Revenue, Gross Revenue, Avg Ticket Size, Tips Collected.
  - Platform Admin: Total GMV Processed, Average Order Value.
  - End of Day Audit Report & CSV Export.
- **Affected Metrics**: `grossRevenue`, `netRevenue`, `totalTips`, `totalDiscounts`, `avgTicketSize`, `totalGmv`, `avgOrderValue`.
- **Severity**: **P0 (Critical Blocker)**

---

### Issue 4: In-Memory Duration Calculations in Node.js Event Loop
- **Root Cause**: In `apps/api/src/adapters/secondary/db/PrismaRestaurantAnalyticsRepository.ts` (Lines 94–103 & 124–136), date arithmetic is performed in-memory:
  ```typescript
  const closedSessions = await this.prisma.session.findMany({ ... });
  let totalOccupiedMinutes = 0;
  for (const s of closedSessions) {
    if (s.closedAt) {
      const diffMs = s.closedAt.getTime() - s.createdAt.getTime();
      totalOccupiedMinutes += diffMs / (1000 * 60);
    }
  }
  ```
  Because SQLite does not have clean ORM date-difference abstractions, the repository loads every raw session and order row into Node.js heap memory.
- **Affected Files**: `PrismaRestaurantAnalyticsRepository.ts`.
- **Affected Workflows**: Daily analytics queries and dashboard refreshes.
- **Scaling Risk**: Linear heap growth (`O(N)` records). At 2,000+ daily orders under concurrent dashboard requests, this causes CPU throttling, garbage collection pauses, and process crashes (OOM).
- **Severity**: **P1 (High Scalability Risk)**

---

## Phase 2: Domain Lifecycle Audit

The exhaustive lifecycle audit across `Order`, `Session`, and `Payment` has been compiled into [**`lifecycle-state-matrix.md`**](file:///Users/avinash/avinash/labs/TableDiner_AI_First_Starter/lifecycle-state-matrix.md).

### Summary of State Invariants:
1. **Order**: State transitions must strictly follow `RECEIVED` → `PREPARING` → `READY` → `SERVED`. Skipping states (e.g. `RECEIVED` straight to `SERVED`) is prohibited. Once in `SERVED`, `CANCELLED`, or `REJECTED`, the state is terminal.
2. **Session**: Cannot transition to `CLOSED` while unserved orders remain in `RECEIVED` or `PREPARING`. Closing a session requires freezing immutable financial totals.
3. **Payment**: Two-phase settlement (`PENDING` → `COMPLETED` / `FAILED`). Successful payment automatically triggers atomic session closure.

---

## Phase 3: Data Integrity Plan

### 3.1 Order Lifecycle Transition Specifications

#### Transition 1: `RECEIVED` ──► `PREPARING`
- **Trigger**: Kitchen accepts ticket.
- **Required Timestamps**: `acceptedAt = new Date()`.
- **Required Validations**:
  - Current status must be `RECEIVED`.
  - `acceptedAt` must not already be populated (idempotency guard).
- **Required Persistence**:
  ```typescript
  prisma.order.update({
    where: { id: orderId, status: 'RECEIVED' },
    data: { status: 'PREPARING', acceptedAt: new Date() }
  });
  ```
- **Required Tests**: Valid transition sets `acceptedAt`; transition fails if order is already `PREPARING` or `CANCELLED`.

#### Transition 2: `PREPARING` ──► `READY`
- **Trigger**: Kitchen completes cooking.
- **Required Timestamps**: `readyAt = new Date()`.
- **Required Validations**: Current status must be `PREPARING`.
- **Required Persistence**:
  ```typescript
  prisma.order.update({
    where: { id: orderId, status: 'PREPARING' },
    data: { status: 'READY', readyAt: new Date() }
  });
  ```
- **Required Tests**: Valid transition sets `readyAt`; fails if order was never accepted (`RECEIVED`).

#### Transition 3: `READY` ──► `SERVED`
- **Trigger**: Food delivered to table.
- **Required Timestamps**: `servedAt = new Date()`.
- **Required Validations**: Current status must be `READY`.
- **Required Persistence**:
  ```typescript
  prisma.order.update({
    where: { id: orderId, status: 'READY' },
    data: { status: 'SERVED', servedAt: new Date() }
  });
  ```
- **Required Tests**: Valid transition sets `servedAt`; terminal state prevents any subsequent status modification.

#### Transition 4: Any Active State ──► `CANCELLED` / `REJECTED`
- **Trigger**: Order cancellation.
- **Required Timestamps**: `cancelledAt = new Date()`.
- **Required Validations**:
  - Current status must NOT be `SERVED`.
  - Non-empty `cancellationReason` string required.
- **Required Persistence**:
  ```typescript
  prisma.order.update({
    where: { id: orderId, status: { not: 'SERVED' } },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason }
  });
  ```
- **Required Tests**: Cancellation fails if order is already `SERVED`; cancellation succeeds with timestamp and reason.

---

### 3.2 Session Lifecycle Transition Specifications

#### Transition: `OPEN` ──► `CLOSED`
- **Trigger**: Customer checkout payment completion (`POST /table/:qrCode/pay`).
- **Required Timestamps**: `closedAt = new Date()`.
- **Required Validations**:
  1. Session status must be `OPEN`.
  2. All child orders must be terminal (`SERVED`, `CANCELLED`, or `REJECTED`). No orders can be in `RECEIVED` or `PREPARING`.
  3. `paymentAmount >= expectedTotal`.
- **Required Persistence (Atomic Database Transaction)**:
  ```typescript
  await prisma.$transaction(async (tx) => {
    // 1. Fetch all non-cancelled order items
    const session = await tx.session.findUniqueOrThrow({
      where: { id: sessionId },
      include: { orders: { include: { items: true } } }
    });
    
    // 2. Compute exact financial rollups
    const subtotal = session.orders
      .filter(o => o.status !== 'CANCELLED' && o.status !== 'REJECTED')
      .flatMap(o => o.items)
      .reduce((sum, item) => sum + item.lineTotal, 0);

    const taxAmount = 0; // Or configurable tax rate
    const tipAmount = 0; // Extracted from payment payload
    const discountAmount = 0;
    const totalAmount = subtotal + taxAmount + tipAmount - discountAmount;

    // 3. Persist Payment
    await tx.payment.create({
      data: { tenantId, sessionId, status: 'COMPLETED', amount: paymentAmount, method: 'MOCK_PAY' }
    });

    // 4. Freeze Session with Snapshots and Timestamp
    await tx.session.update({
      where: { id: sessionId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        subtotal,
        taxAmount,
        tipAmount,
        discountAmount,
        totalAmount
      }
    });
  });
  ```
- **Required Tests**:
  - Checkout sets `closedAt`, `subtotal`, and `totalAmount`.
  - Checkout throws error if unserved orders remain in the kitchen.
  - Checkout throws error if session is already closed.

---

## Phase 4: Financial Snapshot Plan

```
[ Active Orders Placed ]
        │
        │ Line Total Snapshotted on OrderItem
        ▼
[ Customer Requests Bill ]
        │
        │ Dynamic Preview: getBill() sums snapshotted OrderItem.lineTotal
        ▼
[ Customer Submits Payment ]
        │
        ▼ ─── ATOMIC COMMIT POINT ───
[ Session Table Frozen ]
  - Session.subtotal       = SUM(OrderItem.lineTotal)
  - Session.taxAmount      = calculated tax
  - Session.tipAmount      = diner tip
  - Session.discountAmount = discount
  - Session.totalAmount    = subtotal + tax + tip - discount
  - Session.closedAt       = new Date()
  - Session.status         = 'CLOSED'
        │
        ▼ ─── IMMUTABILITY BARRIER ───
  Historical reports and analytics queries read ONLY the frozen Session fields.
  Never recalculate from OrderItem post-closure.
```

### 1. Calculation Timings
- **Subtotal**: Calculated at the atomic moment of checkout by summing all `OrderItem.lineTotal` records across active, non-cancelled orders.
- **Tax & Tip**: Calculated at checkout based on restaurant settings and customer tip selection.
- **Total Amount**: Billed total = `subtotal + taxAmount + tipAmount - discountAmount`.
- **Immutability Freeze Point**: The instant `tx.session.update` commits with `status: 'CLOSED'`.

### 2. Protection of Historical Data
- **No In-Place Modification**: Closed sessions must never have their `subtotal` or `totalAmount` mutated.
- **Handling Refunds**: Refunds do NOT deduct from `totalAmount`. They write to `Session.refundedAmount` and create a negative `Payment` ledger entry.
- **Menu Price Decoupling**: Menu price changes (`PATCH /menu-item/:id`) only affect future order items. Existing `OrderItem.unitPrice` and `Session.subtotal` remain completely untouched.

---

## Phase 5: Analytics Correction Plan

| Metric | Current Defect | Correct Behavior | Required Code Remediation | Migration / Repair Impact |
|---|---|---|---|---|
| **Gross Revenue** | Sums `Session.totalAmount` which is `0.0` → Returns `₹0.00` | Sums frozen `totalAmount` of all closed sessions on `businessDate`. | Populate `totalAmount` on checkout in `processCheckout`. | Historical closed sessions must be backfilled from order items. |
| **Net Revenue** | In-memory subtraction of 0s → Returns `₹0.00` | `totalAmount - taxAmount - tipAmount`. | Populate `totalAmount`, `taxAmount`, `tipAmount` on checkout. | Backfilled during session recovery. |
| **Avg Ticket Size** | Evaluates to `₹0.00` | `netRevenue / closedSessionCount`. | Derived from corrected Net Revenue. | Auto-repairs once session totals are populated. |
| **Occupancy %** | Queries `closedAt: { not: null }` (0 rows) → Returns `0.0%` | Computes occupied table minutes divided by available minutes. | Set `closedAt = new Date()` in `processCheckout`. | Backfill `closedAt = Payment.createdAt` for existing closed sessions. |
| **Avg Table Turn Time**| Evaluates to `0 min` | Total occupied minutes divided by closed session count. | Set `closedAt = new Date()` in `processCheckout`. | Backfilled from Payment timestamps. |
| **Kitchen Prep SLA** | Queries `acceptedAt`, `readyAt` (both null) → Returns `0 min` | `AVG(readyAt - acceptedAt)` for served orders. | Populate `acceptedAt` and `readyAt` in `updateOrderStatus`. | Forward-looking repair. Historical orders without logs marked as N/A. |
| **Service SLA** | Queries `readyAt`, `servedAt` (both null) → Returns `0 min` | `AVG(servedAt - readyAt)` for served orders. | Populate `readyAt` and `servedAt` in `updateOrderStatus`. | Forward-looking repair. |
| **Fulfillment SLA** | Queries `servedAt` (null) → Returns `0 min` | `AVG(servedAt - createdAt)` for served orders. | Populate `servedAt` in `updateOrderStatus`. | Forward-looking repair. |
| **Platform GMV** | Sums `Session.totalAmount` (0) → Returns `₹0.00` | Sums all closed session totals platform-wide on report date. | Relies on corrected `Session.totalAmount`. | Auto-repairs once sessions are backfilled. |

---

## Phase 6: Performance & Scalability Plan

### 1. In-Memory Calculation Bottlenecks
In `PrismaRestaurantAnalyticsRepository.ts`:
- **Occupancy & Turn Time**: `findMany({ select: { createdAt: true, closedAt: true } })` loads an array of date objects into Node.js heap and executes a JS `for` loop.
- **Kitchen SLAs**: `findMany({ select: { createdAt: true, acceptedAt: true, readyAt: true, servedAt: true } })` loads an array of order date objects into Node.js heap and executes a JS `for` loop.

### 2. High-Performance Remediation Recommendations

#### Recommendation A: Pre-Computed Duration Columns (Zero Memory Overhead)
Add two lightweight computed columns to the schema:
1. `Session.durationMinutes: Float?`
   - Populated on session closure: `(closedAt.getTime() - createdAt.getTime()) / 60000`.
2. `Order.fulfillmentMinutes: Float?`
   - Populated on order served: `(servedAt.getTime() - createdAt.getTime()) / 60000`.

**Impact**:
The entire in-memory JavaScript loop in Node.js is eliminated! The repository can execute a single native database aggregate:
```typescript
const aggr = await this.prisma.session.aggregate({
  where: { restaurantId, businessDate, status: { not: 'OPEN' } },
  _avg: { durationMinutes: true },
  _sum: { durationMinutes: true }
});
```
- Query execution time drops from `O(N)` memory processing to a single indexed SQL index scan.
- Memory consumption drops from Megabytes to a few bytes.

#### Recommendation B: Native SQLite Duration Queries (Alternative)
If schema modification is deferred, delegate duration math directly to SQLite's C-level engine using `unixepoch()` via Prisma `$queryRaw`:
```sql
SELECT 
  AVG((unixepoch(closedAt) - unixepoch(createdAt)) / 60.0) AS avgTurnMinutes,
  SUM((unixepoch(closedAt) - unixepoch(createdAt)) / 60.0) AS totalOccupiedMinutes
FROM Session
WHERE restaurantId = $1 AND businessDate = $2 AND status != 'OPEN' AND closedAt IS NOT NULL;
```

---

## Phase 7: Testing & Verification Plan

### 7.1 Required Unit Tests
1. **`Order.stateMachine.test.ts`**:
   - *Test*: Verify `markPreparing()`, `markReady()`, `markServed()` set `acceptedAt`, `readyAt`, `servedAt`.
   - *Failure Scenario*: Invoking `markReady()` while in `RECEIVED` state must throw `Error("Order must be in PREPARING state to mark READY")`.
   - *Failure Scenario*: Invoking `cancel()` on a `SERVED` order must throw `Error("Cannot cancel an order that has already been served")`.
2. **`TableSession.closeSession.test.ts`**:
   - *Test*: Verify `closeSession()` computes subtotal, sets `closedAt`, and populates `totalAmount`.
   - *Failure Scenario*: Closing a session with an insufficient payment amount throws `Error("Insufficient payment amount")`.
   - *Failure Scenario*: Closing an already closed session throws `Error("Session is already closed")`.

### 7.2 Required Integration Tests
1. **`CheckoutWorkflow.integration.test.ts`**:
   - *Flow*: Create session → Place order with 2 items (₹300) → Pay bill with ₹300.
   - *Assertions*:
     - Database row `Session` has `status: 'CLOSED'`.
     - Database row `Session.closedAt` is within 1000ms of `now()`.
     - Database row `Session.totalAmount` strictly equals `300.0`.
     - Database row `Session.subtotal` strictly equals `300.0`.
2. **`KitchenWorkflow.integration.test.ts`**:
   - *Flow*: Create order → PATCH `PREPARING` → PATCH `READY` → PATCH `SERVED`.
   - *Assertions*:
     - Database row `Order.acceptedAt` is NOT null.
     - Database row `Order.readyAt` is NOT null.
     - Database row `Order.servedAt` is NOT null.
     - `acceptedAt <= readyAt <= servedAt`.

### 7.3 Required Analytics Regression Tests
1. **`DailyAnalyticsAccuracy.test.ts`**:
   - *Scenario*: Seed 2 closed sessions (₹500 and ₹300) on date `2026-10-09`.
   - *Execute*: `GET /api/v1/restaurants/:id/metrics/daily?date=2026-10-09`.
   - *Assertions*:
     - `financials.grossRevenue === 800.0` (Not 0).
     - `financials.avgTicketSize === 400.0` (Not 0).
     - `utilization.avgTableTurnTimeMinutes > 0` (Not 0).
     - `utilization.occupancyPercent > 0` (Not 0).

---

## Phase 8: Historical Data Recovery & Backfill Strategy

### 1. Recovery Feasibility Assessment
- **Session Closure Timestamps (`closedAt`)**: **RECOVERABLE (100% Accuracy)**.
  - *Proof*: In `PrismaRepositories.ts`, checkout executes an atomic transaction creating a `Payment` row and updating the `Session`. Therefore, `Payment.createdAt` matches the exact timestamp when the session was closed!
- **Session Financial Totals (`totalAmount`, `subtotal`)**: **RECOVERABLE (100% Accuracy)**.
  - *Proof*: Every order line item has snapshotted `OrderItem.lineTotal`. Summing non-cancelled order items for a session gives the exact historical subtotal. Furthermore, `Payment.amount` gives the exact historical total paid.
- **Order Kitchen SLAs (`acceptedAt`, `readyAt`, `servedAt`)**: **PARTIALLY RECOVERABLE**.
  - For orders already in `SERVED` state, the kitchen never recorded when preparation started or finished. We cannot fabricate intermediate timestamps.
  - *Strategy*: Historical served orders must have SLA metrics reported as `null` / `unrecorded`. Do not fabricate data. Going forward, timestamps are strictly captured.

### 2. Backfill Script Specification (`scripts/backfill-sessions.ts`)
```typescript
/**
 * Safe, Idempotent Backfill Script:
 * Repairs historical Session rows where status = 'CLOSED' but closedAt or totalAmount is missing.
 */
async function backfillHistoricalSessions() {
  const brokenSessions = await prisma.session.findMany({
    where: {
      status: { not: 'OPEN' },
      OR: [
        { closedAt: null },
        { totalAmount: 0 },
        { totalAmount: null }
      ]
    },
    include: {
      orders: { include: { items: true } },
      payments: { where: { status: 'COMPLETED' } }
    }
  });

  for (const session of brokenSessions) {
    // 1. Reconstruct closedAt from Payment createdAt or updatedAt
    const latestPayment = session.payments[0];
    const recoveredClosedAt = latestPayment?.createdAt || session.updatedAt;

    // 2. Reconstruct subtotal from OrderItem snapshots
    const subtotal = session.orders
      .filter(o => o.status !== 'CANCELLED' && o.status !== 'REJECTED')
      .flatMap(o => o.items)
      .reduce((sum, item) => sum + item.lineTotal, 0);

    const recoveredTotal = latestPayment?.amount || subtotal;

    // 3. Update session
    await prisma.session.update({
      where: { id: session.id },
      data: {
        closedAt: session.closedAt || recoveredClosedAt,
        subtotal: session.subtotal || subtotal,
        totalAmount: (session.totalAmount && session.totalAmount > 0) ? session.totalAmount : recoveredTotal,
      }
    });
  }
}
```

---

## Phase 9: Implementation Plan & Safety Protocol

### Step-by-Step Execution Order

```
[ Step 1: Rich Domain Entities Refactor ]
  - Update TableSession.ts: Align status enum ('OPEN' | 'CLOSED' | 'REOPENED' | 'FINALIZED').
  - Ensure Order.ts and TableSession.ts pass unit tests.
        │
        ▼
[ Step 2: Repository Layer Remediation ]
  - Update PrismaOrderRepository.updateOrderStatus:
    Map incoming status -> Call Order domain transition -> Persist status + appropriate timestamp.
  - Update PrismaPaymentRepository.processCheckout:
    Wrap in transaction -> Calculate subtotal -> Set closedAt + all financial snapshot fields.
        │
        ▼
[ Step 3: Fastify Route Input Validation ]
  - Update /kitchen/orders/:orderId route:
    Catch domain state transition errors (e.g. invalid transition) -> Return HTTP 400 with message.
        │
        ▼
[ Step 4: Verification via Integration Tests ]
  - Execute Vitest suite:
    Verify order status progression sets timestamps.
    Verify checkout populates closedAt and totalAmount.
        │
        ▼
[ Step 5: Historical Data Backfill Execution ]
  - Run backfill script in dry-run mode -> Inspect output.
  - Execute backfill against tablediner.db.
        │
        ▼
[ Step 6: Analytics Query Optimization ]
  - Replace in-memory date loops in PrismaRestaurantAnalyticsRepository with raw SQL aggregates or duration fields.
  - Verify /api/v1/restaurants/:id/metrics/daily returns accurate non-zero revenue, occupancy, and SLAs.
```

### Risk Assessment & Mitigation
- **Risk 1: Breaking Active Diners During Deployment**:
  - *Mitigation*: The database schema already possesses `closedAt`, `acceptedAt`, `readyAt`, `servedAt`, and `totalAmount`. **Zero Prisma schema migrations are required** to store these values. Only repository logic changes are deployed.
- **Risk 2: Backfill Overwriting Valid Data**:
  - *Mitigation*: The backfill query strictly filters `where: { OR: [{ closedAt: null }, { totalAmount: 0 }] }`. Sessions with valid data are skipped.
- **Risk 3: Rollback Protocol**:
  - In the event of an unexpected regression, git rollback to the previous commit safely reverts the repository methods without any schema incompatibility, as no columns are added or dropped.

