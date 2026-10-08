# TableDiner Domain Event Taxonomy & Envelope Specification

**Document**: `event-taxonomy.md`  
**Role**: Principal Systems Architect, Principal Analytics Architect  
**Status**: Formal Contract & Event Specification  
**Date**: 2026-10-09  

---

## 1. Global Event Architecture Standards

To guarantee multi-tenant isolation, evolvability, and auditability across all analytics streams, all TableDiner domain events MUST adhere to the **Universal Event Envelope Standard**.

### 1.1 Universal Event Envelope Schema

Every event persisted in the Event Store or emitted across internal channels is formatted according to this immutable structure:

```json
{
  "eventId": "018e22a4-7f1c-7231-9f7b-9c3f3b927a41",
  "eventName": "kitchen.order.served",
  "schemaVersion": "1.0.0",
  "tenantId": "cmuzy8tmt0001rl4r2wvzds81",
  "restaurantId": "cmuzy8tmt0004rl4r2wvzds88",
  "businessDate": "2026-10-09",
  "occurredAt": "2026-10-09T14:32:15.124Z",
  "recordedAt": "2026-10-09T14:32:15.129Z",
  "causationId": "018e22a4-5a2d-7120-8e1a-1b4e2c815d32",
  "correlationId": "req-98234-session-cmuzy8-order-412",
  "producer": {
    "service": "api-service",
    "layer": "secondary-adapter",
    "actorId": "usr_kitchen_cook_01",
    "actorRole": "KITCHEN_STAFF"
  },
  "payload": {},
  "metadata": {
    "ip": "192.168.1.45",
    "userAgent": "TableDiner-KitchenTablet/2.1",
    "environment": "production"
  }
}
```

### 1.2 Core Envelope Fields Definition

| Field | Type | Constraint | Description |
|---|---|---|---|
| `eventId` | String | UUIDv7 / ULID | Monotonically increasing, time-sortable unique event identifier. |
| `eventName` | String | Strict taxonomy regex | Dotted taxonomy identifier: `^[a-z]+(\.[a-z]+){2}$`. |
| `schemaVersion` | String | SemVer (`X.Y.Z`) | Explicit payload version to ensure backward and forward compatibility. |
| `tenantId` | String | Non-null CUID | Mandatory tenant isolation boundary. Cross-tenant leakage strictly prevented. |
| `restaurantId` | String | Non-null CUID | Restaurant location identifier within tenant. |
| `businessDate` | String | `YYYY-MM-DD` | Operating business day context (respects restaurant cutoff hour). |
| `occurredAt` | ISO 8601 | UTC Milliseconds | Absolute timestamp when the business fact occurred in the real world. |
| `recordedAt` | ISO 8601 | UTC Milliseconds | Timestamp when the event was committed to the append-only event store. |
| `causationId` | String | Nullable UUID | The `eventId` of the prior event that directly triggered this event. |
| `correlationId`| String | Non-null String | Distributed trace token linking all events within a customer or session journey. |
| `producer` | Object | Mandatory | Service identity and acting user credentials. |
| `payload` | Object | Strict Zod schema | Domain-specific immutable state snapshot. |

---

## 2. Event Taxonomy Specifications

---

### Event 1: `dining.session.opened`

- **Business Meaning**: A physical dining session was started at a table.
- **Producer**: `AppUseCases.placeOrder` / `PrismaSessionRepository.createActiveSession`.
- **Consumers**: Real-time Seating Monitor, Table Occupancy Projector, Daily Financial Aggregator.
- **Tenant Ownership**: Scoped strictly to `tenantId` + `restaurantId`.
- **Idempotency Key**: `session:open:{tableId}:{businessDate}`.
- **Retention**: Permanent (7 years financial audit horizon).
- **Required Payload**:
  ```json
  {
    "sessionId": "ses_01hqb2...",
    "tableId": "tbl_01hqb2...",
    "tableName": "Table 4",
    "guestCount": 2,
    "status": "OPEN",
    "openedAt": "2026-10-09T14:00:00.000Z"
  }
  ```
- **Optional Payload**:
  ```json
  {
    "waiterId": "usr_01...",
    "notes": "Birthday celebration"
  }
  ```

---

### Event 2: `dining.session.closed`

