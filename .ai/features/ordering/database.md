# Ordering — Database Entities

## Entities Touched

### `Table` (read-only during ordering)
Looked up by `qrCode` to resolve the restaurant and active session.

### `Session` (created if none exists)
| Column | Expected | Actual (Bug) |
|---|---|---|
| status | `'OPEN'` | `'ACTIVE'` ← BUG-O1 |
| tenantId | populated from Table.restaurant.tenantId | NOT SET ← BUG-O2 |
| businessDate | today's date (YYYY-MM-DD) | NOT SET ← BUG-O2 |
| tableId | Table.id | ✓ set |

### `Order`
| Column | Notes |
|---|---|
| sessionId | FK → Session |
| tenantId | NOT SET ← BUG-O2 |
| status | `PENDING` on creation |

### `OrderItem`
| Column | Notes |
|---|---|
| orderId | FK → Order |
| menuItemId | FK → MenuItem |
| unitPrice | **Snapshotted** from `menuItem.price` at order time (correct) |
| quantity | As submitted |
| lineTotal | `unitPrice × quantity` (computed in use case) |
| notes | Optional diner note |

## Price Snapshot
`OrderItem.unitPrice` is written once and must never be overwritten by later menu price changes. This is the source of truth for billing.
