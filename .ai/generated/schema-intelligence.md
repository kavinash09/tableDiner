# Prisma Schema Intelligence

This document is generated directly from the Prisma schema (`packages/db/prisma/schema.prisma`). It acts as the single most important source of truth for the database architecture, ensuring that AI agents respect strict data relationships, indexing, and multi-tenant constraints.

## Entities Overview

| Entity | Primary Purpose | Soft Deletes? | Tenant Ownership |
|---|---|---|---|
| `Tenant` | Root multi-tenant isolation unit | Yes (`deletedAt`) | Self |
| `Subscription` | Tracks MRR & billing per tenant | No | `tenantId` |
| `TenantAuditLog` | Audit log for tenant mutations | No | `tenantId` |
| `Restaurant` | Individual location/branch | Yes (`deletedAt`) | `tenantId` |
| `Table` | Physical diner location | Yes (`deletedAt`) | `restaurant.tenantId` |
| `MenuCategory` | Grouping for menu items | Yes (`deletedAt`) | `restaurant.tenantId` |
| `MenuItem` | Individual product | Yes (`deletedAt`) | `restaurant.tenantId` |
| `Session` | Customer seating & financial rollup | No | Denormalized `tenantId` |
| `Order` | Batch of items sent to kitchen | No | Denormalized `tenantId` |
| `OrderItem` | Snapshot of purchased product | No (Has `isVoided`) | Denormalized `tenantId` |
| `Payment` | Transaction record | No | Denormalized `tenantId` |
| `User` | Auth.js user | No | `tenantId` (nullable) |
| `Account` | Auth.js OAuth accounts | No | `user.tenantId` |

---

## Detailed Entity Specifications

### `Tenant`
- **Fields**: `id`, `name`, `onboardingStatus` (LEAD, ONBOARDING, ACTIVE, SUSPENDED, DECOMMISSIONED), `isActive`, `deletedAt`, `createdAt`, `updatedAt`.
- **Relations**: 1:N with `Restaurant`, `User`, `Subscription`, `TenantAuditLog`. Denormalized 1:N with `Session`, `Order`, `OrderItem`, `Payment`.
- **Unique Constraints**: None.
- **Indexes**: None.

### `Subscription`
- **Fields**: `id`, `tenantId`, `billingCycle`, `mrr`, `nextBillingDate`, `status` (ACTIVE, PAST_DUE, CANCELED).
- **Relations**: Belongs to `Tenant`.
- **Indexes**: `@@index([tenantId])`

### `TenantAuditLog`
- **Fields**: `id`, `tenantId`, `actorId`, `action`.
- **Relations**: Belongs to `Tenant`.
- **Indexes**: `@@index([tenantId])`

### `Restaurant`
- **Fields**: `id`, `tenantId`, `name`, `subscriptionTier`, `theme`, `qrTemplate`, `bannerUrl`, `businessDayCutoffHour`, `isActive`, `deletedAt`.
- **Relations**: Belongs to `Tenant`. 1:N with `Table`, `Session`, `MenuCategory`, `MenuItem`.
- **Indexes**: `@@index([tenantId])`

### `Table`
- **Fields**: `id`, `name`, `qrCode`, `isActive`, `restaurantId`, `deletedAt`.
- **Relations**: Belongs to `Restaurant`. 1:N with `Session`.
- **Unique Constraints**: `qrCode` is `@unique`.
- **Indexes**: `@@index([restaurantId])`

### `MenuCategory`
- **Fields**: `id`, `name`, `isActive`, `restaurantId`, `deletedAt`.
- **Relations**: Belongs to `Restaurant`. 1:N with `MenuItem`.
- **Indexes**: `@@index([restaurantId])`

### `MenuItem`
- **Fields**: `id`, `name`, `description`, `price` (Float), `imageUrl`, `isActive`, `categoryId`, `restaurantId`, `deletedAt`.
- **Relations**: Belongs to `Restaurant` and `MenuCategory`. 1:N with `OrderItem`.
- **Indexes**: `@@index([restaurantId])`, `@@index([categoryId])`