- **Business Meaning**: Customer completed dining, full payment settled, session terminated.
- **Producer**: `PrismaPaymentRepository.processCheckout`.
- **Consumers**: Revenue Projector, RevPASH Calculator, Table Turn-Time Aggregator, EOD Audit Ledger.
- **Tenant Ownership**: Scoped strictly to `tenantId` + `restaurantId`.
- **Idempotency Key**: `session:close:{sessionId}`.
- **Retention**: Permanent (7 years financial audit horizon).
- **Required Payload**:
  ```json
  {
    "sessionId": "ses_01hqb2...",
    "tableId": "tbl_01hqb2...",
    "tableName": "Table 4",
    "guestCount": 2,
    "subtotal": 1250.00,
    "taxAmount": 62.50,
    "tipAmount": 100.00,
    "discountAmount": 0.00,
    "totalAmount": 1412.50,
    "openedAt": "2026-10-09T14:00:00.000Z",
    "closedAt": "2026-10-09T14:48:00.000Z",
    "turnTimeMinutes": 48.0,
    "settlementMethod": "UPI"
  }
  ```
- **Optional Payload**:
  ```json
  {
    "discountCode": "HAPPYHOUR",
    "cashierId": "usr_01hq..."
  }
  ```

---

### Event 3: `kitchen.order.placed`

- **Business Meaning**: Diner submitted dishes to kitchen; new order ticket generated.
- **Producer**: `AppUseCases.placeOrder`.
- **Consumers**: Dish Popularity Projector, Category Sales Aggregator, Kitchen KDS Stream.
- **Tenant Ownership**: Scoped strictly to `tenantId` + `restaurantId`.
- **Idempotency Key**: `order:placed:{orderId}`.
- **Retention**: 3 years analytical retention.
- **Required Payload**:
  ```json
  {
    "orderId": "ord_01hqb2...",
    "sessionId": "ses_01hqb2...",
    "tableId": "tbl_01hqb2...",
    "itemCount": 3,
    "subtotal": 650.00,
    "items": [
      {
        "orderItemId": "itm_01...",
        "menuItemId": "menu_paneer_tikka",
        "name": "Paneer Tikka",
        "categoryId": "cat_starters",
        "categoryName": "Starters",
        "quantity": 2,
        "unitPrice": 250.00,
        "lineTotal": 500.00,
        "notes": "Extra spicy"
      },
      {
        "orderItemId": "itm_02...",
        "menuItemId": "menu_masala_coke",
        "name": "Masala Coke",
        "categoryId": "cat_beverages",
        "categoryName": "Beverages",
        "quantity": 1,
        "unitPrice": 150.00,
        "lineTotal": 150.00
      }
    ]
  }
  ```

---

### Event 4: `kitchen.order.accepted`

- **Business Meaning**: Kitchen acknowledged ticket and queued into production.
- **Producer**: `PrismaOrderRepository.updateOrderStatus` (`status: 'PREPARING'`).
- **Consumers**: Kitchen SLA Projector, Live KDS Queue Monitor.
- **Tenant Ownership**: Scoped strictly to `tenantId` + `restaurantId`.
- **Idempotency Key**: `order:accepted:{orderId}`.
- **Retention**: 1 year operational SLA horizon.
- **Required Payload**:
  ```json
  {
    "orderId": "ord_01hqb2...",
    "sessionId": "ses_01hqb2...",
    "status": "PREPARING",
    "placedAt": "2026-10-09T14:05:00.000Z",
    "acceptedAt": "2026-10-09T14:06:30.000Z",
    "timeToAcceptMinutes": 1.5
  }
  ```

---

### Event 5: `kitchen.order.ready`

- **Business Meaning**: Kitchen finished cooking; order plated and ready for pickup.
- **Producer**: `PrismaOrderRepository.updateOrderStatus` (`status: 'READY'`).
- **Consumers**: Kitchen Cooking SLA Aggregator, Waiter Dispatch Notification.
- **Tenant Ownership**: Scoped strictly to `tenantId` + `restaurantId`.
- **Idempotency Key**: `order:ready:{orderId}`.
- **Retention**: 1 year operational SLA horizon.
- **Required Payload**:
  ```json
  {
    "orderId": "ord_01hqb2...",
    "sessionId": "ses_01hqb2...",
    "status": "READY",
    "acceptedAt": "2026-10-09T14:06:30.000Z",
    "readyAt": "2026-10-09T14:18:30.000Z",
    "kitchenPrepMinutes": 12.0
  }
  ```

---

### Event 6: `kitchen.order.served`

- **Business Meaning**: Waitstaff delivered dishes to diner; order complete.
- **Producer**: `PrismaOrderRepository.updateOrderStatus` (`status: 'SERVED'`).
- **Consumers**: Delivery SLA Aggregator, End-to-End Fulfillment Tracker.
- **Tenant Ownership**: Scoped strictly to `tenantId` + `restaurantId`.
- **Idempotency Key**: `order:served:{orderId}`.
- **Retention**: 1 year operational SLA horizon.
- **Required Payload**:
  ```json
  {
    "orderId": "ord_01hqb2...",
    "sessionId": "ses_01hqb2...",
    "status": "SERVED",
    "placedAt": "2026-10-09T14:05:00.000Z",
    "readyAt": "2026-10-09T14:18:30.000Z",
    "servedAt": "2026-10-09T14:22:00.000Z",
    "serviceTimeMinutes": 3.5,
    "totalFulfillmentMinutes": 17.0
  }
  ```

