# Ordering — API

## Routes

### `GET /table/:qrCode`
Resolves a table by QR code and returns its full context for the diner UI.

**Path param**: `qrCode` — unique identifier on the physical QR sticker.

**Response** (`TableDetailsResponse`)
```json
{
  "table": { "id": "...", "name": "..." },
  "restaurant": { "id": "...", "name": "...", "theme": {} },
  "session": { "id": "...", "status": "OPEN" } | null,
  "menu": {
    "categories": [
      {
        "id": "...", "name": "...",
        "items": [ { "id": "...", "name": "...", "price": 12.50 } ]
      }
    ]
  }
}
```

---

### `POST /table/:qrCode/order`
Places an order for a table. Auto-creates a Session if none is `OPEN`.

**Request body** (validated by `PlaceOrderSchema`)
```json
{
  "items": [
    { "menuItemId": "string", "quantity": 1, "notes": "optional string" }
  ]
}
```

**Response**
```json
{ "success": true, "order": { "id": "...", "status": "...", "items": [] } }
```

**Validation**
- `items` array must be non-empty.
- Each item: `menuItemId` required, `quantity ≥ 1`.

**Gaps**
- No authentication — any caller with a valid QR code can place orders.
- No check that `menuItem` belongs to the same restaurant as the table.
