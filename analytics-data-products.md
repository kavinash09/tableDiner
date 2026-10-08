# TableDiner Analytics Data Products Specification

**Document**: `analytics-data-products.md`  
**Role**: Principal Analytics Architect, Data Product Manager  
**Status**: Formal Data Product Contracts  
**Date**: 2026-10-09  

---

## 1. What is an Analytics Data Product?

In TableDiner's event-driven architecture, a **Data Product** is a self-contained, domain-oriented analytical asset designed to answer specific business questions. Each data product is:
1. **Derived purely from immutable domain events**.
2. **Materialized in dedicated query-optimized storage**.
3. **Maintained via incremental streaming updates**.
4. **Governed by a strict API query contract**.

```
[ Domain Events ] ──► [ Projector Pipeline ] ──► [ Analytics Data Product ] ──► [ Dashboards / APIs ]
```

---

## 2. Catalog of Core Analytics Data Products

---

### Data Product 1: `DailyAndHourlyRevenueProduct`

- **Business Value**: Provides restaurant managers with real-time financial tracking, peak revenue rush detection, and tender breakdown.
- **Source Events**:
  - `dining.session.closed`
  - `payment.settlement.completed`
  - `payment.settlement.refunded`
- **Aggregation Rules**:
  - `GrossRevenue` = $\sum \text{totalAmount}$
  - `NetRevenue` = $\sum \text{totalAmount} - \sum \text{taxAmount} - \sum \text{tipAmount}$
  - `AverageTicketSize` = $\text{NetRevenue} / \text{ClosedSessionCount}$
  - `HourlyGrossRevenue(H)` = $\sum \text{totalAmount}$ for events where $\text{HOUR}(\text{closedAt}) = H$
- **Refresh Strategy**: Real-time streaming increment on each `dining.session.closed` event.
- **Storage Strategy**: Relational projection table `AggHourlyRevenue` indexed on `[restaurantId, businessDate, hourOfDay]`.
- **API Contract**:
  ```typescript
  interface RevenueProductDTO {
    businessDate: string;
    summary: {
      grossRevenue: number;
      netRevenue: number;
      tax: number;
      tips: number;
      discounts: number;
      avgTicketSize: number;
    };
    hourlyBreakdown: Array<{
      hour: number; // 0 - 23
      grossRevenue: number;
      orderCount: number;
    }>;
  }
  ```

---

### Data Product 2: `TableOccupancyAndTurnProduct`

- **Business Value**: Measures floor efficiency, dining duration, and table turnover velocity (RevPASH).
- **Source Events**:
  - `dining.session.opened`
  - `dining.session.closed`
  - `dining.table.occupied`
  - `dining.table.released`
- **Aggregation Rules**:
  - `SessionTurnTimeMinutes` = $(\text{closedAt} - \text{openedAt}) / 60000.0$
  - `AverageTurnTime` = $\sum \text{SessionTurnTimeMinutes} / \text{ClosedSessionCount}$
  - `OccupancyPercent` = $\sum \text{SessionTurnTimeMinutes} / (\text{ActiveTableCount} \times 720)$
  - `RevPASH` (Revenue per Available Seat Hour) = $\text{NetRevenue} / (\text{TotalCapacity} \times \text{OperatingHours})$
- **Refresh Strategy**: Incremental on session close.
- **Storage Strategy**: `AggTableUtilizationSummary` indexed on `[restaurantId, businessDate, tableId]`.
- **API Contract**:
  ```typescript
  interface TableUtilizationProductDTO {
    businessDate: string;
    metrics: {
      coversServed: number;
      avgPartySize: number;
      avgTableTurnTimeMinutes: number;
      occupancyPercentage: number;
      revPASH: number;
    };
    tableRankings: Array<{
      tableId: string;
      tableName: string;
      turnsCount: number;
      totalRevenue: number;
      avgTurnTimeMinutes: number;
    }>;
  }
  ```

---

### Data Product 3: `DishPopularityAndMenuProduct`

- **Business Value**: Uncovers bestsellers, underperforming dishes, kitchen wastage, and category mix.
- **Source Events**:
  - `kitchen.order.placed`
  - `kitchen.order.served`
  - `kitchen.order.cancelled`
- **Aggregation Rules**:
  - `QuantitySold(Dish)` = $\sum \text{quantity}$ across served orders.
  - `GrossSales(Dish)` = $\sum \text{lineTotal}$ across served orders.
  - `DishCancellationRate` = $\text{VoidedQuantity} / (\text{QuantitySold} + \text{VoidedQuantity})$.
  - `CategoryContributionPercent` = $\text{CategorySales} / \text{TotalFoodSales} \times 100$.
