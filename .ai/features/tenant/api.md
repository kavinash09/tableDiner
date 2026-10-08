# Tenant — API

## Routes

### `GET /admin/restaurants`
Returns all Tenants with nested Restaurants and Tables.

**Response shape**
```json
[
  {
    "id": "...",
    "name": "...",
    "onboardingStatus": "ACTIVE",
    "restaurants": [
      {
        "id": "...",
        "name": "...",
        "tables": [ { "id": "...", "name": "...", "qrCode": "..." } ]
      }
    ]
  }
]
```

**Gaps**
- No authentication or authorization guard.
- No pagination.

---

### `POST /admin/restaurants`
Provisions a new Tenant + Restaurant + Tables atomically.

**Request body** (validated by `CreateRestaurantSchema`)
```json
{
  "tenantName": "string",
  "restaurantName": "string",
  "tablesCount": 10
}
```

**Response**
```json
{ "success": true, "data": { "tenantId": "...", "restaurantId": "..." } }
```

**Gaps**
- No validation for maximum `tablesCount`.
- No duplicate tenant/restaurant name check.
- No auth guard — any caller can create a tenant.
