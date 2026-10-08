# TableDiner Self-Serve Analytics & Semantic Query Engine

**Document**: `self-serve-analytics-model.md`  
**Role**: Principal Analytics Architect, Staff Software Engineer  
**Status**: Semantic Layer Architecture & Query DSL Specification  
**Date**: 2026-10-09  

---

## 1. Architectural Vision: The Semantic Layer

The ultimate goal of TableDiner's analytics evolution is to empower restaurant operators and platform admins to ask arbitrary business questions **without requiring engineers to write new API endpoints, database queries, or schema migrations**.

```
┌────────────────────────────────────────────────────────┐
│ UI Analytics Explorer (Dynamic Charts & Pivot Tables) │
└──────────────────────────┬─────────────────────────────┘
                           │ Dynamic Analytics Query DSL (JSON)
                           ▼
┌────────────────────────────────────────────────────────┐
│ Fastify Semantic API (`POST /api/v1/analytics/query`)  │
├────────────────────────────────────────────────────────┤
│ 1. Schema Validation (Zod Query DSL Schema)            │
│ 2. Tenant Context Enforcement (Strict Scoping)         │
│ 3. Semantic Query Compiler (DSL ──► Safe SQL)          │
│ 4. Execution over Projections & Event Store            │
│ 5. Results Caching & Formatting (Pivot / Time-Series)  │
└────────────────────────────────────────────────────────┘
```

---

## 2. Semantic Model: Dimensions & Measures

The Semantic Layer defines the canonical dictionary of business concepts.

### 2.1 Dimensions (Attributes by which data can be grouped or sliced)

| Dimension Name | Type | Description | Source Field |
|---|---|---|---|
| `time.date` | Date | Business date (`YYYY-MM-DD`) | `businessDate` |
| `time.hour` | Integer | Hour of day (0–23) | `HOUR(occurredAt)` |
| `time.day_of_week` | String | "Monday", "Tuesday", etc. | `STRFTIME('%w', occurredAt)` |
| `table.id` | String | Physical table identifier | `payload.tableId` |
| `table.name` | String | Human table label ("T1", "Bar 2")| `payload.tableName` |
| `menu.item_id` | String | Menu dish identifier | `payload.menuItemId` |
| `menu.item_name` | String | Dish name ("Butter Chicken") | `payload.itemName` |
| `menu.category_name` | String | Menu category ("Curries") | `payload.categoryName` |
| `payment.method` | String | Tender type ("UPI", "CASH") | `payload.method` |
| `order.status` | String | Status ("SERVED", "CANCELLED") | `payload.status` |

### 2.2 Measures (Quantitative numerical metrics that can be aggregated)

| Measure Name | Aggregation | Formula | Description |
|---|---|---|---|
| `revenue.gross` | `SUM` | `SUM(payload.totalAmount)` | Total customer spend |
| `revenue.net` | `SUM` | `SUM(payload.totalAmount - payload.taxAmount - payload.tipAmount)` | Merchant revenue |
| `revenue.tips` | `SUM` | `SUM(payload.tipAmount)` | Gratuity collected |
| `sessions.count` | `COUNT_DISTINCT` | `COUNT(DISTINCT payload.sessionId)` | Completed dining tables |
| `covers.total` | `SUM` | `SUM(payload.guestCount)` | Total guests served |
| `dishes.quantity_sold`| `SUM` | `SUM(payload.quantity)` | Dish units ordered |
| `orders.count` | `COUNT` | `COUNT(id)` | Kitchen tickets |
| `turn_time.average` | `AVG` | `AVG(payload.turnTimeMinutes)` | Average table turnover |
| `kitchen.prep_time_avg`| `AVG` | `AVG(payload.kitchenPrepMinutes)`| Average cooking time |
| `fulfillment.time_avg` | `AVG` | `AVG(payload.totalFulfillmentMinutes)`| Average order fulfillment |

---

## 3. Universal Analytics Query DSL (JSON)

Clients interact with the Semantic Layer by sending a structured JSON payload to `POST /api/v1/analytics/query`:

```json
{
  "restaurantId": "cmuzy8tmt0004rl4r2wvzds88",
  "timeRange": {
    "startDate": "2026-10-01",
    "endDate": "2026-10-09"
  },
  "dimensions": [
    "menu.category_name",
    "time.day_of_week"
  ],
  "measures": [
    "revenue.gross",
    "dishes.quantity_sold"
  ],
  "filters": [
    {
      "dimension": "order.status",
      "operator": "EQUALS",
      "value": "SERVED"
    }
  ],
  "orderBy": [
    { "field": "revenue.gross", "direction": "DESC" }
  ],
  "limit": 20
}
```

