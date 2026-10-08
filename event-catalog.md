# TableDiner Domain Event Catalog

**Document**: `event-catalog.md`  
**Role**: Principal Systems Architect, Principal Analytics Architect  
**Status**: Authoritative Business Event Discovery  
**Date**: 2026-10-09  

---

## 1. Overview & Discovery Methodology

This catalog defines every meaningful domain fact that occurs across TableDiner. An **Event** is an immutable statement of something that has already happened in the past (named in the past tense: `verb + ed` or standard dot-notation `noun.verb_ed`).

Unlike ephemeral HTTP requests or mutable database rows, events represent the **irreversible historical record** of the restaurant business.

Events are derived directly from actual workflows across:
1. **Diner Digital Journey** (QR interaction, menu discovery, cart assembly)
2. **Table & Session Lifecycle** (Seating, occupancy, bill calculation, closure)
3. **Order & Kitchen SLA Funnel** (Placement, acceptance, cooking, delivery, cancellation)
4. **Payment & Settlement Lifecycle** (Tender initiation, completion, failure, refund)
5. **Catalog & Operational Administration** (Price alterations, item archiving, day cutoffs)

---

## 2. Diner Digital Journey Events

### Event 2.1: `digital.menu.viewed`
- **Business Meaning**: A diner scanned a table QR code and the web client rendered the menu catalog.
- **Trigger Location**: Customer scanning QR code or landing on `http://localhost:5173/?qr=<code`
- **Source Code Location**: `apps/api/src/index.ts` (`GET /table/:qrCode`) & `apps/customer-web/src/App.tsx` (`fetchTableDetails`)
- **Data Available**: `tenantId`, `restaurantId`, `tableId`, `qrCode`, `clientSessionId`, `userAgent`
- **Timestamp Available**: Event client emission time (`occurredAt`)
- **Associated Entities**: `Table`, `Restaurant`, `Tenant`

### Event 2.2: `digital.category.browsed`
- **Business Meaning**: A diner navigated to or expanded a specific menu category (e.g., "Starters", "Beverages").
- **Trigger Location**: Diner tapping a category tab/accordion in `customer-web`.
- **Source Code Location**: `apps/customer-web/src/App.tsx` (`CategoryFilter`)
- **Data Available**: `tenantId`, `restaurantId`, `tableId`, `categoryId`, `categoryName`, `clientSessionId`
- **Timestamp Available**: Client timestamp (`occurredAt`)
- **Associated Entities**: `MenuCategory`, `Table`, `Restaurant`

### Event 2.3: `digital.dish.viewed`
- **Business Meaning**: A diner opened the detailed modal or inspected image/ingredients of a dish.
- **Trigger Location**: Diner tapping an item card in `customer-web`.
- **Source Code Location**: `apps/customer-web/src/App.tsx`
- **Data Available**: `tenantId`, `restaurantId`, `tableId`, `menuItemId`, `itemName`, `price`, `clientSessionId`
- **Timestamp Available**: Client timestamp (`occurredAt`)
- **Associated Entities**: `MenuItem`, `MenuCategory`, `Table`

### Event 2.4: `digital.cart.item_added`
- **Business Meaning**: A diner added a dish to their digital order cart.
- **Trigger Location**: Diner clicking "Add to Cart" (`+` button).
- **Source Code Location**: `apps/customer-web/src/App.tsx` (`addToCart`)
- **Data Available**: `tenantId`, `restaurantId`, `tableId`, `menuItemId`, `quantity`, `unitPrice`, `notes`
- **Timestamp Available**: Client timestamp (`occurredAt`)
- **Associated Entities**: `MenuItem`, `Table`, `Session`

### Event 2.5: `digital.cart.item_removed`
- **Business Meaning**: A diner reduced the quantity of an item in their cart or cleared it.
- **Trigger Location**: Diner clicking `-` button in the cart drawer.
- **Source Code Location**: `apps/customer-web/src/App.tsx` (`removeFromCart`)
- **Data Available**: `tenantId`, `restaurantId`, `tableId`, `menuItemId`, `previousQuantity`, `newQuantity`
- **Timestamp Available**: Client timestamp (`occurredAt`)
- **Associated Entities**: `MenuItem`, `Table`, `Session`

