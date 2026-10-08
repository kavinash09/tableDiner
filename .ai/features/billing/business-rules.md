# Billing — Business Rules

## Rules

| # | Rule |
|---|---|
| BR-B1 | Billing requires an `OPEN` Session. No session or non-`OPEN` session → error. |
| BR-B2 | Bill total = sum of `lineTotal` for all non-cancelled `OrderItem`s in the session. |
| BR-B3 | Payment `amount` must be ≥ bill total. Underpayment → rejected. |
| BR-B4 | On successful payment: create `Payment` record with `status = COMPLETED`, set `Session.status = CLOSED` in a single transaction. |
| BR-B5 | `Session.closedAt` must be set when status transitions to `CLOSED`. |

## Known Bugs / Violations

> [!CAUTION]
> **BUG-B1**: `getBill()` computes total using live `menuItem.price`. If menu prices change after an order is placed, the bill amount is incorrect. **Must use `OrderItem.unitPrice`** (the snapshotted value) instead.

> [!CAUTION]
> **BUG-B2**: `Payment.tenantId` is not set on creation. This breaks tenant-scoped financial reporting and analytics.

> [!WARNING]
> **BUG-B3**: `TableSession.closeSession()` domain method validates payment amount and enforces invariants but is bypassed. Raw Prisma `update` is called directly, risking inconsistent state.
