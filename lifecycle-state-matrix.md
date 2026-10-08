# Domain Lifecycle State Matrix

**Document**: `lifecycle-state-matrix.md`  
**Role**: Principal Software Architect & Analytics Architect  
**Scope**: State machine specifications, timestamp guarantees, snapshot immutability, and boundary transitions for `Order`, `Session`, and `Payment`.

---

## 1. Overview

This matrix defines the formal state transitions, required temporal markers, financial freeze points, and validation rules for TableDiner's core transactional entities. It bridges the gap between the defined Rich Domain Entities (`apps/api/src/core/domain/`) and the active persistence repositories (`apps/api/src/adapters/secondary/db/`).

---

## 2. Order Lifecycle State Matrix

### 2.1 States
- `RECEIVED`: Order submitted by diner via QR code; ticket created for kitchen.
- `PREPARING`: Ticket acknowledged by kitchen staff; food preparation in progress.
- `READY`: Kitchen finishes cooking; food plated and awaiting runner/service.
- `SERVED`: Food delivered to customer table; order fulfillment complete.
- `CANCELLED`: Order voided before preparation or fulfillment due to guest change or 86'd ingredients.
- `REJECTED`: Kitchen declines ticket (e.g., kitchen closed, item out of stock).

### 2.2 Transition & Persistence Matrix

| Current State | Target State | Triggering Action / API | Allowed? | Required Timestamps | Required Snapshots | Required Validations | Current Implementation Reality | Missing Implementation |
|---|---|---|---|---|---|---|---|---|
| *None* | `RECEIVED` | `POST /table/:qrCode/order` | ✅ Yes | `createdAt: now()` | `unitPrice`, `lineTotal` per `OrderItem` | Session must be `OPEN`; `items.length > 0`; quantity ≥ 1 | Handled in `AppUseCases.placeOrder` + `PrismaOrderRepository.createOrder` | Missing `businessDate` computation in domain entity |
| `RECEIVED` | `PREPARING` | `PATCH /kitchen/orders/:id` (`{status: 'PREPARING'}`) | ✅ Yes | `acceptedAt: now()` | None | Order must be in `RECEIVED` state | ❌ `PrismaOrderRepository` sets `data: { status }` only | `acceptedAt` omitted; state machine bypassed |
| `RECEIVED` | `CANCELLED` | `PATCH /kitchen/orders/:id` (`{status: 'CANCELLED'}`) | ✅ Yes | `cancelledAt: now()` | None | Cancellation reason required | ❌ Sets `data: { status }` only | `cancelledAt` & `cancellationReason` omitted |
| `RECEIVED` | `REJECTED` | `PATCH /kitchen/orders/:id` (`{status: 'REJECTED'}`) | ✅ Yes | `cancelledAt: now()` | None | Rejection reason required | ❌ Sets `data: { status }` only | `cancelledAt` & `cancellationReason` omitted |
| `RECEIVED` | `READY` | Direct skip | ❌ **Forbidden** | — | — | Must fail transition (Must prepare first) | ❌ Allowed by loose `UpdateOrderStatusSchema` | Strict domain state validation missing in route |
| `RECEIVED` | `SERVED` | Direct skip | ❌ **Forbidden** | — | — | Must fail transition | ❌ Allowed by loose schema | Strict domain state validation missing |
| `PREPARING` | `READY` | `PATCH /kitchen/orders/:id` (`{status: 'READY'}`) | ✅ Yes | `readyAt: now()` | None | Order must be in `PREPARING` state | ❌ Sets `data: { status }` only | `readyAt` omitted |
| `PREPARING` | `CANCELLED` | `PATCH /kitchen/orders/:id` (`{status: 'CANCELLED'}`) | ✅ Yes | `cancelledAt: now()` | Log kitchen waste flag | Order must be in `PREPARING` | ❌ Sets `data: { status }` only | `cancelledAt` omitted |
| `PREPARING` | `RECEIVED` | Rollback | ❌ **Forbidden** | — | — | Cannot un-accept order | ❌ Allowed by raw Prisma update | State guard missing |
| `READY` | `SERVED` | `PATCH /kitchen/orders/:id` (`{status: 'SERVED'}`) | ✅ Yes | `servedAt: now()` | None | Order must be in `READY` state | ❌ Sets `data: { status }` only | `servedAt` omitted |
| `READY` | `CANCELLED` | Kitchen comp | ⚠️ Exceptional | `cancelledAt: now()` | Supervisor approval | Must log reason | ❌ Sets `data: { status }` only | Supervisor guard missing |
| `SERVED` | *Any* | Any update | ❌ **Terminal** | — | — | **TERMINAL STATE**. Cannot cancel or revert served order. | ❌ Schema allows updating already `SERVED` orders | Terminal guard missing in repository |
| `CANCELLED` | *Any* | Any update | ❌ **Terminal** | — | — | **TERMINAL STATE**. Cannot re-open cancelled order. | ❌ Allows re-updating cancelled order | Terminal guard missing in repository |
| `REJECTED` | *Any* | Any update | ❌ **Terminal** | — | — | **TERMINAL STATE**. Cannot re-open rejected order. | ❌ Allows re-updating rejected order | Terminal guard missing in repository |

