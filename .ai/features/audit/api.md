# Audit — API

## Routes

### `GET /api/v1/restaurants/:id/audit/eod`
Returns the structured EOD audit report for a restaurant on a given business date.

**Query param**: `date` (required) — `YYYY-MM-DD`

**Response** (`RestaurantEodReportResponse`)
```json
{
  "businessDate": "2024-01-15",
  "financialSummary": {
    "totalGrossRevenue": 0.0,
    "totalNetRevenue": 0.0,
    "totalTax": 0.0,
    "totalTips": 0.0,
    "sessionCount": 0
  },
  "sessions": [
    {
      "sessionId": "string",
      "tableName": "string",
      "guestCount": 2,
      "grossAmount": 50.00,
      "netAmount": 42.00,
      "taxAmount": 5.00,
      "tipAmount": 3.00,
      "paymentMethods": ["CARD"],
      "status": "CLOSED",
      "closedAt": "2024-01-15T22:00:00Z"
    }
  ]
}
```

---

### `GET /api/v1/restaurants/:id/audit/eod/export`
Returns the same report data as a downloadable CSV file.

**Query param**: `date` (required) — `YYYY-MM-DD`

**Response headers**
```
Content-Type: text/csv
Content-Disposition: attachment; filename="eod-report-2024-01-15.csv"
```

**CSV columns**: sessionId, tableName, guestCount, grossAmount, netAmount, taxAmount, tipAmount, paymentMethods, status, closedAt

**Gaps**
- No auth guard.
- No PDF export alternative.
- Special characters in `tableName` may not be escaped correctly.
