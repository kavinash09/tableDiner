# Business Event Discovery

**Audit Date**: 2026-10-09  
**Auditor**: Principal Analytics Architect  
**Scope**: All state transitions and lifecycle triggers across TableDiner.

---

## 1. Overview

This document catalogs every business event executed within the codebase. It details where events originate, how they mutate state, what data payload exists, what timestamps are recorded, and which entities are impacted.

**Critical Architectural Finding**: There is **no decoupled event bus, message broker, or event log table** (e.g., Kafka, Redis PubSub, RabbitMQ, or an `Event` database table). All events occur synchronously inside HTTP request handlers and direct Prisma mutations.

---

## 2. Event Catalog

### Event 1: Table QR Scanned / Menu Viewed
- **Event Name**: `TABLE_MENU_VIEWED`
- **Trigger Location**: Customer scanning QR code or opening `http://localhost:5173/?qr=<code`
- **Source Code Location**: `apps/api/src/index.ts` (Lines 80–91), calling `AppUseCases.getTableDetails`
- **Data Available**: `qrCode`, `table.id`, `table.name`, `restaurant.id`, `menuCategories`, `menuItems`
- **Timestamp Available**: **None recorded in DB**. (Stateless GET request).
- **Associated Entities**: `Table`, `Restaurant`, `MenuCategory`, `MenuItem`, `Session`

---

### Event 2: Dining Session Started (Auto-Session Creation)
- **Event Name**: `SESSION_STARTED`
- **Trigger Location**: Diner submitting the first cart order for an unoccupied table.
- **Source Code Location**: `apps/api/src/core/use-cases/AppUseCases.ts` (Lines 44–47) → `PrismaSessionRepository.createActiveSession` (`apps/api/src/adapters/secondary/db/PrismaRepositories.ts` Lines 34–38)
- **Data Available**: `id`, `tenantId`, `restaurantId`, `tableId`, `status = 'OPEN'`, `businessDate`, `guestCount = 1`
- **Timestamp Available**: `createdAt` (`DateTime @default(now())`). (Note: `openedAt` is null by default in schema; `createdAt` serves as start time).
- **Associated Entities**: `Session`, `Table`, `Restaurant`, `Tenant`

---

### Event 3: Order Placed / Created
- **Event Name**: `ORDER_CREATED`
- **Trigger Location**: Customer Web clicking "Send to Kitchen" (`POST /table/:qrCode/order`)
- **Source Code Location**: `apps/api/src/core/use-cases/AppUseCases.ts` (Lines 40–60) → `PrismaOrderRepository.createOrder` (`apps/api/src/adapters/secondary/db/PrismaRepositories.ts` Lines 49–63)
- **Data Available**:
  - `Order`: `id`, `tenantId`, `sessionId`, `businessDate`, `status = 'RECEIVED'`
  - `OrderItem`: `id`, `tenantId`, `orderId`, `menuItemId`, `quantity`, `notes`, `unitPrice` (snapshot), `lineTotal` (snapshot)
- **Timestamp Available**: `Order.createdAt`, `OrderItem.createdAt`.
- **Associated Entities**: `Order`, `OrderItem`, `Session`, `MenuItem`, `Tenant`

---

### Event 4: Order Accepted in Kitchen
- **Event Name**: `ORDER_ACCEPTED`
- **Trigger Location**: Planned transition when kitchen staff acknowledges ticket.
- **Source Code Location**: Defined in `packages/db/prisma/schema.prisma` (`acceptedAt DateTime?`) and domain entity `apps/api/src/core/domain/Order.ts` (`markPreparing()`).
- **Data Available**: None in production runtime.
- **Timestamp Available**: ⚠️ **MISSING IN RUNTIME**. `apps/api/src/index.ts` PATCH route `/kitchen/orders/:orderId` calls `updateOrderStatus(orderId, status)`, which only writes `data: { status }` in `PrismaOrderRepository.ts`. It **never sets `acceptedAt`**.
- **Associated Entities**: `Order`

---

