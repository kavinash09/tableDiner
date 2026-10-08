# Analytics — Business Rules

## Rules

| # | Rule |
|---|---|
| BR-A1 | All metrics are scoped to a single `businessDate` (format: `YYYY-MM-DD`). |
| BR-A2 | Only `CLOSED` / `FINALIZED` sessions are included; `OPEN` sessions are excluded. |
| BR-A3 | SQLite lacks native date-diff — SLA and occupancy are computed in-memory by Node.js after DB fetch. |
| BR-A4 | Platform MRR = sum of `Subscription.mrr` for all `ACTIVE` subscriptions. |
| BR-A5 | GMV = sum of `Session.totalAmount` across all closed sessions on the given `businessDate` for all tenants. |
| BR-A6 | Occupancy % = (total session-minutes in day) ÷ (tableCount × 720 minutes) × 100. |
| BR-A7 | `businessDayCutoffHour` governs day boundary at query time. |

## Known Violations / Gaps

> [!CAUTION]
> **BUG-O2 cascade**: `Session.businessDate` is never populated during Session creation. All analytics queries filter by `businessDate`, so real data always returns 0. Fix requires setting `businessDate` at Session creation time.

- No caching — every dashboard request runs fresh DB aggregation.
- No access control: any caller can query any restaurant's metrics.
