# Analytics — Database Entities

## Entities Used (read-only aggregation)

### `Session` — Financial & Utilisation
| Column | Role |
|---|---|
| subtotal | Pre-tax/tip revenue |
| taxAmount | Tax portion |
| tipAmount | Tip portion |
| discountAmount | Discounts applied |
| totalAmount | Final charge |
| refundedAmount | Post-close refunds |
| businessDate | Partition key for all analytics queries (**NOT set on creation — BUG-O2**) |
| closedAt | Used to compute session duration |
| status | Filter: exclude `OPEN` |

### `Order` — SLA
| Column | Role |
|---|---|
| acceptedAt | Time kitchen accepted order |
| readyAt | Time order marked ready |
| servedAt | Time order marked served |

SLA deltas computed in Node.js: `acceptedAt - createdAt`, `readyAt - acceptedAt`, `servedAt - readyAt`.

### `Subscription` — Platform MRR
| Column | Role |
|---|---|
| mrr | Summed across `status = ACTIVE` subscriptions |

### `Tenant` — Platform Funnel
| Column | Role |
|---|---|
| onboardingStatus | Grouped count for funnel breakdown |

## Indexes (Performance-critical)
| Index | Columns |
|---|---|
| Session | `[tenantId, businessDate]` |
| Session | `[restaurantId, businessDate]` |
| Session | `[tenantId, status]` |