### Event 5: Order Prepared / Ready for Service
- **Event Name**: `ORDER_READY`
- **Trigger Location**: Kitchen staff dragging ticket to "READY" column or clicking button.
- **Source Code Location**: `apps/api/src/index.ts` (Lines 171–183) → `updateOrderStatus(orderId, 'READY')`
- **Data Available**: `orderId`, `status: 'READY'`
- **Timestamp Available**: ⚠️ **MISSING IN RUNTIME**. Field `Order.readyAt` is declared in schema but **never populated** by `PrismaOrderRepository.updateOrderStatus`.
- **Associated Entities**: `Order`

---

### Event 6: Order Served to Table
- **Event Name**: `ORDER_SERVED`
- **Trigger Location**: Kitchen/waiter staff marking ticket as served.
- **Source Code Location**: `apps/api/src/index.ts` (Lines 171–183) → `updateOrderStatus(orderId, 'SERVED')`
- **Data Available**: `orderId`, `status: 'SERVED'`
- **Timestamp Available**: ⚠️ **MISSING IN RUNTIME**. Field `Order.servedAt` is declared in schema but **never populated** by `PrismaOrderRepository.updateOrderStatus`.
- **Associated Entities**: `Order`

---

### Event 7: Order Cancelled / Rejected
- **Event Name**: `ORDER_CANCELLED`
- **Trigger Location**: Order cancellation or rejection.
- **Source Code Location**: Supported via `UpdateOrderStatusSchema` enum (`CANCELLED`, `REJECTED`).
- **Data Available**: `orderId`, `status`
- **Timestamp Available**: ⚠️ **MISSING IN RUNTIME**. Fields `cancelledAt` and `cancellationReason` exist in schema but are **never written** by current repository implementation.
- **Associated Entities**: `Order`

---

### Event 8: Bill Inquired / Calculated
- **Event Name**: `BILL_REQUESTED`
- **Trigger Location**: Diner opening "Your Bill" modal in Customer Web (`GET /table/:qrCode/bill`).
- **Source Code Location**: `apps/api/src/core/use-cases/AppUseCases.ts` (Lines 63–82)
- **Data Available**: `sessionId`, itemized order list, `totalAmount`
- **Timestamp Available**: **None recorded**. Stateless read query.
- **Associated Entities**: `Session`, `Order`, `OrderItem`, `MenuItem`

---

### Event 9: Payment Completed & Tab Closed
- **Event Name**: `PAYMENT_COMPLETED_AND_SESSION_CLOSED`
- **Trigger Location**: Diner clicking "Pay & Close Tab" in Customer Web (`POST /table/:qrCode/pay`).
- **Source Code Location**: `apps/api/src/core/use-cases/AppUseCases.ts` (Lines 84–93) → `PrismaPaymentRepository.processCheckout` (`apps/api/src/adapters/secondary/db/PrismaRepositories.ts` Lines 88–94)
- **Data Available**: `Payment`: `id`, `tenantId`, `sessionId`, `status: 'COMPLETED'`, `amount`. `Session`: `status: 'CLOSED'`.
- **Timestamp Available**: `Payment.createdAt`, `Payment.updatedAt`.
  - ⚠️ **CRITICAL DEFECT**: `Session.closedAt` is **NOT set** during `processCheckout` (only `data: { status: 'CLOSED' }` is written).
  - ⚠️ **CRITICAL DEFECT**: `Session.totalAmount`, `subtotal`, `taxAmount`, `tipAmount` are **NOT updated** upon checkout.
- **Associated Entities**: `Payment`, `Session`, `Table`, `Tenant`

---

### Event 10: Restaurant Settings Updated
- **Event Name**: `RESTAURANT_SETTINGS_UPDATED`
- **Trigger Location**: Manager updating Theme or QR Template in Restaurant Admin (`PATCH /restaurant/:id/settings`).
- **Source Code Location**: `apps/api/src/index.ts` (Lines 226–238) → `PrismaRestaurantRepository.updateSettings`
- **Data Available**: `id`, `theme`, `qrTemplate`
- **Timestamp Available**: `Restaurant.updatedAt`
- **Associated Entities**: `Restaurant`, `Tenant`

---

