# Restaurant Feature Overview

## Business Purpose
Manages restaurant settings (theme, qrTemplate), banner images, menu categories, and menu items. Allows restaurant owners to customize their digital storefront and manage their offerings.

## Responsible For
- `GET /restaurant/current`
- `PATCH /restaurant/:id/settings`
- `POST /restaurant/:id/banner`
- `POST /restaurant/:id/categories`
- `DELETE /category/:id`
- `POST /restaurant/:id/items`
- `PATCH /menu-item/:id`
- `DELETE /menu-item/:id`

## Current Limitations
- Hard deletes are used on `MenuCategory` and `MenuItem`, which violates Rule 19 and destroys historical order data.
- `AppUseCases.createMenuItem` and `updateMenuItem` use `data: any`, bypassing type safety.
- `getCurrentRestaurant()` uses `findFirst()` as an MVP hack, which is not tenant-aware.
- No RBAC enforcement on any route currently.

