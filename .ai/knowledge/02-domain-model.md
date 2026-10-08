# 02 — Domain Model

## Entity Hierarchy

```
Tenant
├── User (1:N)          — staff accounts
│   └── Account (1:N)  — Auth.js OAuth/credential accounts
├── Subscription (1:N)
├── TenantAuditLog (1:N)
└── Restaurant (1:N)
    ├── Table (1:N)
    │   └── Session (1:N)   — one OPEN session per table at a time
    │       ├── Order (1:N)
    │       │   └── OrderItem (1:N) → MenuItem (price snapshot)
    │       └── Payment (1:N)
    ├── MenuCategory (1:N)
    │   └── MenuItem (1:N)
    └── (businessDayCutoffHour: Int)
```

---

## Entity Summary

| Entity | Key Fields | Notes |
|---|---|---|
| `Tenant` | id, name, slug | Root aggregate for isolation |
| `User` | id, tenantId, email, hashedPassword, role | bcrypt password |
| `Account` | userId, provider, providerAccountId | Auth.js NextAuth table |
| `Subscription` | tenantId, plan, status, expiresAt | Billing record |
| `TenantAuditLog` | tenantId, actorId, action, payload, createdAt | Immutable event log |
| `Restaurant` | id, tenantId, name, businessDayCutoffHour, theme, qrTemplate, bannerUrl | One tenant may have multiple |
| `Table` | id, restaurantId, tenantId, qrCode, label | qrCode is the public identifier |
| `Session` | id, tableId, restaurantId, tenantId, status, businessDate, openedAt, closedAt | One OPEN per table |
| `Order` | id, sessionId, restaurantId, tenantId, status, businessDate, createdAt | Belongs to a session |
| `OrderItem` | id, orderId, menuItemId, tenantId, quantity, unitPrice, lineTotal | Price snapshotted at order time |
| `MenuItem` | id, restaurantId, categoryId, tenantId, name, price, imageUrl, isAvailable | Live price (not historical) |
| `MenuCategory` | id, restaurantId, tenantId, name, sortOrder | Groups menu items |
| `Payment` | id, sessionId, tenantId, amount, method, status, createdAt | Recorded per pay event |

---

## Relationship Table

| Parent | Child | Cardinality | FK on Child |
|---|---|---|---|
| Tenant | Restaurant | 1:N | `tenantId` |
| Tenant | User | 1:N | `tenantId` |
| Tenant | Subscription | 1:N | `tenantId` |
| Tenant | TenantAuditLog | 1:N | `tenantId` |
| User | Account | 1:N | `userId` |
| Restaurant | Table | 1:N | `restaurantId` |
| Restaurant | MenuCategory | 1:N | `restaurantId` |
| Restaurant | MenuItem | 1:N | `restaurantId` |
| MenuCategory | MenuItem | 1:N | `categoryId` |
| Table | Session | 1:N | `tableId` |
| Session | Order | 1:N | `sessionId` |
| Session | Payment | 1:N | `sessionId` |
| Order | OrderItem | 1:N | `orderId` |
| MenuItem | OrderItem | 1:N | `menuItemId` |

> **tenantId denormalized on**: `Session`, `Order`, `OrderItem`, `Payment`, `Table`, `MenuItem`, `MenuCategory` — enables single-index tenant-scoped queries without joins up to `Restaurant → Tenant`.

---

## Session State Machine

```
         ┌─────────┐
  open ──►  OPEN   ├──► CLOSED ──► FINALIZED
         └────┬────┘
              │
              └──────────────► REOPENED ──► CLOSED ──► FINALIZED
```

| Transition | Trigger |
|---|---|
| → OPEN | `placeOrder` when no active session exists for table |
| OPEN → CLOSED | Bill paid (`payBill`) |
| CLOSED → REOPENED | Manual staff action (reopen session) |
| REOPENED → CLOSED | Bill paid again |
| CLOSED → FINALIZED | End-of-day audit / close-out |

**Invariant**: Only one session with status `OPEN` or `REOPENED` may exist per table at any time.

---

## Order State Machine

```
RECEIVED ──► PREPARING ──► READY ──► SERVED
    │                                   │
    └──────────────────────────► CANCELLED / REJECTED
```

| Status | Meaning |
|---|---|
| `RECEIVED` | Order placed by diner, awaiting kitchen acknowledgement |
| `PREPARING` | Kitchen has started work |
| `READY` | Food ready for pickup/delivery |
| `SERVED` | Delivered to table |
| `CANCELLED` | Cancelled before preparation |
| `REJECTED` | Rejected by kitchen (e.g. unavailable item) |

Transitions are driven by `PATCH /kitchen/orders/:orderId` with `UpdateOrderStatusSchema`.

---

## Business Invariants

1. **Single active session per table** — a Table may have at most one Session in status `OPEN` or `REOPENED` at any time.
2. **Price snapshot on order** — `OrderItem.unitPrice` and `OrderItem.lineTotal` are captured at order placement time from `MenuItem.price`; subsequent price changes must not affect existing orders.
3. **businessDate boundary** — `Session.businessDate` and `Order.businessDate` are computed as `YYYY-MM-DD` using `Restaurant.businessDayCutoffHour`; dates roll over at the cutoff hour, not midnight.
4. **Tenant isolation** — all queries must be scoped by `tenantId`; no row-level security exists in the database — isolation is enforced entirely by application logic.
5. **No cross-tenant data leakage** — `tenantId` is denormalized on all operational entities (`Session`, `Order`, `OrderItem`, `Payment`) to allow fast single-table tenant scoping.
6. **Menu item availability** — orders must only include `MenuItem` records where `isAvailable = true`.
7. **Category/item deletion** — `deleteMenuCategory` and `deleteMenuItem` perform hard deletes; referential integrity must be confirmed before calling (no soft-delete guard exists).
8. **Subscription scope** — `Subscription` is tenant-level; plan enforcement is not implemented in MVP routes but the model is present.
