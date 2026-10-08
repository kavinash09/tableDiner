# Missing Integration Tests

**Test runner**: Vitest + Supertest
**Pattern reference**: `apps/api/tests/integration/health.test.ts`, `apps/api/src/__tests__/authRoute.test.ts`
**App under test**: Fastify instance from `apps/api/src/index.ts`
**Database**: `packages/db/prisma/tablediner.db` (SQLite — seed before each test, clean after)

> [!WARNING]
> All integration tests must seed and clean their own data. Never rely on pre-existing seed state. Wrap each test in a transaction or use `beforeEach`/`afterEach` with explicit Prisma deletions in reverse FK order.

---

## 1. `POST /table/:qrCode/order`
**Risk: HIGH** — Core ordering flow. No test exists for the happy path or any error case.

### Scenario 1a — Valid order placement (auto-creates session)
- **Setup**: Seed `Tenant` → `Restaurant` → `Table(qrCode="TEST-1")` → `MenuItem(id="m1", price=120)`; no active session
- **Request**: `POST /table/TEST-1/order` body `{ items: [{ menuItemId: "m1", quantity: 2 }] }`
- **Expected response**: `201` with `{ id, status: "RECEIVED", items: [{ unitPrice: 120, lineTotal: 240 }] }`
- **Side effect**: `Session` record created in DB with `status: "ACTIVE"`, `Order` linked to it
- **Why**: The auto-session-creation path and price-snapshot path are both exercised; critical for revenue integrity

### Scenario 1b — Unknown QR code
- **Setup**: No table seeded
- **Request**: `POST /table/UNKNOWN/order` body `{ items: [{ menuItemId: "x", quantity: 1 }] }`
- **Expected response**: `404` with `{ error: ... }`

### Scenario 1c — Invalid body (missing items)
- **Setup**: Valid table seeded
- **Request**: `POST /table/TEST-1/order` body `{}`
- **Expected response**: `400` (Zod validation failure from `PlaceOrderSchema`)
- **Why**: Confirms `PlaceOrderSchema` is wired to the route handler

---

## 2. `GET /table/:qrCode/bill`
**Risk: HIGH** — Validates the price-snapshot fix. Without this test, the `getBill` bug is invisible.

### Scenario 2a — Returns itemized bill using snapshotted `unitPrice`
- **Setup**: Seed table, session (`ACTIVE`), order with `OrderItem(unitPrice=100, quantity=2, lineTotal=200)`, `MenuItem(price=999)` (simulate post-order price change)
- **Request**: `GET /table/TEST-1/bill`
- **Expected response**: `200` with `{ totalAmount: 200, itemized: [{ lineTotal: 200 }] }` — NOT 1998
- **Why**: Direct regression test for the `getBill` price-snapshot bug

### Scenario 2b — No active session
- **Setup**: Seed table, no session
- **Expected response**: `404` or error response with meaningful message

---

## 3. `POST /table/:qrCode/pay`
**Risk: HIGH** — Payment closes the session; if broken, sessions stay `ACTIVE` forever and analytics returns no revenue.

### Scenario 3a — Successful payment closes session
- **Setup**: Seed table, active session with one SERVED order (₹500 total)
- **Request**: `POST /table/TEST-1/pay` body `{ amount: 500 }`
- **Expected response**: `200`
- **Side effect**: `Session.status` updated to `CLOSED` in DB; `Payment` record created
- **Why**: Confirms the full payment → session-close pipeline end-to-end

### Scenario 3b — Insufficient payment
- **Setup**: Active session, orders totaling ₹500
- **Request**: `POST /table/TEST-1/pay` body `{ amount: 100 }`
- **Expected response**: `400` or `422` with error indicating insufficient amount
- **Why**: The `TableSession.closeSession()` guard must propagate through the use case and HTTP layer

### Scenario 3c — No active session
- **Setup**: Table with closed (or no) session
- **Expected response**: `404` / error

---

## 4. `PATCH /kitchen/orders/:orderId`
**Risk: HIGH** — Kitchen staff use this to advance order status. No guard exists at the route level against out-of-sequence transitions beyond the domain object.

### Scenario 4a — Valid transition RECEIVED → PREPARING
- **Setup**: Seed order with `status: "RECEIVED"`
- **Request**: `PATCH /kitchen/orders/{orderId}` body `{ status: "PREPARING" }`
- **Expected response**: `200` with updated order, `status: "PREPARING"`, `acceptedAt` set in DB
- **Why**: SLA tracking (`acceptedAt`) is set by `Order.markPreparing()` — confirms domain method is called, not bypassed

