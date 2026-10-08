# Audit — Tests

## Existing Tests
**1 test** — `GetEODAuditReportUseCase` unit test: mocks the repository, asserts output shape and financial summary calculation.

## Missing Tests

| Type | Description |
|---|---|
| Unit | `CsvExportAdapter.generateEodCsv` — happy path: correct column headers + data rows |
| Unit | `CsvExportAdapter.generateEodCsv` — empty sessions array → CSV with headers only |
| Unit | `CsvExportAdapter.generateEodCsv` — table name containing commas or quotes → correctly escaped |
| Unit | `GetEODAuditReportUseCase` — `OPEN` sessions excluded from report |
| Unit | `GetEODAuditReportUseCase` — `netAmount` computed correctly |
| Integration | `GET /api/v1/restaurants/:id/audit/eod` — seeded closed sessions appear in response |
| Integration | `GET /api/v1/restaurants/:id/audit/eod/export` — `Content-Disposition` header present, CSV body has correct column structure |
