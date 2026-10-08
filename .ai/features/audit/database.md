# Audit — Database Entities

## No Dedicated Audit Table
The EOD report is computed on-demand from existing operational tables via joins.

## Entities Joined

### `Session`
| Column | Role |
|---|---|
| status | Filter: `CLOSED` / `FINALIZED` only |
| closedAt | Report timestamp |
| totalAmount | Gross revenue per session |
| taxAmount | Tax portion |
| tipAmount | Tip portion |
| discountAmount | Applied discounts |
| refundedAmount | Post-close refunds |
| businessDate | Filter key (**NOT set on creation — BUG-O2; report returns empty until fixed**) |
| tableId | FK → Table |

### `Payment`
| Column | Role |
|---|---|
| status | Filter: `COMPLETED` only |
| method | Deduplicated into `paymentMethods[]` per session (currently always null — BUG-B2) |
| sessionId | Join key |

### `Table`
| Column | Role |
|---|---|
| name | Human-readable table identifier in report |
| restaurantId | Filter: scope to requested restaurant |

## Derived Fields (computed in application layer)
- `netAmount = totalAmount − taxAmount − tipAmount`
- `paymentMethods` = `Array.from(new Set(payments.map(p => p.method)))`
- All financial summary fields = aggregation over `sessions[]`
