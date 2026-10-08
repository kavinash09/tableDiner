# 03 — Database Model

> **Source**: `packages/db/prisma/schema.prisma`  
> **Engine**: SQLite via Prisma ORM. All IDs are `String` (cuid/uuid). Timestamps are `DateTime`.

---

## Tables

### `Tenant`
| Column | Type | Constraints |
|---|---|---|
| id | String | PK |
| name | String | |
| slug | String | UNIQUE |
| createdAt | DateTime | default now() |
| updatedAt | DateTime | @updatedAt |

### `User`
| Column | Type | Constraints |
|---|---|---|
| id | String | PK |
| tenantId | String | FK → Tenant.id |
| email | String | UNIQUE |
| hashedPassword | String? | nullable (OAuth paths) |
| role | String | e.g. `ADMIN`, `STAFF` |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### `Account`
| Column | Type | Constraints |
|---|---|---|
| id | String | PK |
| userId | String | FK → User.id |
| provider | String | |
| providerAccountId | String | |
| *(Auth.js standard fields)* | | |

### `Subscription`
| Column | Type | Constraints |
|---|---|---|
| id | String | PK |
| tenantId | String | FK → Tenant.id |
| plan | String | |
| status | String | |
| expiresAt | DateTime? | |

### `TenantAuditLog`
| Column | Type | Constraints |
|---|---|---|
| id | String | PK |
| tenantId | String | FK → Tenant.id |
| actorId | String? | FK → User.id (nullable for system) |
| action | String | |
| payload | String? | JSON blob |
| createdAt | DateTime | |

### `Restaurant`
| Column | Type | Constraints |
|---|---|---|
| id | String | PK |
| tenantId | String | FK → Tenant.id |
| name | String | |
| businessDayCutoffHour | Int | default 0 (midnight) |
| theme | String? | |
| qrTemplate | String? | |
| bannerUrl | String? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### `Table`
| Column | Type | Constraints |
|---|---|---|
| id | String | PK |
| restaurantId | String | FK → Restaurant.id |
| tenantId | String | denormalized FK → Tenant.id |
| qrCode | String | UNIQUE — public diner identifier |
| label | String | human-readable (e.g. "Table 4") |

### `Session`
| Column | Type | Constraints |
|---|---|---|
| id | String | PK |
| tableId | String | FK → Table.id |
| restaurantId | String | FK → Restaurant.id |
| tenantId | String | denormalized FK → Tenant.id |
| status | String | OPEN \| CLOSED \| REOPENED \| FINALIZED |
| businessDate | String? | YYYY-MM-DD, computed |
| openedAt | DateTime | |
| closedAt | DateTime? | |

### `Order`
| Column | Type | Constraints |
|---|---|---|
| id | String | PK |
| sessionId | String | FK → Session.id |
| restaurantId | String | FK → Restaurant.id |
| tenantId | String | denormalized FK → Tenant.id |
| status | String | RECEIVED \| PREPARING \| READY \| SERVED \| CANCELLED \| REJECTED |
| businessDate | String? | YYYY-MM-DD, computed |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### `OrderItem`
| Column | Type | Constraints |
|---|---|---|
| id | String | PK |
| orderId | String | FK → Order.id |
| menuItemId | String | FK → MenuItem.id |
| tenantId | String | denormalized FK → Tenant.id |
| quantity | Int | |
| unitPrice | Float | **snapshot** — copied from MenuItem.price at order time |
| lineTotal | Float | **snapshot** — quantity × unitPrice at order time |

### `MenuItem`
| Column | Type | Constraints |
|---|---|---|
| id | String | PK |
| restaurantId | String | FK → Restaurant.id |
| categoryId | String | FK → MenuCategory.id |
| tenantId | String | denormalized FK → Tenant.id |
| name | String | |
| price | Float | **live price** — not historical |
| imageUrl | String? | |
| isAvailable | Boolean | default true |

### `MenuCategory`
| Column | Type | Constraints |
|---|---|---|
| id | String | PK |
| restaurantId | String | FK → Restaurant.id |
| tenantId | String | denormalized FK → Tenant.id |
| name | String | |
| sortOrder | Int | default 0 |

