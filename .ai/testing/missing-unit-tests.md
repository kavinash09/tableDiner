# Missing Unit Tests

**Test runner**: Vitest · **Pattern reference**: `apps/api/src/__tests__/GetEODAuditReportUseCase.test.ts`
All tests below are pure unit tests — mock all I/O at the repository boundary.

---

## 1. Order State Machine — `apps/api/src/core/domain/Order.ts`
**Risk: HIGH** — State transitions guard payment integrity and kitchen workflow. Invalid transitions are undetected at runtime.

### 1a. `markPreparing()` — valid transition
- **Mock**: none (pure domain object)
- **Input**: `Order` in `RECEIVED` status
- **Expected**: status becomes `PREPARING`, `acceptedAt` is set, `updatedAt` advances
- **Why**: Kitchen workflow depends on this gate; silent bugs break SLA tracking (`acceptedAt - createdAt`)

### 1b. `markReady()` — valid transition
- **Mock**: none
- **Input**: `Order` in `PREPARING` status
- **Expected**: status becomes `READY`, `readyAt` is set
- **Why**: `readyAt` drives prep-time SLA in `GetRestaurantDashboardUseCase`

### 1c. `markServed()` — valid transition
- **Mock**: none
- **Input**: `Order` in `READY` status
- **Expected**: status becomes `SERVED`, `servedAt` is set
- **Why**: `servedAt` is the SLA terminal timestamp; must be gated on `READY` only

### 1d. `markPreparing()` — invalid transition guard
- **Mock**: none
- **Input**: `Order` in `PREPARING` status (already advanced)
- **Expected**: throws `Error("Order must be in RECEIVED state to start PREPARING")`
- **Why**: `PATCH /kitchen/orders/:orderId` uses `UpdateOrderStatusSchema` which does not enforce state machine ordering — the domain object is the last line of defense

### 1e. `cancel()` — valid cancellation mid-flight
- **Mock**: none
- **Input**: `Order` in `PREPARING` status, `reason = "Customer changed mind"`
- **Expected**: status becomes `CANCELLED`, `cancelledAt` set, `cancellationReason` set
- **Why**: Cancelled orders must be excluded from `calculateRunningSubtotal()` (see `TableSession`)

### 1f. `cancel()` — guard: cannot cancel SERVED
- **Mock**: none
- **Input**: `Order` in `SERVED` status
- **Expected**: throws `Error("Cannot cancel an order that has already been served.")`
- **Why**: Prevents retroactive order voiding from corrupting historical revenue

### 1g. `calculateTotal()` — sum of line totals
- **Mock**: none
- **Input**: `Order` with 2 `OrderItemProps`: `[{lineTotal: 150}, {lineTotal: 80}]`
- **Expected**: returns `230`
- **Why**: `calculateRunningSubtotal()` in `TableSession` delegates to this method

---

## 2. `TableSession.closeSession()` — `apps/api/src/core/domain/TableSession.ts`
**Risk: HIGH** — Payment validation is entirely inside this method; insufficient payment silently passes if untested.

### 2a. Valid close — exact payment
- **Mock**: none
- **Input**: Session with subtotal `₹500`, `taxAmount=50`, `tipAmount=0`, `discountAmount=0`, `paymentAmount=550`
- **Expected**: status becomes `CLOSED`, `totalAmount=550`, all financial fields set, `closedAt` is set
- **Why**: Confirms the happy path; regression risk if financial formula changes

### 2b. Insufficient payment — throws
- **Mock**: none
- **Input**: subtotal `₹500`, `taxAmount=50`, `paymentAmount=400`
- **Expected**: throws `Error` containing `"Insufficient payment amount"`
- **Why**: Underpayment is a CRITICAL revenue risk; no integration test currently covers this path

### 2c. Already-closed session — throws
- **Mock**: none
- **Input**: `Session` already in `CLOSED` status
- **Expected**: throws `Error("Session is already closed.")`
- **Why**: Idempotency guard; double-payment must be impossible

### 2d. Cancelled orders excluded from subtotal
- **Mock**: none
- **Input**: Session with one `SERVED` order (₹200) and one `CANCELLED` order (₹100)
- **Expected**: `calculateRunningSubtotal()` returns `200`, not `300`
- **Why**: `calculateRunningSubtotal` filters `CANCELLED`/`REJECTED` orders — confirmed in source but untested

---

## 3. `TableSession.calculateRunningSubtotal()` — `apps/api/src/core/domain/TableSession.ts`
**Risk: HIGH** — Drives bill total shown to customer; wrong value causes incorrect payment collection.

### 3a. Excludes cancelled/rejected orders
- **Mock**: none
- **Input**: Three orders: `SERVED` (₹150), `CANCELLED` (₹200), `REJECTED` (₹100)
- **Expected**: `150`
- **Why**: Source code filter is `o.status !== 'CANCELLED' && o.status !== 'REJECTED'` — needs a regression guard

### 3b. Empty orders array
- **Mock**: none
- **Input**: Session with zero orders
- **Expected**: `0`
- **Why**: Edge case; `reduce` on empty array must return `0` (initial value)

---

## 4. `AppUseCases.placeOrder()` — `apps/api/src/core/use-cases/AppUseCases.ts`
**Risk: HIGH** — Price snapshotting happens here; if `menuItem.price` lookup fails, order is created with wrong prices.