---

### Event 7: `kitchen.order.cancelled`

- **Business Meaning**: Order voided or rejected; food not served.
- **Producer**: `PrismaOrderRepository.updateOrderStatus` (`status: 'CANCELLED'`).
- **Consumers**: Kitchen Wastage Aggregator, Cancellation Rate Projector.
- **Tenant Ownership**: Scoped strictly to `tenantId` + `restaurantId`.
- **Idempotency Key**: `order:cancelled:{orderId}`.
- **Retention**: 3 years.
- **Required Payload**:
  ```json
  {
    "orderId": "ord_01hqb2...",
    "sessionId": "ses_01hqb2...",
    "status": "CANCELLED",
    "cancelledAt": "2026-10-09T14:10:00.000Z",
    "cancellationReason": "Customer changed mind",
    "voidedAmount": 650.00,
    "previousStatus": "PREPARING"
  }
  ```

---

### Event 8: `payment.settlement.completed`

- **Business Meaning**: Tender captured and confirmed as valid payment.
- **Producer**: `PrismaPaymentRepository.processCheckout`.
- **Consumers**: General Financial Ledger, Cash vs UPI Mix Projector, Tax Audit Reporter.
- **Tenant Ownership**: Scoped strictly to `tenantId` + `restaurantId`.
- **Idempotency Key**: `payment:completed:{paymentId}`.
- **Retention**: Permanent (7 years financial legal requirement).
- **Required Payload**:
  ```json
  {
    "paymentId": "pay_01hqb2...",
    "sessionId": "ses_01hqb2...",
    "amount": 1412.50,
    "method": "UPI",
    "providerId": "mock_txn_98723",
    "status": "COMPLETED",
    "completedAt": "2026-10-09T14:48:00.000Z"
  }
  ```

---

### Event 9: `digital.cart.item_added`

- **Business Meaning**: Diner added a dish to their client cart.
- **Producer**: Client SPA Web Telemetry (`customer-web`).
- **Consumers**: Diner Conversion Funnel Projector, Cart Abandonment Analyzer.
- **Tenant Ownership**: Scoped strictly to `tenantId` + `restaurantId`.
- **Idempotency Key**: `telemetry:cart:add:{clientSessionId}:{sequenceId}`.
- **Retention**: 90 days.
- **Required Payload**:
  ```json
  {
    "clientSessionId": "cls_01hqb...",
    "tableId": "tbl_01hqb2...",
    "menuItemId": "menu_paneer_tikka",
    "itemName": "Paneer Tikka",
    "unitPrice": 250.00,
    "quantity": 1
  }
  ```

---

### Event 10: `catalog.item.price_changed`

- **Business Meaning**: Price of a menu item altered in the catalog.
- **Producer**: `PrismaMenuItemRepository.updateItem`.
- **Consumers**: Price Elasticity Analyzer, Menu Margin Impact Projector.
- **Tenant Ownership**: Scoped strictly to `tenantId` + `restaurantId`.
- **Idempotency Key**: `catalog:price_change:{menuItemId}:{timestamp}`.
- **Retention**: 3 years.
- **Required Payload**:
  ```json
  {
    "menuItemId": "menu_paneer_tikka",
    "itemName": "Paneer Tikka",
    "categoryId": "cat_starters",
    "oldPrice": 220.00,
    "newPrice": 250.00,
    "deltaAmount": 30.00,
    "percentChange": 13.64
  }
  ```

---

## 3. Taxonomy Governance & Schema Evolution Rules

1. **Strict Immutability**: Once an event definition is published (`schemaVersion 1.0.0`), fields can NEVER be deleted or have their types mutated.
2. **Backward-Compatible Evolution**:
   - Adding a new optional field increments the **Minor version** (`1.1.0`).
   - Bug fixes or documentation corrections increment the **Patch version** (`1.0.1`).
   - Breaking field redesigns require a **Major version bump** (`2.0.0`) and parallel consumer support for a deprecation window.
3. **Payload Self-Containment**: An event payload must contain all factual context required to calculate metrics without forcing consumers to query operational tables at processing time (e.g. `kitchen.order.placed` embeds `categoryName`, `unitPrice`, and `lineTotal`).

