# Audit — Overview

## Business Purpose
End-of-day (EOD) session-level financial accountability report for restaurant managers. Provides a per-session breakdown of table, guest count, gross/net/tax/tip amounts, payment methods, and session status. Exportable as a CSV file.

## Report Scope
Scoped to `restaurantId` + `businessDate`. Excludes `OPEN` sessions (only closed sessions are auditable).

## Responsibilities
- `GET /api/v1/restaurants/:id/audit/eod?date=YYYY-MM-DD` — return structured JSON EOD report.
- `GET /api/v1/restaurants/:id/audit/eod/export?date=YYYY-MM-DD` — return CSV file attachment.

## Architecture
- No dedicated audit table. Report is computed on-demand via `Session + Payment + Table` joins.
- CSV is generated via manual string building (no external CSV library).
- No PDF export implemented.

## Use Case
`GetEODAuditReportUseCase` → `EodAuditRepository` → Prisma query → domain aggregation.
`CsvExportAdapter.generateEodCsv()` converts the report DTO into CSV bytes.