### Zod Contract Schema:
```typescript
export const AnalyticsQuerySchema = z.object({
  restaurantId: z.string().cuid(),
  timeRange: z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  }),
  dimensions: z.array(z.enum([
    'time.date', 'time.hour', 'time.day_of_week',
    'table.id', 'table.name',
    'menu.item_id', 'menu.item_name', 'menu.category_name',
    'payment.method', 'order.status'
  ])).min(1),
  measures: z.array(z.enum([
    'revenue.gross', 'revenue.net', 'revenue.tips',
    'sessions.count', 'covers.total',
    'dishes.quantity_sold', 'orders.count',
    'turn_time.average', 'kitchen.prep_time_avg', 'fulfillment.time_avg'
  ])).min(1),
  filters: z.array(z.object({
    dimension: z.string(),
    operator: z.enum(['EQUALS', 'NOT_EQUALS', 'IN', 'GREATER_THAN', 'LESS_THAN']),
    value: z.union([z.string(), z.number(), z.array(z.string())])
  })).optional(),
  orderBy: z.array(z.object({
    field: z.string(),
    direction: z.enum(['ASC', 'DESC'])
  })).optional(),
  limit: z.number().int().min(1).max(500).default(50)
});
```

---

## 4. Query Compilation & Execution Pipeline

```
[ DSL Request ] ──► [ Query Compiler ] ──► [ Parameterized SQL ] ──► [ DB Execute ] ──► [ Pivot JSON ]
```

### 4.1 Security & Injection Prevention
- The Semantic Query Compiler **never concatenates raw SQL strings**.
- Dimensions and measures are mapped to an internal dictionary of verified column expressions.
- The `tenantId` and `restaurantId` are strictly injected by the authenticated user's session context, preventing cross-tenant data leakage.

### 4.2 Query Compilation Example
When the client asks for `dimensions: ["menu.category_name"]`, `measures: ["revenue.gross", "dishes.quantity_sold"]`:
The compiler targets the fast `AggDishSalesSummary` projection:
```sql
SELECT 
  categoryName as "menu.category_name",
  SUM(grossRevenue) as "revenue.gross",
  SUM(quantitySold) as "dishes.quantity_sold"
FROM AggDishSalesSummary
WHERE restaurantId = $1
  AND businessDate BETWEEN $2 AND $3
GROUP BY categoryName
ORDER BY "revenue.gross" DESC
LIMIT 20;
```

If the query requests raw event-level granularity (e.g., custom time buckets down to the minute), the compiler transparently falls back to querying the immutable `AnalyticsEvent` store.

---

## 5. Standardized Response Format & Client Visualization

The Semantic API responds in a tabular vector format optimized for charting libraries (Chart.js, Recharts, TanStack Table):

```json
{
  "meta": {
    "dimensions": ["menu.category_name", "time.day_of_week"],
    "measures": ["revenue.gross", "dishes.quantity_sold"],
    "rowCount": 3,
    "executionTimeMs": 4.2
  },
  "data": [
    {
      "menu.category_name": "Main Course",
      "time.day_of_week": "Friday",
      "revenue.gross": 48250.00,
      "dishes.quantity_sold": 142
    },
    {
      "menu.category_name": "Starters",
      "time.day_of_week": "Friday",
      "revenue.gross": 24100.00,
      "dishes.quantity_sold": 98
    },
    {
      "menu.category_name": "Beverages",
      "time.day_of_week": "Friday",
      "revenue.gross": 18450.00,
      "dishes.quantity_sold": 120
    }
  ]
}
```

---

## 6. Query Caching Strategy

1. **Deterministic Cache Key Generation**:
   $$\text{cacheKey} = \text{MD5}(\text{restaurantId} + \text{DSL\_JSON\_HASH})$$
2. **TTL Strategy**:
   - Historical date ranges ($\text{endDate} < \text{currentDate}$): **Cache TTL = 24 hours** (historical data is immutable).
   - Today's date range ($\text{endDate} = \text{currentDate}$): **Cache TTL = 15 seconds** (accommodates real-time streaming updates).
3. **Cache Invalidation**: Event projectors invalidate today's cached queries on high-impact state transitions (e.g., table checkout).

