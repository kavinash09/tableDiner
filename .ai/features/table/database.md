# Table Database Entities

## `Table`
- **Fields**: `id`, `restaurantId`, `name`, `qrCode` (Unique), `capacity`, `isActive`, `createdAt`, `updatedAt`, `deletedAt`
- **Relationships**: Belongs to `Restaurant`. Has many `Session`.

