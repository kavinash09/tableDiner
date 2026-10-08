# TableDiner Event-Driven Analytics: Domain Impact Report

**Document**: `domain-impact-report.md`  
**Role**: Principal Architect, Domain-Driven Design Specialist  
**Status**: Domain Model & Event Flow Assessment  
**Date**: 2026-10-09  

---

## 1. Domain Event Origin Architecture

In Domain-Driven Design (DDD) and Hexagonal Architecture, a frequent architectural trap is emitting domain events directly from HTTP controllers or arbitrary service classes. This leads to leaked business logic, inconsistent event payloads, and dual-write race conditions.

To ensure strict domain purity and adherence to Rule 21 (Rich Domain Entities):

### The 3-Step Event Lifecycle:
1. **Creation (Core Domain)**: Business invariants are verified and state transitions occur inside Rich Domain Entities (`TableSession`, `Order`). The entity records the event internally into an in-memory queue (`this.recordDomainEvent(...)`).
2. **Persistence (Secondary DB Adapter)**: The repository pulls the recorded events from the entity and commits both the operational database changes and the event records into the `AnalyticsEvent` outbox table within an atomic transaction.
3. **Dispatch & Consumption (Application Layer)**: An asynchronous relay worker dispatches committed events to domain projectors.

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Core Domain Entity: Invariant check + State change + Record Event   │
│    `order.markServed()` ──► `this.recordDomainEvent(new OrderServed())`│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ entity.pullDomainEvents()
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. Secondary DB Adapter: Atomic persistence within Transaction         │
│    `prisma.$transaction([ updateOrderQuery, insertOutboxQuery ])`      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Outbox Relay Daemon (Async)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. Domain Projectors: Asynchronous Projection of Materialized Views    │
│    `KitchenSlaProjector.handle(event)` ──► `AggDailySlaSummary`        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Event Producers: Workflows & Trigger Matrix

| Workflow | Trigger Location | Emitted Event(s) | Payload Content |
|---|---|---|---|
| **Diner QR Scan & Browse** | `customer-web` | `digital.menu.viewed`<br>`digital.category.browsed`<br>`digital.dish.viewed` | `tenantId`, `restaurantId`, `tableId`, `clientSessionId`, `dishId`, `categoryId` |
| **Diner Cart Management** | `customer-web` | `digital.cart.item_added`<br>`digital.cart.item_removed` | `clientSessionId`, `menuItemId`, `quantity`, `unitPrice` |
| **First Order Submission** | `AppUseCases.placeOrder` | `dining.session.opened`<br>`dining.table.occupied`<br>`kitchen.order.placed` | `sessionId`, `tableId`, `orderId`, `items[]`, `guestCount`, `businessDate` |
| **Subsequent Order Ticket** | `AppUseCases.placeOrder` | `kitchen.order.placed` | `sessionId`, `orderId`, `items[]`, `businessDate` |
| **Kitchen Ticket Accepted** | `PrismaOrderRepository.updateOrderStatus` | `kitchen.order.accepted` | `orderId`, `sessionId`, `status: PREPARING`, `timeToAcceptMinutes` |
| **Kitchen Cooking Complete**| `PrismaOrderRepository.updateOrderStatus` | `kitchen.order.ready` | `orderId`, `sessionId`, `status: READY`, `kitchenPrepMinutes` |
| **Order Delivered to Table**| `PrismaOrderRepository.updateOrderStatus` | `kitchen.order.served` | `orderId`, `sessionId`, `status: SERVED`, `serviceTimeMinutes`, `totalFulfillmentMinutes` |
| **Order Ticket Voided** | `PrismaOrderRepository.updateOrderStatus` | `kitchen.order.cancelled` | `orderId`, `sessionId`, `status: CANCELLED`, `cancellationReason` |
| **Bill Payment & Checkout** | `PrismaPaymentRepository.processCheckout` | `dining.session.closed`<br>`dining.table.released`<br>`payment.settlement.completed` | `sessionId`, `tableId`, `subtotal`, `totalAmount`, `turnTimeMinutes`, `paymentMethod` |
| **Menu Item Price Update** | `PrismaMenuItemRepository.updateItem` | `catalog.item.price_changed` | `menuItemId`, `oldPrice`, `newPrice`, `deltaAmount` |
| **Menu Item Soft Deletion** | `PrismaMenuItemRepository.deleteItem` | `catalog.item.archived` | `menuItemId`, `categoryId`, `archivedAt` |

