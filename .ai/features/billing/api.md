# Billing — API

## Routes

### `GET /table/:qrCode/bill`
Returns itemized bill for the active `OPEN` session.

**Path param**: `qrCode`

**Response** (`BillResponse`)
```json
{
  "sessionId": "string",
  "itemized": [
    {
      "menuItemName": "string",
      "quantity": 2,
      "unitPrice": 12.50,
      "lineTotal": 25.00
    }
  ],
  "totalAmount": 25.00
}
```

**Bug**: `unitPrice` in response comes from live `menuItem.price`, not `OrderItem.unitPrice`.

---

### `POST /table/:qrCode/pay`
Submits payment for the active session.

**Path param**: `qrCode`

**Request body** (validated by `PaySchema`)
```json
{ "amount": 25.00 }
```

**Response**
```json
{ "success": true, "message": "Payment processed successfully" }
```

**Behavior**
1. Resolves table by `qrCode`.
2. Finds `OPEN` session.
3. Validates `amount ≥ totalAmount`.
4. Creates `Payment` (status: `COMPLETED`).
5. Updates `Session` (status: `CLOSED`, `closedAt`: now).

**Gaps**
- No auth guard.
- No real payment gateway — payment is accepted unconditionally if amount is sufficient.
- `Payment.method` is not set.