### Event 11: Restaurant Banner Uploaded
- **Event Name**: `RESTAURANT_BANNER_UPLOADED`
- **Trigger Location**: Multipart upload to `POST /restaurant/:id/banner`.
- **Source Code Location**: `apps/api/src/index.ts` (Lines 240–257)
- **Data Available**: `bannerUrl`
- **Timestamp Available**: `Restaurant.updatedAt`
- **Associated Entities**: `Restaurant`

---

### Event 12: Menu Category Created
- **Event Name**: `MENU_CATEGORY_CREATED`
- **Trigger Location**: Admin creating category (`POST /restaurant/:id/categories`).
- **Source Code Location**: `apps/api/src/index.ts` (Lines 279–291) → `PrismaRestaurantRepository.createCategory`
- **Data Available**: `id`, `name`, `restaurantId`, `isActive: true`
- **Timestamp Available**: `MenuCategory.createdAt`
- **Associated Entities**: `MenuCategory`, `Restaurant`

---

### Event 13: Menu Category Soft-Deleted
- **Event Name**: `MENU_CATEGORY_DELETED`
- **Trigger Location**: Admin clicking delete category (`DELETE /category/:id`).
- **Source Code Location**: `apps/api/src/adapters/secondary/db/PrismaRepositories.ts` (Lines 149–154)
- **Data Available**: `id`, `isActive: false`, `deletedAt`
- **Timestamp Available**: `deletedAt: new Date()`
- **Associated Entities**: `MenuCategory`, `Restaurant`

---

### Event 14: Menu Item Created
- **Event Name**: `MENU_ITEM_CREATED`
- **Trigger Location**: Admin creating menu item (`POST /restaurant/:id/items`).
- **Source Code Location**: `apps/api/src/index.ts` (Lines 304–316) → `PrismaMenuItemRepository.createItem`
- **Data Available**: `id`, `name`, `description`, `price`, `imageUrl`, `categoryId`, `restaurantId`, `isActive: true`
- **Timestamp Available**: `MenuItem.createdAt`
- **Associated Entities**: `MenuItem`, `MenuCategory`, `Restaurant`

---

### Event 15: Menu Item Updated
- **Event Name**: `MENU_ITEM_UPDATED`
- **Trigger Location**: Admin editing item fields (`PATCH /menu-item/:id`).
- **Source Code Location**: `apps/api/src/index.ts` (Lines 318–330) → `PrismaMenuItemRepository.updateItem`
- **Data Available**: Updated fields payload
- **Timestamp Available**: `MenuItem.updatedAt`
- **Associated Entities**: `MenuItem`, `Restaurant`

---

### Event 16: Menu Item Soft-Deleted
- **Event Name**: `MENU_ITEM_DELETED`
- **Trigger Location**: Admin clicking delete item (`DELETE /menu-item/:id`).
- **Source Code Location**: `apps/api/src/adapters/secondary/db/PrismaRepositories.ts` (Lines 180–185)
- **Data Available**: `id`, `isActive: false`, `deletedAt`
- **Timestamp Available**: `deletedAt: new Date()`
- **Associated Entities**: `MenuItem`, `Restaurant`

---

### Event 17: Platform Tenant & Restaurant Provisioned
- **Event Name**: `TENANT_PROVISIONED`
- **Trigger Location**: Super Admin creating tenant in Platform Admin (`POST /admin/restaurants`).
- **Source Code Location**: `apps/api/src/index.ts` (Lines 197–210) → `PrismaRestaurantRepository.createTenantAndRestaurant`
- **Data Available**: `Tenant.name`, `Restaurant.name`, batch created `Table` rows
- **Timestamp Available**: `Tenant.createdAt`, `Restaurant.createdAt`, `Table.createdAt`
- **Associated Entities**: `Tenant`, `Restaurant`, `Table`

---

### Event 18: User Authenticated / Session Created
- **Event Name**: `USER_AUTHENTICATED`
- **Trigger Location**: Form login via NextAuth CredentialsProvider (`POST /api/auth/callback/credentials`).
- **Source Code Location**: `apps/api/src/adapters/primary/http/authRoute.ts` (Lines 1–90)
- **Data Available**: `user.id`, `user.email`, signed JWT token
- **Timestamp Available**: JWT `iat` (issued at), `exp` (expires at). No DB session row created (JWT strategy).
- **Associated Entities**: `User`, `Tenant`

