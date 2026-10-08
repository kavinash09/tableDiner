# Ordering — Overview

## Business Purpose
Core diner ordering flow initiated by QR code scan. Customers scan a table QR code, view the restaurant menu, add items, and submit an order. If no session exists for the table, one is auto-created at the time the order is placed.

## Entity Lifecycle

```
QR Scan → GET /table/:qrCode → view menu
        → POST /table/:qrCode/order → [auto-create Session if none] → create Order + OrderItems
```

## State Machine (Session auto-creation)
```
[No Session] ──► auto-create Session (status: OPEN)
[OPEN Session] ──► append Order to existing Session
[CLOSED Session] ──► auto-create new Session (status: OPEN)
```

## Responsibilities
- `GET /table/:qrCode` — resolve table, restaurant, active session, full menu.
- `POST /table/:qrCode/order` — validate items, snapshot prices, persist Order + OrderItems.

## Current Bugs
| Bug | Detail |
|---|---|
| BUG-O1 | Session created with `status: 'ACTIVE'` — schema enum requires `'OPEN'` |
| BUG-O2 | Session created without `tenantId` or `businessDate` |
| BUG-O3 | Domain entity `TableSession.addOrder()` exists but is never called — raw Prisma create used instead |

## Key Invariant
`OrderItem.unitPrice` must be snapshotted from `menuItem.price` at the moment the order is placed — not read back later from the live menu.