### Event 2.6: `digital.checkout.initiated`
- **Business Meaning**: A diner opened the checkout review sheet and clicked "Place Order".
- **Trigger Location**: Diner clicking "Send to Kitchen" before backend confirmation.
- **Source Code Location**: `apps/customer-web/src/App.tsx` (`submitOrder`)
- **Data Available**: `tenantId`, `restaurantId`, `tableId`, `itemCount`, `projectedTotal`
- **Timestamp Available**: Client timestamp (`occurredAt`)
- **Associated Entities**: `Table`, `Session`

---

## 3. Table & Session Lifecycle Events

### Event 3.1: `dining.session.opened`
- **Business Meaning**: A dining session commenced at a physical table.
- **Trigger Location**: Automated instantiation when the first order is submitted for an unoccupied table.
- **Source Code Location**: `apps/api/src/adapters/secondary/db/PrismaRepositories.ts` (`PrismaSessionRepository.createActiveSession`)
- **Data Available**: `sessionId`, `tenantId`, `restaurantId`, `tableId`, `businessDate`, `guestCount`, `status = 'OPEN'`
- **Timestamp Available**: `Session.createdAt` (DB timestamp)
- **Associated Entities**: `Session`, `Table`, `Restaurant`, `Tenant`

### Event 3.2: `dining.table.occupied`
- **Business Meaning**: Physical table transition from `AVAILABLE` to `OCCUPIED`.
- **Trigger Location**: Triggered concurrently upon `dining.session.opened`.
- **Source Code Location**: `apps/api/src/adapters/secondary/db/PrismaRepositories.ts`
- **Data Available**: `tableId`, `tableName`, `restaurantId`, `tenantId`, `sessionId`, `capacity`
- **Timestamp Available**: `occurredAt`
- **Associated Entities**: `Table`, `Session`

### Event 3.3: `dining.session.guests_updated`
- **Business Meaning**: Guest cover count updated for the session (party size changed).
- **Trigger Location**: Waiter/cashier updating table party size in admin portal.
- **Source Code Location**: `apps/api/src/adapters/secondary/db/PrismaRepositories.ts`
- **Data Available**: `sessionId`, `tenantId`, `restaurantId`, `tableId`, `previousGuests`, `newGuests`
- **Timestamp Available**: DB timestamp
- **Associated Entities**: `Session`, `Table`

### Event 3.4: `dining.session.bill_requested`
- **Business Meaning**: Diner requested the itemized bill for review.
- **Trigger Location**: Customer tapping "View Bill" or calling `GET /table/:qrCode/bill`.
- **Source Code Location**: `apps/api/src/core/use-cases/AppUseCases.ts` (`getBill`)
- **Data Available**: `sessionId`, `tenantId`, `restaurantId`, `tableId`, `currentSubtotal`, `itemCount`
- **Timestamp Available**: Request timestamp
- **Associated Entities**: `Session`, `Table`

### Event 3.5: `dining.session.closed`
- **Business Meaning**: Session completed, payment received, and table finalized.
- **Trigger Location**: Successful checkout settlement.
- **Source Code Location**: `apps/api/src/adapters/secondary/db/PrismaRepositories.ts` (`PrismaPaymentRepository.processCheckout`)
- **Data Available**: `sessionId`, `tenantId`, `restaurantId`, `tableId`, `businessDate`, `subtotal`, `taxAmount`, `tipAmount`, `discountAmount`, `totalAmount`, `closedAt`, `durationMinutes`
- **Timestamp Available**: `Session.closedAt` (Mandatory, persisted)
- **Associated Entities**: `Session`, `Table`, `Payment`, `Tenant`

### Event 3.6: `dining.table.released`
- **Business Meaning**: Physical table freed and ready for turnover.
- **Trigger Location**: Emitted concurrently with `dining.session.closed`.
- **Source Code Location**: `apps/api/src/adapters/secondary/db/PrismaRepositories.ts`
- **Data Available**: `tableId`, `restaurantId`, `tenantId`, `sessionId`, `turnTimeMinutes`
- **Timestamp Available**: `closedAt`
- **Associated Entities**: `Table`, `Session`

### Event 3.7: `dining.session.reopened`
- **Business Meaning**: A closed session was reopened by a manager for adjustment or dispute.
- **Trigger Location**: Manager portal action.
- **Source Code Location**: `packages/db/prisma/schema.prisma` (`status = 'REOPENED'`, `reopenedAt`)
- **Data Available**: `sessionId`, `restaurantId`, `tenantId`, `reopenedBy`, `reopenReason`
- **Timestamp Available**: `reopenedAt`
- **Associated Entities**: `Session`, `User`

