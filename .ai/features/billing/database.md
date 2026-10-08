# Billing — Database Entities

## Entities

### `Payment`
| Column | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| tenantId | String | NOT SET on creation ← BUG-B2 |
| sessionId | String | FK → Session |
| status | Enum | `COMPLETED` on successful checkout |
| amount | Float | Amount paid by diner |
| providerId | String? | External payment gateway ref (unused — always null) |
| method | Enum? | Payment method (CARD / CASH / etc.) — NOT SET ← always null |

### `Session` (mutated on payment)
| Column | Transition | Notes |
|---|---|---|
| status | `OPEN` → `CLOSED` | Set in Prisma transaction alongside Payment create |
| closedAt | null → DateTime | Timestamp of closure |

## Transaction Boundary
`Payment` insert and `Session` status update must occur atomically. Both are performed inside a Prisma `$transaction` call.

## Bill Computation (BUG)
`getBill()` joins `Session → Order → OrderItem → MenuItem` and reads `MenuItem.price` for the total. **Must read `OrderItem.unitPrice`** to honour the price snapshot invariant.