---

## 3. Session Lifecycle State Matrix

### 3.1 States
- `OPEN`: Active dining visit. Diners may submit multiple orders over time.
- `CLOSED`: Final payment accepted; bill settled; table cleared. Financials frozen.
- `REOPENED`: Exceptional supervisor override if billing discrepancy occurs post-payment.
- `FINALIZED`: End-of-day audit finalized. Permanent lock.

### 3.2 Transition & Persistence Matrix

| Current State | Target State | Triggering Action / API | Allowed? | Required Timestamps | Required Snapshots | Required Validations | Current Implementation Reality | Missing Implementation |
|---|---|---|---|---|---|---|---|---|
| *None* | `OPEN` | Auto-created on first order via `placeOrder` | ✅ Yes | `createdAt: now()`, `openedAt: now()` | None | Table must not have another active session | `PrismaSessionRepository.createActiveSession` sets `OPEN` | `openedAt` is left null in DB |
| `OPEN` | `CLOSED` | `POST /table/:qrCode/pay` | ✅ Yes | `closedAt: now()` | `subtotal`, `taxAmount`, `tipAmount`, `discountAmount`, `totalAmount` | `payment.amount >= expectedTotal`; all orders must be in `SERVED`, `CANCELLED`, or `REJECTED` | ❌ Sets `data: { status: 'CLOSED' }` only | ⚠️ **`closedAt` OMITTED**; ⚠️ **ALL FINANCIAL SNAPSHOTS OMITTED (REMAIN 0.0)**; Order status validation missing |
| `OPEN` | `OPEN` (Add Order) | Subsequent orders | ✅ Yes | `updatedAt: now()` | None | Cannot add orders if closed | Handled via foreign key join | None |
| `CLOSED` | `OPEN` | Direct revert | ❌ **Forbidden** | — | — | Must transition via `REOPENED` with supervisor token | ❌ No schema guard | Guard missing |
| `CLOSED` | `REOPENED` | Manager override endpoint | ⚠️ Restricted | `reopenedAt: now()` | Snapshot previous totals into audit record | Requires `reopenedBy`, `reopenReason` | ❌ No endpoint exists | Reopen flow completely unimplemented |
| `CLOSED` | `FINALIZED` | EOD Audit run (`POST .../audit/finalize`) | ✅ Yes | `finalizedAt: now()` | Re-verify immutable hash | All associated payments must be `COMPLETED` | ❌ No endpoint exists | Finalize flow unimplemented |
| `FINALIZED` | *Any* | Any modification | ❌ **Terminal** | — | — | **PERMANENT IMMUTABLE RECORD** | ❌ No database guard | Guard missing |

---

## 4. Payment Lifecycle State Matrix

### 4.1 States
- `PENDING`: Payment initiated with gateway or POS.
- `COMPLETED`: Funds captured successfully; bill marked paid.
- `FAILED`: Card declined, UPI timeout, or network failure.

### 4.2 Transition & Persistence Matrix

| Current State | Target State | Triggering Action / API | Allowed? | Required Timestamps | Required Snapshots | Required Validations | Current Implementation Reality | Missing Implementation |
|---|---|---|---|---|---|---|---|---|
| *None* | `PENDING` | `POST /table/:qrCode/pay` (Gateway init) | ✅ Yes | `createdAt: now()` | `amount`, `currency` ('INR') | Session must be `OPEN`; `amount > 0` | ❌ Skips pending; directly creates `COMPLETED` | Two-phase payment state missing (Direct insert) |
| `PENDING` | `COMPLETED` | Webhook / Direct capture | ✅ Yes | `completedAt: now()` | `amount`, `providerId`, `method`, `gatewayFee` | Session must not be already closed; signature valid | Injected directly in `processCheckout` transaction | `completedAt`, `providerId`, `method` omitted/null |
| `PENDING` | `FAILED` | Webhook / Gateway error | ✅ Yes | `failedAt: now()` | `failureReason`, `providerErrorCode` | Session remains `OPEN` | ❌ Unhandled (Mock always succeeds) | Failure state handling missing |
| `COMPLETED` | *Any* | Any modification | ❌ **Terminal** | — | — | **IMMUTABLE LEDGER**. Cannot mutate amount. Refunds must be new records. | ❌ No database-level mutation lock | Ledger immutability guard missing |

---

## 5. Domain Model Integration Gap

The core domain layer already defines entity classes with these state machines:
- **`Order` class** (`apps/api/src/core/domain/Order.ts`): Implements `markPreparing()`, `markReady()`, `markServed()`, `cancel()`, and timestamp setting.
- **`TableSession` class** (`apps/api/src/core/domain/TableSession.ts`): Implements `closeSession(tax, tip, discount, paymentAmount)`, calculating running subtotal and setting `_closedAt`.

**The Root Disconnect**:
The application use cases (`AppUseCases.ts`) and database repositories (`PrismaRepositories.ts`) completely bypass these domain entity methods. `PrismaOrderRepository.updateOrderStatus` executes a raw, unvalidated Prisma query `prisma.order.update({ data: { status } })` directly from HTTP input, ignoring the rich domain classes entirely.