---

## 4. Order & Kitchen Production Lifecycle Events

### Event 4.1: `kitchen.order.placed`
- **Business Meaning**: Diner submitted an order ticket; kitchen ticket generated.
- **Trigger Location**: `POST /table/:qrCode/order`
- **Source Code Location**: `apps/api/src/core/use-cases/AppUseCases.ts` (`placeOrder`) → `PrismaOrderRepository.createOrder`
- **Data Available**: `orderId`, `sessionId`, `tenantId`, `restaurantId`, `businessDate`, `itemCount`, `totalAmount`, `items: [{ menuItemId, quantity, unitPrice, lineTotal }]`
- **Timestamp Available**: `Order.createdAt`
- **Associated Entities**: `Order`, `OrderItem`, `Session`, `Table`

### Event 4.2: `kitchen.order.accepted`
- **Business Meaning**: Kitchen staff acknowledged the ticket and queued it for preparation.
- **Trigger Location**: Kitchen dashboard clicking "Accept Ticket" (`PATCH /kitchen/orders/:orderId` with `status: 'PREPARING'`).
- **Source Code Location**: `apps/api/src/adapters/secondary/db/PrismaRepositories.ts` (`PrismaOrderRepository.updateOrderStatus`)
- **Data Available**: `orderId`, `sessionId`, `tenantId`, `restaurantId`, `status = 'PREPARING'`, `waitToAcceptMinutes = (acceptedAt - createdAt)`
- **Timestamp Available**: `Order.acceptedAt` (Persisted)
- **Associated Entities**: `Order`, `Session`

### Event 4.3: `kitchen.order.ready`
- **Business Meaning**: Chef completed cooking; food plated and awaiting waitstaff pickup.
- **Trigger Location**: Kitchen dashboard clicking "Mark Ready" (`PATCH /kitchen/orders/:orderId` with `status: 'READY'`).
- **Source Code Location**: `apps/api/src/adapters/secondary/db/PrismaRepositories.ts` (`PrismaOrderRepository.updateOrderStatus`)
- **Data Available**: `orderId`, `sessionId`, `tenantId`, `restaurantId`, `status = 'READY'`, `kitchenPrepDurationMinutes = (readyAt - acceptedAt)`
- **Timestamp Available**: `Order.readyAt` (Persisted)
- **Associated Entities**: `Order`, `Session`

### Event 4.4: `kitchen.order.served`
- **Business Meaning**: Waitstaff delivered food to table; order fulfilled.
- **Trigger Location**: Waiter/Kitchen clicking "Mark Served" (`PATCH /kitchen/orders/:orderId` with `status: 'SERVED'`).
- **Source Code Location**: `apps/api/src/adapters/secondary/db/PrismaRepositories.ts` (`PrismaOrderRepository.updateOrderStatus`)
- **Data Available**: `orderId`, `sessionId`, `tenantId`, `restaurantId`, `status = 'SERVED'`, `serviceDurationMinutes = (servedAt - readyAt)`, `totalFulfillmentDurationMinutes = (servedAt - createdAt)`
- **Timestamp Available**: `Order.servedAt` (Persisted)
- **Associated Entities**: `Order`, `Session`

### Event 4.5: `kitchen.order.cancelled`
- **Business Meaning**: Order ticket cancelled and voided.
- **Trigger Location**: Staff cancelling ticket (`PATCH /kitchen/orders/:orderId` with `status: 'CANCELLED'`).
- **Source Code Location**: `apps/api/src/adapters/secondary/db/PrismaRepositories.ts` (`PrismaOrderRepository.updateOrderStatus`)
- **Data Available**: `orderId`, `sessionId`, `tenantId`, `restaurantId`, `cancellationReason`, `previousStatus`
- **Timestamp Available**: `Order.cancelledAt` (Persisted)
- **Associated Entities**: `Order`, `Session`

---

## 5. Payment & Settlement Lifecycle Events

### Event 5.1: `payment.settlement.initiated`
- **Business Meaning**: Customer selected payment method and began checkout.
- **Trigger Location**: `POST /table/:qrCode/pay`
- **Source Code Location**: `apps/api/src/core/use-cases/AppUseCases.ts` (`payBill`)
- **Data Available**: `sessionId`, `tenantId`, `restaurantId`, `amount`, `method`
- **Timestamp Available**: Request timestamp
- **Associated Entities**: `Payment`, `Session`