### Scenario 4b — Invalid status string (not in enum)
- **Request**: body `{ status: "COOKING" }`
- **Expected response**: `400` (Zod `UpdateOrderStatusSchema` rejection)
- **Why**: `UpdateOrderStatusSchema` allows only `RECEIVED | PREPARING | READY | SERVED` — confirms schema is wired

### Scenario 4c — Out-of-order transition (RECEIVED → SERVED)
- **Setup**: Order with `status: "RECEIVED"`
- **Request**: body `{ status: "SERVED" }`
- **Expected response**: `400` / `422` — domain guard in `Order.markServed()` should reject
- **Why**: `UpdateOrderStatusSchema` currently allows this (known bug); this test documents expected behavior and will fail until the route calls domain methods instead of a raw `updateOrderStatus` repo call

---

## 5. `POST /admin/restaurants`
**Risk: MEDIUM** — Tenant onboarding. If `tenantId` is not denormalized onto child records, all analytics for the new tenant return zeros.

### Scenario 5a — Creates tenant, restaurant, and N tables
- **Request**: `POST /admin/restaurants` body `{ tenantName: "Test Co", restaurantName: "Test Kitchen", tablesCount: 3 }`
- **Expected response**: `201` with created tenant and restaurant; 3 table records visible in `GET /admin/restaurants`
- **Side effect**: DB contains `Tenant`, `Restaurant`, 3 `Table` records with unique `qrCode` values
- **Why**: QR code uniqueness is critical — duplicate QR codes cause session routing to the wrong table

### Scenario 5b — Duplicate tenant name
- **Setup**: Tenant with same name already exists
- **Expected response**: `409` or appropriate error (depends on Prisma unique constraint behavior)

---

## 6. `GET /api/v1/restaurants/:id/metrics/daily`
**Risk: MEDIUM** — Dashboard entry point for restaurant managers. Returns zeros if `businessDate` / `tenantId` is not set on sessions.

### Scenario 6a — Returns metrics for a business date with closed sessions
- **Setup**: Seed restaurant, closed session with `businessDate: "2026-10-08"`, orders, payments
- **Request**: `GET /api/v1/restaurants/{id}/metrics/daily?date=2026-10-08`
- **Expected response**: `200` with non-zero `grossRevenue`, `ordersCompleted`
- **Why**: Confirms the `businessDate` filter works; currently broken due to tenantId/businessDate not being set at session creation

### Scenario 6b — Returns zero metrics for date with no sessions
- **Request**: `GET /api/v1/restaurants/{id}/metrics/daily?date=1999-01-01`
- **Expected response**: `200` with all numeric fields at `0` or `null`
- **Why**: API must not 500 on empty result sets

### Scenario 6c — Missing `date` query param
- **Expected response**: `400` with validation error
- **Why**: Without a date, the query has no boundary condition

---

## 7. `GET /api/v1/restaurants/:id/audit/eod`
**Risk: MEDIUM** — EOD JSON report. One unit test exists for the use case but no integration test validates the HTTP layer.

### Scenario 7a — Returns structured EOD report for a business date
- **Setup**: Seed closed session with payments and orders for `businessDate: "2026-10-08"`
- **Request**: `GET /api/v1/restaurants/{id}/audit/eod?date=2026-10-08`
- **Expected response**: `200` JSON matching `RestaurantEodReportResponse` shape (from `packages/shared-types`)
- **Why**: Validates that the use case result is correctly serialized by the Fastify route handler

### Scenario 7b — Empty date returns structured zeros (not 500)
- **Request**: `GET /api/v1/restaurants/{id}/audit/eod?date=1999-01-01`
- **Expected response**: `200` with empty `sessions: []` and zero financial summary

---

## 8. `GET /api/v1/restaurants/:id/audit/eod/export`
**Risk: MEDIUM** — CSV export. The `Content-Disposition` header and `Content-Type: text/csv` are the key assertions.

### Scenario 8a — Returns CSV file with correct headers
- **Setup**: Same seed as Scenario 7a
- **Request**: `GET /api/v1/restaurants/{id}/audit/eod/export?date=2026-10-08`
- **Expected response**: `200`, `Content-Type: text/csv`, `Content-Disposition: attachment; filename=eod-report-*.csv`, body starts with `"Business Date"`
- **Why**: Browser download depends on these headers; without a test, a future refactor can silently break file downloads
