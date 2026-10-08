# Ordering — Business Rules

## Rules

| # | Rule |
|---|---|
| BR-O1 | QR code must resolve to an existing `Table`. Invalid QR → 404. |
| BR-O2 | If no `OPEN` Session exists for the table, auto-create one before placing the order. |
| BR-O3 | Each `OrderItem.unitPrice` **must** be snapshotted from `menuItem.price` at order time. |
| BR-O4 | `OrderItem.lineTotal = unitPrice × quantity`. |
| BR-O5 | Every item must have `quantity ≥ 1`. |
| BR-O6 | `menuItemId` must reference a valid, active `MenuItem`. |

## Known Bugs / Violations

> [!CAUTION]
> **BUG-O1**: Session creation sets `status: 'ACTIVE'`. The Prisma schema enum defines `OPEN / CLOSED / REOPENED / FINALIZED`. This causes a runtime error or silent mismatch.

> [!CAUTION]
> **BUG-O2**: Session is created without `tenantId` or `businessDate`. Downstream analytics return zero for all real sessions because `businessDate` is `null`.

> [!WARNING]
> **BUG-O3**: Domain entity `TableSession.addOrder()` encapsulates session-level business logic (max items, status checks) but is never invoked. The use case calls raw Prisma `create` directly, bypassing domain invariants.
