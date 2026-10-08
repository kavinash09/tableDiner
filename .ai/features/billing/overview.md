# Billing — Overview

## Business Purpose
Bill calculation and payment processing for a diner session. Aggregates all non-cancelled order items into a bill, accepts payment, records a `Payment`, and closes the `Session`.

## Entity Lifecycle

```
OPEN Session ──► GET /bill ──► review total
             ──► POST /pay  ──► create Payment (COMPLETED) → Session status → CLOSED
```

## Responsibilities
- `GET /table/:qrCode/bill` — compute and return itemized bill for the active session.
- `POST /table/:qrCode/pay` — record payment and close the session.

## Current Bugs

| Bug | Detail |
|---|---|
| BUG-B1 | `getBill()` reads live `menuItem.price` instead of snapshotted `OrderItem.unitPrice` — violates price snapshot invariant |
| BUG-B2 | `Payment` created without `tenantId` |
| BUG-B3 | `TableSession.closeSession()` domain method exists and validates payment amount — but is never called; raw Prisma used instead |

## Current Limitations
- Payment is mocked — no real payment gateway integration.
- `Payment.method` is always `null` (not set on checkout).
