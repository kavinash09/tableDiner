# Restaurant APIs

| Method | Route | Validation Schema | Response | Description |
|---|---|---|---|---|
| GET | `/restaurant/current` | None | `{ success, restaurant }` | Gets current restaurant (⚠️ MVP hack: returns first) |
| PATCH | `/restaurant/:id/settings` | `UpdateRestaurantSettingsSchema` | `{ success, restaurant }` | Updates theme, qrTemplate |
| POST | `/restaurant/:id/banner` | multipart/form-data | `{ success, url }` | Uploads and sets banner image |
| POST | `/restaurant/:id/categories` | `CreateCategorySchema` | `{ success, category }` | Creates a new menu category |
| DELETE | `/category/:id` | None | `{ success }` | Deletes a menu category (⚠️ BUG: hard delete) |
| POST | `/restaurant/:id/items` | `CreateMenuItemSchema` | `{ success, menuItem }` | Creates a new menu item (⚠️ BUG: `data: any`) |
| PATCH | `/menu-item/:id` | `UpdateMenuItemSchema` | `{ success, menuItem }` | Updates a menu item (⚠️ BUG: `data: any`) |
| DELETE | `/menu-item/:id` | None | `{ success }` | Deletes a menu item (⚠️ BUG: hard delete) |
| POST | `/menu-item/:id/image` | multipart/form-data | `{ success, url }` | Uploads and sets menu item image |

