# Analytics Data Model Audit

**Audit Date**: 2026-10-09  
**Auditor**: Principal Analytics Architect  
**Scope**: Complete database schema audit (`packages/db/prisma/schema.prisma`) evaluating analytical read capabilities and limitations.

---

## 1. Schema Entity Metadata Matrix

| Entity | Available Timestamps | Status Transitions Logged? | Soft Delete Support | Historical Retention | Tenant Ownership Pattern |
|---|---|---|---|---|---|
| **Tenant** | `createdAt`, `updatedAt`, `deletedAt` | ❌ No status transition table | `isActive`, `deletedAt` | Indefinite row storage | Root Identity (`id`) |
| **Subscription** | `createdAt`, `updatedAt`, `nextBillingDate` | ❌ No state transition log | ❌ Hard mutate only | Indefinite | Direct Foreign Key (`tenantId`) |
| **TenantAuditLog**| `createdAt` | ⚠️ Immutable insert log (Unused) | ❌ No soft delete | Indefinite | Direct Foreign Key (`tenantId`) |
| **Restaurant** | `createdAt`, `updatedAt`, `deletedAt` | ❌ No log | `isActive`, `deletedAt` | Indefinite | Direct Foreign Key (`tenantId`) |
| **Table** | `createdAt`, `updatedAt`, `deletedAt` | ❌ No log | `isActive`, `deletedAt` | Indefinite | Hierarchical (`restaurant.tenantId`) |
| **MenuCategory**| `createdAt`, `updatedAt`, `deletedAt` | ❌ No log | `isActive`, `deletedAt` | Indefinite | Hierarchical (`restaurant.tenantId`) |
| **MenuItem** | `createdAt`, `updatedAt`, `deletedAt` | ❌ No price history table | `isActive`, `deletedAt` | Indefinite | Hierarchical (`restaurant.tenantId`) |
| **Session** | `createdAt`, `updatedAt`, `closedAt`, `reopenedAt` | ❌ Status overwritten in-place | ❌ No `deletedAt` (Status based) | Indefinite | Denormalized (`tenantId` on row) |
| **Order** | `createdAt`, `updatedAt`, `acceptedAt`, `readyAt`, `servedAt`, `cancelledAt` | ❌ Status overwritten in-place | ❌ No `deletedAt` | Indefinite | Denormalized (`tenantId` on row) |
| **OrderItem** | `createdAt`, `updatedAt`, `voidedAt` | ❌ Void state in-place | ❌ No `deletedAt` (Flag: `isVoided`)| Indefinite | Denormalized (`tenantId` on row) |
| **Payment** | `createdAt`, `updatedAt` | ❌ Status overwritten in-place | ❌ No `deletedAt` | Indefinite | Denormalized (`tenantId` on row) |
| **User** | `createdAt`, `updatedAt`, `emailVerified` | ❌ No log | ❌ Hard mutate only | Indefinite | Direct Foreign Key (`tenantId` nullable) |
| **Account** | `createdAt`, `updatedAt` | ❌ No log | ❌ Hard cascade delete | Indefinite | Hierarchical (`user.tenantId`) |

---

## 2. Analytics Domain Capability Assessment

### 2.1 Table Analytics: PARTIALLY SUPPORTED
- **Current Data Model Reality**:
  - `Session` has foreign key `tableId`.
  - Can theoretically calculate: Revenue by Table, Turn count by Table, Average duration by Table.
- **Current Blocker**:
  - No index on `Session.tableId` exists.
  - Queries would require sequential table scans across `Session` to aggregate per table.
  - If a table is soft-deleted (`Table.isActive = false`), sessions still point to it, but table names cannot be queried if joined with `isActive = true`.

---

### 2.2 Menu Performance Analytics: STRUCTURALLY READY, UNINDEXED
- **Current Data Model Reality**:
  - `OrderItem` correctly snapshots `unitPrice` and `lineTotal` alongside `menuItemId` and `quantity`.
  - `isVoided` flag prevents voided dishes from inflating sales.
- **Current Blocker**:
  - Index `@@index([tenantId, menuItemId])` exists, but there is **no index on `[orderId]` with `createdAt` or `businessDate`**.
  - To query menu sales for a specific date, Prisma must join `OrderItem → Order → businessDate`, performing full join scans without a composite index on `OrderItem(tenantId, menuItemId, createdAt)`.

---

### 2.3 Session Analytics: HIGHLY SUPPORTED
- **Current Data Model Reality**:
  - `Session` is heavily indexed for analytics:
    - `@@index([tenantId, businessDate])`
    - `@@index([tenantId, createdAt])`
    - `@@index([tenantId, closedAt])`
    - `@@index([tenantId, status])`
    - `@@index([restaurantId, businessDate])`
    - `@@index([businessDate])`
  - Explicit snapshot columns for financial rollups: `subtotal`, `taxAmount`, `discountAmount`, `tipAmount`, `refundedAmount`, `totalAmount`.
- **Current Blocker**:
  - Financial columns are currently unpopulated in checkout handlers (remain `0.0`).

---

### 2.4 Occupancy Analytics: PARTIALLY SUPPORTED
- **Current Data Model Reality**:
  - Supported via `Session.createdAt` and `Session.closedAt`.
- **Current Blocker**:
  - SQLite lacks native date-difference scalar functions (like Postgres `AGE()` or `EXTRACT(EPOCH FROM ...)`).
  - Occupancy duration must be computed by loading raw session timestamp arrays into Node.js process memory.
  - Lacks table capacity weighting: Occupancy treats 2 diners at a 6-top table identically to 6 diners at a 6-top table.

---

### 2.5 Funnel Analytics: TENANT ONLY (DINER FUNNEL NOT SUPPORTED)
- **Current Data Model Reality**:
  - SaaS Tenant Funnel: **Supported**. `Tenant.onboardingStatus` has clean states (`LEAD`, `ONBOARDING`, `ACTIVE`, `SUSPENDED`, `DECOMMISSIONED`).
  - Diner Ordering Funnel: **NOT SUPPORTED**. The database has no tables or tracking for:
    - QR Code Scans / Page Views
    - Cart Additions / Abandoned Carts
    - Checkout Initiations vs Payment Completions

---

### 2.6 Customer Behavior Analytics: COMPLETELY UNSUPPORTED
- **Current Data Model Reality**:
  - Customers in TableDiner are completely anonymous.
  - `Session` has no `customerId`, `customerPhone`, `customerEmail`, or loyalty identifier.
  - It is impossible to calculate:
    - Repeat Diner Rate
    - Customer Lifetime Value (LTV)
    - Churn between visits
    - Guest preferences or dish affinities

