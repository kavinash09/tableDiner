# Billing — Tests

## Existing Tests
**None.** 0 test files cover the billing feature.

## Missing Tests

| Type | Description |
|---|---|
| Unit | `getBill` happy path — returns correct itemized total using `OrderItem.unitPrice` (not live price) |
| Unit | `getBill` — no `OPEN` session → error |
| Unit | `getBill` — excluded cancelled items from total |
| Unit | `payBill` — sufficient amount → Payment created, Session closed |
| Unit | `payBill` — insufficient amount → rejected, Session unchanged |
| Unit | `payBill` — no `OPEN` session → error |
| Integration | `GET /table/:qrCode/bill` — correct response shape |
| Integration | `POST /table/:qrCode/pay` — full payment cycle: session transitions to CLOSED |
| Regression | Price snapshot: place order at price X, change menu price to Y, bill must still show X |