### `Payment`
| Column | Type | Constraints |
|---|---|---|
| id | String | PK |
| sessionId | String | FK → Session.id |
| tenantId | String | denormalized FK → Tenant.id |
| amount | Float | |
| method | String | e.g. `CARD`, `CASH` |
| status | String | e.g. `PENDING`, `COMPLETED` |
| createdAt | DateTime | |

---

## Primary / Foreign Key Relationships

| Table | FK Column | References |
|---|---|---|
| User | tenantId | Tenant.id |
| Account | userId | User.id |
| Subscription | tenantId | Tenant.id |
| TenantAuditLog | tenantId | Tenant.id |
| Restaurant | tenantId | Tenant.id |
| Table | restaurantId | Restaurant.id |
| Table | tenantId | Tenant.id (denorm) |
| Session | tableId | Table.id |
| Session | restaurantId | Restaurant.id |
| Session | tenantId | Tenant.id (denorm) |
| Order | sessionId | Session.id |
| Order | restaurantId | Restaurant.id |
| Order | tenantId | Tenant.id (denorm) |
| OrderItem | orderId | Order.id |
| OrderItem | menuItemId | MenuItem.id |
| OrderItem | tenantId | Tenant.id (denorm) |
| MenuItem | restaurantId | Restaurant.id |
| MenuItem | categoryId | MenuCategory.id |
| MenuItem | tenantId | Tenant.id (denorm) |
| MenuCategory | restaurantId | Restaurant.id |
| MenuCategory | tenantId | Tenant.id (denorm) |
| Payment | sessionId | Session.id |
| Payment | tenantId | Tenant.id (denorm) |

---

## Notable Indexes

| Table | Indexed Column(s) | Purpose |
|---|---|---|
| Table | qrCode | Unique — QR scan lookup |
| User | email | Unique — auth lookup |
| Tenant | slug | Unique — tenant routing |
| Session | tableId + status | Active session per table |
| Order | sessionId | Orders by session |
| OrderItem | orderId | Items by order |
| Payment | sessionId | Payments by session |

> Explicit index declarations depend on the actual `@@index` annotations in `schema.prisma`. The above are the minimum expected indexes given query patterns.

---

## Multi-Tenancy Strategy

- **Approach**: Application-level isolation. No database-level row-level security (RLS).
- **Mechanism**: `tenantId` is present on every operational entity (`Restaurant`, `Table`, `Session`, `Order`, `OrderItem`, `Payment`, `MenuItem`, `MenuCategory`). Every query must include a `WHERE tenantId = ?` clause.
- **Risk**: A missing `tenantId` filter in any query results in cross-tenant data exposure. There is no DB-level guardrail.

---

## `businessDate` Logic

- **Fields**: `Session.businessDate` (String?), `Order.businessDate` (String?)
- **Format**: `YYYY-MM-DD`
- **Computation**: Derived from `Restaurant.businessDayCutoffHour`. If the current wall-clock time is before the cutoff hour, the businessDate is assigned the **previous calendar day**. This allows late-night orders (e.g. 1 AM with cutoff at 4) to be attributed to the correct business day.
- **Storage**: Stored as a plain string. Not a database `DATE` type — no timezone conversion at the DB layer.

---

## Financial Snapshot Fields

| Table | Field | Snapshot Point | Risk if Not Snapshotted |
|---|---|---|---|
| OrderItem | unitPrice | At `placeOrder` | Price change retroactively alters revenue |
| OrderItem | lineTotal | At `placeOrder` | Same as above |

> ⚠️ **Known Bug**: `getBill` (AppUseCases) reads `MenuItem.price` (live) instead of `OrderItem.unitPrice` (snapshot). Bill totals can diverge from what the diner was charged if menu prices change mid-session. See `05-use-case-catalog.md`.

---

## Soft Delete

No soft-delete pattern is implemented in the schema. `deleteMenuCategory` and `deleteMenuItem` in `AppUseCases` perform **hard deletes**. Orphaned `OrderItem` records referencing a deleted `MenuItem` may cause referential integrity issues if FK constraints are enforced.