### `Session`
- **Fields**: `id`, `tenantId`, `restaurantId`, `tableId`, `status` (OPEN, CLOSED, REOPENED, FINALIZED), `businessDate`, `guestCount`, `subtotal`, `taxAmount`, `discountAmount`, `tipAmount`, `refundedAmount`, `totalAmount`, `closedAt`, `reopenedAt`, `reopenedBy`, `reopenReason`.
- **Relations**: Belongs to `Tenant`, `Restaurant`, `Table`. 1:N with `Order`, `Payment`.
- **Indexes**: 
  - `@@index([tenantId, businessDate])`
  - `@@index([tenantId, createdAt])`
  - `@@index([tenantId, closedAt])`
  - `@@index([tenantId, status])`
  - `@@index([restaurantId, businessDate])`
  - `@@index([businessDate])`

### `Order`
- **Fields**: `id`, `tenantId`, `status` (RECEIVED, PREPARING, READY, SERVED, CANCELLED, REJECTED), `businessDate`, `sessionId`, `acceptedAt`, `readyAt`, `servedAt`, `cancelledAt`, `cancellationReason`.
- **Relations**: Belongs to `Tenant`, `Session`. 1:N with `OrderItem`.
- **Indexes**: 
  - `@@index([tenantId, acceptedAt])`
  - `@@index([tenantId, readyAt])`
  - `@@index([tenantId, servedAt])`
  - `@@index([tenantId, status])`
  - `@@index([sessionId])`
  - `@@index([createdAt])`

### `OrderItem`
- **Fields**: `id`, `tenantId`, `quantity`, `notes`, `unitPrice` (Snapshot), `lineTotal` (Snapshot), `isVoided`, `voidReason`, `voidedAt`, `voidedBy`, `orderId`, `menuItemId`.
- **Relations**: Belongs to `Tenant`, `Order`, `MenuItem`.
- **Indexes**: 
  - `@@index([tenantId, menuItemId])`
  - `@@index([orderId])`

### `Payment`
- **Fields**: `id`, `tenantId`, `status` (PENDING, COMPLETED, FAILED), `amount`, `providerId`, `method`, `sessionId`.
- **Relations**: Belongs to `Tenant`, `Session`.
- **Indexes**: 
  - `@@index([tenantId, method])`
  - `@@index([sessionId])`
  - `@@index([createdAt])`

### `User` (NextAuth)
- **Fields**: `id`, `name`, `email` (`@unique`), `emailVerified`, `image`, `password`, `tenantId`.
- **Relations**: Belongs to `Tenant` (optional). 1:N with `Account`.
- **Indexes**: `@@index([tenantId])`

### `Account` (NextAuth)
- **Fields**: `id`, `userId`, `type`, `provider`, `providerAccountId`, `refresh_token`, `access_token`, `expires_at`, `token_type`, `scope`, `id_token`, `session_state`.
- **Relations**: Belongs to `User`.
- **Unique Constraints**: `@@unique([provider, providerAccountId])`
- **Indexes**: `@@index([userId])`

---

## Architectural Data Invariants

1. **Strict Soft Deletes**: `Tenant`, `Restaurant`, `Table`, `MenuCategory`, and `MenuItem` all use `deletedAt` for soft deletes. Do not use `prisma.<model>.delete()`.
2. **Denormalized Multi-Tenancy**: The `tenantId` is explicitly denormalized onto `Session`, `Order`, `OrderItem`, and `Payment` to allow for cross-restaurant platform-level metrics without extreme table joins. This means **all creation logic for these operational entities must populate `tenantId`**.
3. **Price Snapshotting**: `OrderItem` contains `unitPrice` and `lineTotal`. These fields must be explicitly populated at creation using the live `MenuItem.price` and then never mutated by upstream menu price changes.
4. **Business Date Grouping**: `Session` and `Order` include a `businessDate` string (e.g. `YYYY-MM-DD`). This date is computed based on the `Restaurant.businessDayCutoffHour` and must be populated upon creation to power daily metrics correctly.

