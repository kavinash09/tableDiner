# Audit — Business Rules

## Rules

| # | Rule |
|---|---|
| BR-AU1 | Report is scoped to exactly one `restaurantId` + one `businessDate`. |
| BR-AU2 | Only `CLOSED` / `FINALIZED` sessions are included. `OPEN` sessions are excluded. |
| BR-AU3 | `netAmount = totalAmount − taxAmount − tipAmount`. Computed per session. |
| BR-AU4 | `paymentMethods` per session = deduplicated list of `method` values from all `COMPLETED` `Payment` records for that session. |
| BR-AU5 | CSV is built via manual string concatenation. Special characters (commas, newlines) in table names or notes must be escaped. |

## Financial Summary (report-level aggregate)
- `totalGrossRevenue` = sum of `session.totalAmount`
- `totalNetRevenue` = sum of `session.netAmount`
- `totalTax` = sum of `session.taxAmount`
- `totalTips` = sum of `session.tipAmount`
- `sessionCount` = count of included sessions

## Known Gaps
- No PDF export.
- No pagination on the sessions array — large-day reports could be very large.
- `Payment.method` is always `null` currently (BUG-B2 side-effect), so `paymentMethods` array is always empty.
- No auth guard on audit routes.