- **Refresh Strategy**: Real-time increment on `kitchen.order.placed` (provisional) and `kitchen.order.served` (confirmed).
- **Storage Strategy**: `AggDishSalesSummary` indexed on `[restaurantId, businessDate, menuItemId]`.
- **API Contract**:
  ```typescript
  interface DishProductDTO {
    businessDate: string;
    topPerformers: Array<{
      menuItemId: string;
      itemName: string;
      categoryName: string;
      quantitySold: number;
      grossRevenue: number;
      marginEstimate: number;
    }>;
    categoryShare: Array<{
      categoryId: string;
      categoryName: string;
      revenue: number;
      percentageShare: number;
    }>;
  }
  ```

---

### Data Product 4: `KitchenSlaPerformanceProduct`

- **Business Value**: Tracks ticket turnaround times across kitchen stations, identifying cooking bottlenecks.
- **Source Events**:
  - `kitchen.order.placed`
  - `kitchen.order.accepted`
  - `kitchen.order.ready`
  - `kitchen.order.served`
- **Aggregation Rules**:
  - `TimeInQueue` = $(\text{acceptedAt} - \text{placedAt}) / 60000.0$
  - `KitchenPrepTime` = $(\text{readyAt} - \text{acceptedAt}) / 60000.0$
  - `WaiterServiceTime` = $(\text{servedAt} - \text{readyAt}) / 60000.0$
  - `TotalFulfillmentTime` = $(\text{servedAt} - \text{placedAt}) / 60000.0$
  - `SlaViolationCount` = Count of orders where $\text{TotalFulfillmentTime} > 25.0 \text{ mins}$
- **Refresh Strategy**: Incremental running average calculation on each `kitchen.order.served`.
- **Storage Strategy**: `AggKitchenSlaSummary` indexed on `[restaurantId, businessDate]`.
- **API Contract**:
  ```typescript
  interface KitchenSlaProductDTO {
    businessDate: string;
    averages: {
      avgQueueTimeMinutes: number;
      avgKitchenPrepMinutes: number;
      avgServiceMinutes: number;
      avgFulfillmentMinutes: number;
    };
    slaComplianceRate: number; // e.g. 94.2%
    violationsCount: number;
  }
  ```

---

### Data Product 5: `DinerJourneyFunnelProduct`

- **Business Value**: Visualizes the diner conversion funnel from digital QR scan to payment completion.
- **Source Events**:
  - `digital.menu.viewed`
  - `digital.dish.viewed`
  - `digital.cart.item_added`
  - `kitchen.order.placed`
  - `payment.settlement.completed`
- **Aggregation Rules**:
  - `ScanToOrderConversion` = $\text{DistinctSessionsWithOrders} / \text{DistinctScannedSessions} \times 100$
  - `CartAbandonmentRate` = $(\text{CartsStarted} - \text{OrdersPlaced}) / \text{CartsStarted} \times 100$
- **Refresh Strategy**: Near real-time streaming batching (5-minute micro-batches).
- **Storage Strategy**: `AggDinerFunnelSummary` indexed on `[restaurantId, businessDate]`.
- **API Contract**:
  ```typescript
  interface DinerFunnelDTO {
    businessDate: string;
    stages: {
      qrScans: number;
      menuBrowsers: number;
      cartStarters: number;
      ordersPlaced: number;
      paymentsCompleted: number;
    };
    conversionRates: {
      scanToMenuPercent: number;
      menuToCartPercent: number;
      cartToOrderPercent: number;
      overallConversionPercent: number;
    };
  }
  ```

---

## 3. Data Product Quality & Reconciliation Protocol

To ensure continuous trust and absolute mathematical accuracy:

1. **Nightly EOD Reconciliation Job**: A scheduled reconciliation cron executes 1 hour after the restaurant cutoff time:
   - Reads the raw immutable `AnalyticsEvent` store for the entire business date.
   - Computes ground-truth sums.
   - Compares against the materialized read models.
   - If any variance $> ₹0.01$ is detected, the projection is automatically corrected and an audit record is logged to `TenantAuditLog`.
2. **Immutable Traceability**: Every metric in every data product links directly to the sequence of `eventId`s that generated it, enabling complete drill-down auditability.

