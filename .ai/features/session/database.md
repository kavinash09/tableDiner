# Session Database Entities

## `Session`
- **Fields**: `id`, `tenantId`, `restaurantId`, `tableId`, `status` (Enum: OPEN, CLOSED, REOPENED, FINALIZED), `businessDate`, `guestCount`, `subtotal`, `taxAmount`, `tipAmount`, `discountAmount`, `totalAmount`, `refundedAmount`, `openedAt`, `closedAt`, `isActive`, `createdAt`, `updatedAt`, `deletedAt`
- **Relationships**: Belongs to `Tenant`, `Restaurant`, `Table`. Has many `Order`, `Payment`.

