# Restaurant Business Rules

1. **Tenant Association**: Every restaurant must belong to a `Tenant`.
2. **Menu Structure**: A restaurant has many `MenuCategory` items, which in turn contain `MenuItem` entries.
3. **Soft Deletes**: Categories and items must be soft-deleted (`isActive: false`, `deletedAt: now()`) to preserve historical order data. (⚠️ BUG: Current implementation uses hard deletes).
4. **Type Safety**: Menu item creation/updates must validate the schema strictly. (⚠️ BUG: `data: any` is used).
5. **Tenant Isolation**: Restaurant queries must be scoped to the current tenant. (⚠️ BUG: `getCurrentRestaurant` fetches the first restaurant unconditionally).

