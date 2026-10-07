# Domain Model

This document describes the core data entities and their relationships.
The **authoritative schema** is always `packages/db/prisma/schema.prisma`.

## Entity Relationships

```
Tenant
  └── Restaurant (many per Tenant)
        ├── Table (many per Restaurant)
        │     └── Session (one ACTIVE at a time)
        │           ├── Order (many per Session)
        │           │     └── OrderItem → MenuItem
        │           └── Payment (closes Session)
        ├── MenuCategory (many per Restaurant)
        │     └── MenuItem (many per Category)
        └── MenuItem (uncategorized, categoryId = null)
```

## Key Entities

| Entity | Key Fields | Notes |
|--------|-----------|-------|
| `Tenant` | `id`, `name` | Top-level org. One tenant = one restaurant group |
| `Restaurant` | `id`, `tenantId`, `name`, `subscriptionTier` | Belongs to one Tenant |
| `Table` | `id`, `restaurantId`, `name`, `qrCode` | `qrCode` is unique; used as URL param |
| `MenuCategory` | `id`, `restaurantId`, `name` | Groups MenuItems |
| `MenuItem` | `id`, `restaurantId`, `categoryId?`, `name`, `description?`, `price` | price in ₹ (Float) |
| `Session` | `id`, `tableId`, `restaurantId`, `status` | `ACTIVE` or `CLOSED`. One ACTIVE per Table |
| `Order` | `id`, `sessionId`, `status` | `RECEIVED → PREPARING → READY → SERVED` |
| `OrderItem` | `id`, `orderId`, `menuItemId`, `quantity` | Line item linking Order to MenuItem |
| `Payment` | `id`, `sessionId`, `status`, `amount` | `COMPLETED` closes the Session |

## Business Rules

1. A Table can only have ONE `ACTIVE` Session at a time.
2. When the first order is placed, a Session is auto-created if none exists.
3. `POST /table/:qrCode/pay` creates a `Payment` record AND sets Session to `CLOSED`.
4. All amounts stored and displayed in **Rupees (₹)**.