### Event 5.2: `payment.settlement.completed`
- **Business Meaning**: Tender captured and confirmed as valid payment.
- **Trigger Location**: `PrismaPaymentRepository.processCheckout`
- **Source Code Location**: `apps/api/src/adapters/secondary/db/PrismaRepositories.ts`
- **Data Available**: `paymentId`, `sessionId`, `tenantId`, `restaurantId`, `amount`, `method`, `status = 'COMPLETED'`
- **Timestamp Available**: `Payment.createdAt` (DB timestamp)
- **Associated Entities**: `Payment`, `Session`, `Tenant`

### Event 5.3: `payment.settlement.failed`
- **Business Meaning**: Digital payment declined or transaction aborted.
- **Trigger Location**: Payment gateway exception in checkout adapter.
- **Source Code Location**: Secondary payment adapter boundary
- **Data Available**: `sessionId`, `tenantId`, `restaurantId`, `amount`, `method`, `errorCode`, `errorMessage`
- **Timestamp Available**: Gateway timestamp
- **Associated Entities**: `Payment`, `Session`

### Event 5.4: `payment.settlement.refunded`
- **Business Meaning**: Completed payment reversed or partially credited.
- **Trigger Location**: Manager refund workflow.
- **Source Code Location**: `packages/db/prisma/schema.prisma` (`Session.refundedAmount`)
- **Data Available**: `paymentId`, `sessionId`, `tenantId`, `refundAmount`, `reason`, `authorizedBy`
- **Timestamp Available**: DB timestamp
- **Associated Entities**: `Payment`, `Session`

---

## 6. Catalog & Configuration Lifecycle Events

### Event 6.1: `catalog.item.created`
- **Business Meaning**: New dish published to menu.
- **Source Code Location**: `apps/api/src/adapters/secondary/db/PrismaRepositories.ts` (`PrismaMenuItemRepository.createItem`)
- **Data Available**: `menuItemId`, `restaurantId`, `tenantId`, `name`, `price`, `categoryId`

### Event 6.2: `catalog.item.price_changed`
- **Business Meaning**: Price of a menu item altered.
- **Source Code Location**: `apps/api/src/adapters/secondary/db/PrismaRepositories.ts` (`PrismaMenuItemRepository.updateItem`)
- **Data Available**: `menuItemId`, `restaurantId`, `tenantId`, `previousPrice`, `newPrice`, `percentageChange`

### Event 6.3: `catalog.item.archived`
- **Business Meaning**: Dish removed from active menu (soft-deleted).
- **Source Code Location**: `apps/api/src/adapters/secondary/db/PrismaRepositories.ts` (`PrismaMenuItemRepository.deleteItem`)
- **Data Available**: `menuItemId`, `restaurantId`, `tenantId`, `isActive = false`, `deletedAt`

---

## 7. Event Discovery Summary Matrix

| Event Name | Domain | Producer Layer | Primary Analytical Consumer |
|---|---|---|---|
| `digital.menu.viewed` | Digital | Web Client SPA | Diner Conversion Funnel |
| `digital.dish.viewed` | Digital | Web Client SPA | Menu Interest & Discovery Rate |
| `digital.cart.item_added` | Digital | Web Client SPA | Cart Abandonment & Intent Analytics |
| `dining.session.opened` | Dining | API Use Case | Table Occupancy & Seating Velocity |
| `dining.session.closed` | Dining | API Repository | Revenue, RevPASH, Ticket Size, Turnover |
| `kitchen.order.placed` | Kitchen | API Use Case | Dish Sales Velocity, Kitchen Demand |
| `kitchen.order.accepted` | Kitchen | Kitchen Dashboard | Kitchen Acknowledgement SLA |
| `kitchen.order.ready` | Kitchen | Kitchen Dashboard | Kitchen Cooking SLA |
| `kitchen.order.served` | Kitchen | Kitchen Dashboard | Table Delivery SLA, End-to-End SLA |
| `kitchen.order.cancelled` | Kitchen | Kitchen Dashboard | Wastage & Order Cancellation Rate |
| `payment.settlement.completed`| Payment | API Repository | Financial Ledger, Cash vs UPI Tender Mix |
| `catalog.item.price_changed` | Catalog | Admin Use Case | Price Elasticity & Margin Attribution |