### 4a. Creates session automatically when none exists
- **Mock**: `ITableRepository.findByQrCode` returns table with empty `sessions[]`; `ISessionRepository.createActiveSession` returns new session; `IMenuItemRepository.findById` returns item; `IOrderRepository.createOrder` returns order
- **Input**: `qrCode = "T1"`, `items = [{menuItemId: "m1", quantity: 2}]`
- **Expected**: `sessionRepo.createActiveSession` called once; `orderRepo.createOrder` called with `unitPrice` and `lineTotal` set
- **Why**: Auto-session-creation is a critical path; if `createActiveSession` is not called, order is orphaned

### 4b. Price snapshot — `unitPrice` and `lineTotal` written to order
- **Mock**: `IMenuItemRepository.findById` returns `{price: 120}`
- **Input**: `quantity: 3`
- **Expected**: `createOrder` called with `unitPrice: 120`, `lineTotal: 360`
- **Why**: This is the fix for the billing bug; without a test, regressions are invisible

### 4c. Unknown table — throws
- **Mock**: `ITableRepository.findByQrCode` returns `null`
- **Expected**: throws `Error('Table not found.')`
- **Why**: Route handler must receive a defined error to return 404 instead of 500

---

## 5. `AppUseCases.getBill()` — `apps/api/src/core/use-cases/AppUseCases.ts`
**Risk: HIGH (CRITICAL bug)** — Currently uses `item.menuItem.price` (live price) instead of `item.unitPrice` (snapshotted price). Customers are overbilled or underbilled if prices change mid-session.

### 5a. Uses snapshotted `unitPrice`, not live price
- **Mock**: `ITableRepository.findByQrCode` returns session with one order, one item: `{ unitPrice: 100, quantity: 2, menuItem: { price: 150, name: "Biryani" } }`
- **Expected**: `totalAmount = 200` (uses `unitPrice * quantity`), not `300` (which live price would produce)
- **Why**: THIS IS THE BUG TEST. If this test passes after the fix, the bug is resolved and regression-protected.

### 5b. No active session — throws
- **Mock**: `ITableRepository.findByQrCode` returns table with empty `sessions[]`
- **Expected**: throws `Error('No active session found.')`

---

## 6. `AppUseCases.payBill()` — `apps/api/src/core/use-cases/AppUseCases.ts`
**Risk: HIGH** — Payment triggers session closure; if `processCheckout` is not called, session stays `ACTIVE` and analytics never records the revenue.

### 6a. Calls `processCheckout` with correct sessionId and amount
- **Mock**: `ITableRepository.findByQrCode` returns session `{id: "s1"}`; `IPaymentRepository.processCheckout` is a spy
- **Input**: `amount = 500`
- **Expected**: `paymentRepo.processCheckout("s1", 500)` called exactly once
- **Why**: Confirms the wiring between the use case and the payment adapter

### 6b. No active session — throws
- **Mock**: `findByQrCode` returns table with empty sessions
- **Expected**: throws `Error('No active session found.')`

---

## 7. `GetRestaurantDashboardUseCase.execute()` — `apps/api/src/core/use-cases/GetRestaurantDashboardUseCase.ts`
**Risk: MEDIUM** — Dashboard returns zeros on business date mismatch (tenantId/businessDate bug); untested, so the bug is invisible.

### 7a. Returns structured KPIs for a valid business date
- **Mock**: `IRestaurantAnalyticsRepository` methods return known fixtures
- **Input**: `restaurantId`, `date = "2026-10-08"`
- **Expected**: response shape matches the `RestaurantDailyMetricsResponse` type from `shared-types`
- **Why**: Catches shape regressions when analytics spec evolves

### 7b. Returns zeros when no sessions match the business date
- **Mock**: All repository methods return empty arrays / zeros
- **Expected**: All numeric fields are `0`, no exceptions thrown
- **Why**: The current tenantId bug causes this exact scenario; a test documents the expected behavior post-fix

---

## 8. `GetPlatformDashboardUseCase.execute()` — `apps/api/src/core/use-cases/GetPlatformDashboardUseCase.ts`
**Risk: MEDIUM**

### 8a. Aggregates GMV across all tenants
- **Mock**: `IPlatformAnalyticsRepository.getGmvMetrics` returns `{gmv: 10000, ordersProcessed: 50}`
- **Expected**: response includes `gmv: 10000`
- **Why**: Platform GMV is the primary SaaS health metric; structural regressions here break the super-admin dashboard

---

## 9. `CsvExportAdapter.generateEodCsv()` — `apps/api/src/adapters/secondary/csv/CsvExportAdapter.ts`
**Risk: MEDIUM** — Malformed CSV is silently accepted by the route handler but breaks downstream spreadsheet imports.

### 9a. Produces valid CSV header and session rows
- **Mock**: none (pure function)
- **Input**: `RestaurantEodReportResponse` fixture with 2 sessions
- **Expected**: output string contains `"Business Date"`, `"Financial Summary"`, `"Sessions"` section headers; correct row count
- **Why**: Manual CSV generation has no library guardrails; encoding bugs (unescaped commas/quotes) must be caught here

### 9b. Escapes commas in table names
- **Input**: session with `tableName: "Table, Near Window"`
- **Expected**: row wraps the value in quotes: `"Table, Near Window"`
- **Why**: SQL injection analog for CSV — unescaped commas corrupt column alignment

---

## 10. `ArchivableEntity` lifecycle — `apps/api/src/core/domain/ArchivableEntity.ts`
**Risk: LOW**

### 10a. `softDelete()` sets `isActive = false` and `deletedAt`
- **Mock**: none
- **Expected**: after call, `isActive === false`, `deletedAt instanceof Date`

### 10b. `restore()` resets `isActive = true` and clears `deletedAt`
- **Mock**: none
- **Input**: entity in soft-deleted state
- **Expected**: `isActive === true`, `deletedAt === null`
