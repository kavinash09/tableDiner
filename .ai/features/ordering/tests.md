# Ordering — Tests

## Existing Tests
**None.** 0 test files cover the ordering feature.

## Missing Tests

| Type | Description |
|---|---|
| Unit | `placeOrder` happy path — valid QR + items → Order + OrderItems created, correct `unitPrice` snapshot |
| Unit | `placeOrder` — invalid QR code → 404 error |
| Unit | `placeOrder` — no existing session → Session auto-created with status `OPEN` |
| Unit | `placeOrder` — `unitPrice` on `OrderItem` matches `menuItem.price` at time of call (price snapshot invariant) |
| Unit | `placeOrder` — `quantity = 0` → validation error |
| Unit | `placeOrder` — unknown `menuItemId` → error |
| Integration | `POST /table/:qrCode/order` — full request/response cycle with seeded DB |
| Integration | `GET /table/:qrCode` — returns table, restaurant, session, menu correctly |
