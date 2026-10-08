# 04 — API Catalog

> **Source**: `apps/api/src/index.ts`  
> **Base URL**: `http://localhost:3001`  
> **Auth**: JWT session cookie (Auth.js). Routes requiring authentication validate the session via the Auth.js bridge in `authRoute.ts`.  
> **Validation schemas**: defined in `packages/shared-validation` (Zod).

---

## Customer (Diner) Routes

| Method | Route | Validation Schema | Handler / Use Case | Description |
|---|---|---|---|---|
| GET | `/health` | — | inline | Health check; returns `{ ok: true }` |
| GET | `/table/:qrCode` | — | `getTableDetails` | Returns table info, active session, and menu for the scanned QR code |
| POST | `/table/:qrCode/order` | `PlaceOrderSchema` | `placeOrder` | Places a new order; creates a Session if none is OPEN for the table |
| GET | `/table/:qrCode/bill` | — | `getBill` | Returns current bill total for the active session ⚠️ uses live price |
| POST | `/table/:qrCode/pay` | `PaySchema` | `payBill` | Submits payment for the active session; delegates to `processCheckout` |

---

## Kitchen Routes

| Method | Route | Validation Schema | Handler / Use Case | Description |
|---|---|---|---|---|
| GET | `/kitchen/orders` | — | `getKitchenOrders` | Returns all active orders across tables for the authenticated restaurant |
| PATCH | `/kitchen/orders/:orderId` | `UpdateOrderStatusSchema` | `updateOrderStatus` | Advances or rejects an order's status (RECEIVED → PREPARING → READY → SERVED / CANCELLED / REJECTED) |

---

## Menu Admin Routes

| Method | Route | Validation Schema | Handler / Use Case | Description |
|---|---|---|---|---|
| POST | `/restaurant/:id/categories` | `CreateCategorySchema` | `createMenuCategory` | Creates a new menu category under the restaurant |
| DELETE | `/category/:id` | — | `deleteMenuCategory` | Hard-deletes a menu category ⚠️ no soft-delete |
| POST | `/restaurant/:id/items` | `CreateMenuItemSchema` | `createMenuItem` | Creates a new menu item under the restaurant |
| PATCH | `/menu-item/:id` | `UpdateMenuItemSchema` | `updateMenuItem` | Updates fields on an existing menu item |
| DELETE | `/menu-item/:id` | — | `deleteMenuItem` | Hard-deletes a menu item ⚠️ may orphan OrderItems |
| POST | `/menu-item/:id/image` | multipart | `updateMenuItemImage` | Uploads and associates an image URL with a menu item |

---

## Restaurant Admin Routes

| Method | Route | Validation Schema | Handler / Use Case | Description |
|---|---|---|---|---|
| GET | `/restaurant/current` | — | `getCurrentRestaurant` | Returns the first restaurant for the authenticated tenant ⚠️ MVP hack — ignores multi-restaurant |
| PATCH | `/restaurant/:id/settings` | `UpdateRestaurantSettingsSchema` | `updateRestaurantSettings` | Updates theme and qrTemplate for a restaurant |
| POST | `/restaurant/:id/banner` | multipart | `updateRestaurantBanner` | Uploads and sets the restaurant banner image URL |

---

## Platform Admin Routes

| Method | Route | Validation Schema | Handler / Use Case | Description |
|---|---|---|---|---|
| GET | `/admin/restaurants` | — | `getPlatformTenants` | Returns all tenants and their restaurants (platform-level) |
| POST | `/admin/restaurants` | `CreateRestaurantSchema` | `createPlatformTenant` | Provisions a new tenant with a restaurant and a specified number of tables |

---

## Analytics / Reporting Routes

| Method | Route | Validation Schema | Handler / Use Case | Description |
|---|---|---|---|---|
| GET | `/api/v1/restaurants/:id/metrics/daily` | `?date=YYYY-MM-DD` | `GetRestaurantDashboardUseCase` | Returns daily revenue and order metrics for a restaurant on a business date |
| GET | `/api/v1/restaurants/:id/audit/eod` | `?date=YYYY-MM-DD` | `GetEODAuditReportUseCase` | Returns end-of-day audit report for a restaurant |
| GET | `/api/v1/restaurants/:id/audit/eod/export` | `?date=YYYY-MM-DD` | `GetEODAuditReportUseCase` | Exports EOD audit report (e.g. CSV download) |
| GET | `/api/v1/platform/metrics` | `?date=YYYY-MM-DD` | `GetPlatformDashboardUseCase` | Returns platform-wide metrics across all tenants for a date |

---

## Auth Routes

| Method | Route | Validation Schema | Handler | Description |
|---|---|---|---|---|
| ALL | `/api/auth/*` | Auth.js internal | `authRoute.ts` bridge | Proxies all Auth.js protocol routes (CSRF, sign-in, session, sign-out) to `@auth/core`. CredentialsProvider only (email + bcrypt). |

### Auth Flow (Frontend)
1. `GET /api/auth/csrf` — fetch CSRF token
2. `POST /api/auth/callback/credentials` with `{ email, password, csrfToken }`, `redirect: 'manual'`
3. `GET /api/auth/session` — retrieve JWT session object

---

## Validation Schemas Quick Reference

| Schema | Package | Validates |
|---|---|---|
| `PlaceOrderSchema` | shared-validation | Array of `{ menuItemId, quantity }` |
| `PaySchema` | shared-validation | `{ amount, method }` |
| `UpdateOrderStatusSchema` | shared-validation | `{ status: OrderStatus }` |
| `CreateCategorySchema` | shared-validation | `{ name, sortOrder? }` |
| `CreateMenuItemSchema` | shared-validation | `{ name, price, categoryId, isAvailable? }` |
| `UpdateMenuItemSchema` | shared-validation | Partial menu item fields |
| `CreateRestaurantSchema` | shared-validation | `{ tenantName, restaurantName, tablesCount }` |
| `UpdateRestaurantSettingsSchema` | shared-validation | `{ theme?, qrTemplate? }` |
