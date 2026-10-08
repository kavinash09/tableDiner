# Restaurant Tests

## Existing Tests
- **0 tests** exist for the restaurant feature.

## Missing Tests
- **Unit Tests**:
  - `AppUseCases.getCurrentRestaurant()`: MVP hack, needs testing when fixed for multi-tenancy.
  - `AppUseCases.updateRestaurantSettings()`
  - `AppUseCases.createMenuCategory()`
  - `AppUseCases.deleteMenuCategory()`: Verify soft delete behavior.
  - `AppUseCases.createMenuItem()`: Verify type safety and validation.
  - `AppUseCases.updateMenuItem()`
  - `AppUseCases.deleteMenuItem()`: Verify soft delete behavior.
- **Integration Tests**:
  - `GET /restaurant/current`
  - `PATCH /restaurant/:id/settings`
  - `POST /restaurant/:id/categories`
  - `DELETE /category/:id`
  - `POST /restaurant/:id/items`
  - `PATCH /menu-item/:id`
  - `DELETE /menu-item/:id`

