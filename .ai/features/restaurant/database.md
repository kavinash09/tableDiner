# Restaurant Database Entities

## `Restaurant`
- **Fields**: `id`, `tenantId`, `name`, `theme`, `qrTemplate`, `bannerUrl`, `businessDayCutoffHour`, `isActive`, `createdAt`, `updatedAt`, `deletedAt`
- **Relationships**: Belongs to `Tenant`. Has many `Table`, `MenuCategory`, `MenuItem`.

## `MenuCategory`
- **Fields**: `id`, `restaurantId`, `name`, `sortOrder`, `isActive`, `createdAt`, `updatedAt`, `deletedAt`
- **Relationships**: Belongs to `Restaurant`. Has many `MenuItem`.

## `MenuItem`
- **Fields**: `id`, `restaurantId`, `categoryId`, `name`, `description`, `price` (Float), `imageUrl`, `isAvailable`, `isVeg`, `spicinessLevel`, `isActive`, `createdAt`, `updatedAt`, `deletedAt`
- **Relationships**: Belongs to `Restaurant`, `MenuCategory`.