---

## 3. Event Consumers: Analytical Projector Matrix

| Consumer / Projector | Subscribed Events | Target Materialized View | Metrics Derived |
|---|---|---|---|
| **FinancialProjector** | `dining.session.closed`<br>`payment.settlement.completed`<br>`payment.settlement.refunded` | `AggDailyFinancialSummary`<br>`AggHourlyRevenue` | Gross Revenue, Net Revenue, Tax, Tips, Discounts, Average Ticket Size, Hourly Revenue Curve |
| **TableUtilizationProjector** | `dining.session.opened`<br>`dining.session.closed`<br>`dining.table.occupied`<br>`dining.table.released` | `AggTableUtilizationSummary` | Table Turn Time (min), Total Occupied Minutes, Capacity Utilization %, RevPASH |
| **KitchenSlaProjector** | `kitchen.order.placed`<br>`kitchen.order.accepted`<br>`kitchen.order.ready`<br>`kitchen.order.served`<br>`kitchen.order.cancelled` | `AggDailySlaSummary`<br>`AggStationSlaSummary` | Queue Time, Kitchen Prep Time, Service Time, Total Fulfillment Time, SLA Compliance Rate % |
| **DishSalesProjector** | `kitchen.order.placed`<br>`kitchen.order.served`<br>`kitchen.order.cancelled` | `AggDishSalesSummary`<br>`AggCategorySalesSummary` | Units Sold, Gross Dish Sales, Dish Wastage/Void Rate, Category Contribution % |
| **DinerFunnelProjector** | `digital.menu.viewed`<br>`digital.cart.item_added`<br>`kitchen.order.placed`<br>`payment.settlement.completed` | `AggDinerFunnelSummary` | Scan-to-Menu %, Menu-to-Cart %, Cart Abandonment %, Full Checkout Conversion % |
| **PlatformGmvProjector** | `payment.settlement.completed`<br>`tenant.subscription.updated` | `AggPlatformGmvSummary` | Cross-Tenant GMV, Platform Order Volume, Active MRR, SaaS Churn |

---

## 4. Current Services Impact Analysis

### 4.1 `apps/api/src/core/use-cases/AppUseCases.ts`
- **Current Behavior**: Monolithic class executing operational mutations and legacy bill calculations.
- **Impact**:
  - `placeOrder`: Staged event dispatching on session creation and order placement.
  - `payBill`: Staged event dispatching on session closure and payment settlement.
  - `getBill`: Untouched. Still returns live bill calculations from snapshotted `unitPrice`.

### 4.2 `apps/api/src/adapters/secondary/db/PrismaRepositories.ts`
- **Current Behavior**: Direct operational database operations.
- **Impact**:
  - `createActiveSession`: Appends `dining.session.opened` to outbox inside `$transaction`.
  - `createOrder`: Appends `kitchen.order.placed` to outbox inside `$transaction`.
  - `updateOrderStatus`: Appends status progression events (`accepted`, `ready`, `served`, `cancelled`) to outbox inside `$transaction`.
  - `processCheckout`: Appends `dining.session.closed` and `payment.settlement.completed` to outbox inside `$transaction`.

### 4.3 `GetRestaurantDashboardUseCase.ts` & `GetPlatformDashboardUseCase.ts`
- **Current Behavior**: Calls `PrismaRestaurantAnalyticsRepository` which executes 4 synchronous database aggregation queries.
- **Impact**:
  - Shifts from executing slow `$queryRaw` table scans to querying pre-aggregated read models (`AggDailyFinancialSummary`, `AggDailySlaSummary`, etc.) via primary key lookups.
  - Latency drops from >200ms to <3ms.

### 4.4 `apps/api/src/core/domain/TableSession.ts` & `Order.ts`
- **Current Behavior**: Minimal domain classes with helper methods.
- **Impact**:
  - Enhanced with event staging capabilities:
    ```typescript
    protected domainEvents: DomainEvent[] = [];
    public recordDomainEvent(event: DomainEvent): void { this.domainEvents.push(event); }
    public pullDomainEvents(): DomainEvent[] {
      const events = [...this.domainEvents];
      this.domainEvents = [];
      return events;
    }
    ```
  - State transition methods (`close()`, `markServed()`) automatically record their corresponding domain events.
