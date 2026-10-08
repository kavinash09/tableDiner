# TableDiner — Principal Architect Knowledge Audit

> **Scope:** Full monorepo static analysis.  
> **Date:** 2026-10-08  
> **Status:** FINDINGS ONLY — no remediation applied.

---

## Executive Summary

The codebase implements a Hexagonal Architecture skeleton (ports, adapters, rich domain) but the skeleton is hollow in several critical places. Rich domain entities exist and are bypassed; schema enums are invented in application code; mandatory columns (`tenantId`, `businessDate`) are omitted on write; three hard deletes violate the platform's data-integrity constitution; and the test suite covers fewer than 5 % of use-case paths. The AI governance layer has overlapping and partially inconsistent rule files. Documentation (`.ai/ARCHITECTURE.md`, `docs/`) drifts from the live Prisma schema.

---

## 1 — Duplicated Knowledge

| # | Finding | Sources |
|---|---------|---------|
| D-1 | Rule definitions appear in both `.ai/AGENTS.md` (full constitution, 17 k+) and `.ai/AI_RULES.md` (1 258 bytes). Rule 22 is present in `AGENTS.md` but absent or inconsistently stated in `AI_RULES.md`. Any AI agent reading only `AI_RULES.md` receives an incomplete rule set. | `.ai/AGENTS.md`, `.ai/AI_RULES.md` |
| D-2 | Session lifecycle logic is partially described in `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md`, and `docs/DOMAIN_MODEL.md`. The three sources do not agree on session status values (see O-1 below). | `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md`, `docs/DOMAIN_MODEL.md` |
| D-3 | Zod validation schemas are defined in `packages/shared-validation/src/index.ts` **and** inline type guards exist in `apps/api/src/core/ports/Repositories.ts` and `apps/api/src/core/use-cases/AppUseCases.ts`. The shared-validation package is the authoritative location; inline guards create a second source of truth. | `packages/shared-validation/src/index.ts`, `apps/api/src/core/ports/Repositories.ts`, `apps/api/src/core/use-cases/AppUseCases.ts` |
| D-4 | `SCHEMA_AUDIT_REPORT.md` (repo root) and `.ai/PROJECT_INTELLIGENCE_PACK.md` both document schema-level findings. Content overlap is unquantified but both documents reference the same Prisma schema. A single living document should own schema observations. | `SCHEMA_AUDIT_REPORT.md`, `.ai/PROJECT_INTELLIGENCE_PACK.md` |

---

## 2 — Missing Knowledge

| # | Finding | Impact |
|---|---------|--------|
| M-1 | No architectural decision record (ADR) for the choice to store `unitPrice` as a snapshot on `OrderItem` vs. reading live `MenuItem.price`. The invariant exists in code (violated — see AV-5) but is not formally captured in `.ai/DECISIONS.md`. | Price-integrity bugs are invisible to AI agents and new engineers. |
| M-2 | `apps/api/src/uploadService.ts` implements an S3/local dual-mode upload path, but no ADR, no port interface, and no documentation describe its contract, toggle mechanism, or failure modes. | Any agent touching media upload has no authoritative spec to follow. |
| M-3 | The RBAC model referenced by `.ai/CURRENT_TASK.md` has no corresponding port interface, domain entity, or schema migration documented anywhere in `.ai/` or `docs/`. Work cannot proceed safely without a formal decision record. | Blocking: RBAC implementation may conflict with existing `User`/`Account`/`Tenant` schema. |
| M-4 | `businessDate` semantics (timezone, rollover time, who sets it) are absent from all documentation. The Prisma schema requires the field on `Session`; `PrismaSessionRepository` does not set it. | Runtime `null`-constraint violations on session creation. |
| M-5 | No runbook or environment guide documents the dual `DATABASE_URL` / `DIRECT_URL` Prisma connection pattern validated in `apps/api/src/config.ts`. | Onboarding friction; misconfiguration risk in CI and production. |
| M-6 | `CsvExportAdapter` (`apps/api/src/adapters/secondary/csv/CsvExportAdapter.ts`) has no documented column contract or format specification. Downstream consumers of EOD reports have no stable schema to depend on. | `.ai/DECISIONS.md`, `docs/ANALYTICS.md` |
| M-7 | `TenantAuditLog` exists in `packages/db/prisma/schema.prisma` but has no corresponding port, use case, or documentation. It is unclear whether it is actively written to or vestigial. | Audit trail completeness unknown. |

---

## 3 — Outdated Knowledge

| # | Finding | Stale Source | Authoritative Source |
|---|---------|-------------|---------------------|
| O-1 | `.ai/ARCHITECTURE.md` lists session status as `ACTIVE`. The Prisma schema defines the enum as `OPEN`, `CLOSED`, `REOPENED`, `FINALIZED`. `ACTIVE` does not exist. | `.ai/ARCHITECTURE.md` | `packages/db/prisma/schema.prisma` |
| O-2 | `docs/DOMAIN_MODEL.md` may describe the domain entity graph as authoritative. `AppUseCases.ts` bypasses `TableSession` and `Order` domain entities entirely and calls Prisma repositories directly. The model document overstates the role of domain entities in the running system. | `docs/DOMAIN_MODEL.md` | `apps/api/src/core/use-cases/AppUseCases.ts` |
| O-3 | `docs/PRD.md` and `docs/IMPLEMENTATION_MAP.md` are flagged as potentially stale. No versioning or last-reviewed date is attached to either document. Content accuracy relative to the live schema and use cases is unverified. | `docs/PRD.md`, `docs/IMPLEMENTATION_MAP.md` | `packages/db/prisma/schema.prisma`, `apps/api/src/core/use-cases/AppUseCases.ts` |
| O-4 | `.ai/ARCHITECTURE.md` route catalog may be stale relative to `apps/api/src/index.ts`, which is the single authoritative route registration point. Any discrepancy between the catalog and `index.ts` is silent. | `.ai/ARCHITECTURE.md` | `apps/api/src/index.ts` |

---

## 4 — Contradicting Rules

| # | Finding | Rule / Source |
|---|---------|---------------|
| CR-1 | **Soft-delete mandate vs. hard deletes in production code.** `.ai/AGENTS.md` Rule 19 states: "NEVER use hard deletes; always set `deletedAt`." `PrismaRepositories.ts` calls `prisma.menuCategory.delete()`, `prisma.menuItem.delete()` (two occurrences), and `prisma.menuItem.delete()` in `deleteItem()`. These are raw hard deletes with no `deletedAt` update. | `AGENTS.md` Rule 19 vs. `apps/api/src/adapters/secondary/db/PrismaRepositories.ts` |
| CR-2 | **Strict TypeScript mandate vs. `any` in ports and use cases.** The constitution requires strict TypeScript. `ITableRepository.findByQrCode` returns `Promise<any>`. `AppUseCases.ts` declares `data: any` in `createMenuItem` and `updateMenuItem`. | `AGENTS.md` (strict-TS rule) vs. `apps/api/src/core/ports/Repositories.ts`, `apps/api/src/core/use-cases/AppUseCases.ts` |
| CR-3 | **Hexagonal architecture mandate vs. bypassed domain entities.** The architecture mandates that use cases operate on domain entities, not raw persistence objects. `AppUseCases.ts` calls Prisma repositories directly and processes raw Prisma result objects; `TableSession` and `Order` rich domain entities (defined under `apps/api/src/core/domain/`) are never instantiated or used. | `AGENTS.md` / `.ai/ARCHITECTURE.md` (hex-arch mandate) vs. `apps/api/src/core/use-cases/AppUseCases.ts` |
| CR-4 | **Price-snapshot invariant vs. `getBill()` implementation.** The `OrderItem` schema stores `unitPrice` as a snapshot at order time. `getBill()` in `AppUseCases.ts` reads live `menuItem.price` instead of `orderItem.unitPrice`, violating the invariant. | `packages/db/prisma/schema.prisma` (`OrderItem.unitPrice`) vs. `apps/api/src/core/use-cases/AppUseCases.ts` |
| CR-5 | **Schema enum contract vs. runtime string literal.** `AppUseCases.ts` queries `findByQrCode` with `status: 'ACTIVE'`. The Prisma schema `SessionStatus` enum contains `OPEN`, `CLOSED`, `REOPENED`, `FINALIZED` — `ACTIVE` is not a member. This query will never match any row. | `packages/db/prisma/schema.prisma` vs. `apps/api/src/core/use-cases/AppUseCases.ts` |
| CR-6 | **Cancellation lifecycle vs. `UpdateOrderStatusSchema`.** `UpdateOrderStatusSchema` in `packages/shared-validation/src/index.ts` permits `CANCELLED` and `REJECTED` transitions, but the use case does not set `cancelledAt` when either status is applied. Audit log and billing reconciliation will show orders cancelled without a timestamp. | `packages/shared-validation/src/index.ts`, `packages/db/prisma/schema.prisma` vs. `apps/api/src/core/use-cases/AppUseCases.ts` |

---

## 5 — Architectural Violations

> All violations are traceable to specific files. Severity: **CRITICAL** = data loss or correctness risk; **HIGH** = invariant broken; **MEDIUM** = maintainability.

1. **[CRITICAL] Hard delete — `deleteCategory()`.**  
   `PrismaRepositories.ts`: `prisma.menuCategory.delete()`.  
   Rule 19 requires `updateMany({ where: ..., data: { deletedAt: new Date() } })`.  
   Risk: permanent data loss; audit trail destroyed.

2. **[CRITICAL] Hard delete — `deleteMenuItem()` (two call sites).**  
   `PrismaRepositories.ts`: `prisma.menuItem.delete()` called in both `deleteMenuItem` and `deleteItem`.  
   Same mandate and risk as AV-1.

3. **[CRITICAL] `tenantId` omitted on `Session` creation.**  
   `PrismaSessionRepository` does not supply `tenantId` when creating a session.  
   The Prisma schema has `tenantId` as a required relation on `Session`. Runtime insert will throw a foreign-key / not-null violation.

4. **[CRITICAL] `businessDate` omitted on `Session` creation.**  
   `PrismaSessionRepository` does not set `businessDate`.  
   If the column is non-nullable in the schema, every session-open call will fail at the database layer.

5. **[CRITICAL] `tenantId` omitted on `Payment` creation.**  
   `PrismaPaymentRepository.processCheckout` creates a `Payment` row without `tenantId`.  
   Violates multi-tenant data isolation and will fail if the column is non-nullable.

6. **[CRITICAL] `getBill()` reads live price instead of snapshot.**  
   `AppUseCases.ts → getBill()` reads `menuItem.price`.  
   `OrderItem.unitPrice` is the correct snapshot field. Any price change after order placement alters the bill retroactively, violating financial integrity.

7. **[CRITICAL] `findByQrCode` queries on non-existent status `'ACTIVE'`.**  
   `AppUseCases.ts` passes `status: 'ACTIVE'` to the repository query.  
   `SessionStatus` enum: `OPEN | CLOSED | REOPENED | FINALIZED`. This query always returns zero results; QR-code table-open flow is silently broken.

8. **[HIGH] Rich domain entities bypassed.**  
   `TableSession` and `Order` (in `apps/api/src/core/domain/`) implement state machines and invariants (e.g., `TableSession.closeSession()`, `Order` item management).  
   `AppUseCases.ts` never constructs these objects; all mutations go directly to Prisma. Domain invariants are unenforced at runtime.

9. **[HIGH] Monolithic `AppUseCases` class.**  
   `apps/api/src/core/use-cases/AppUseCases.ts` handles 15+ operations spanning ordering, billing, analytics, menu CRUD, and restaurant admin.  
   The three dedicated use-case classes (`GetRestaurantDashboardUseCase`, `GetPlatformDashboardUseCase`, `GetEODAuditReportUseCase`) demonstrate the intended decomposition pattern. `AppUseCases` should be decomposed to match.

10. **[HIGH] `ITableRepository.findByQrCode` returns `Promise<any>`.**  
    `apps/api/src/core/ports/Repositories.ts`: untyped return defeats the port contract and disables compiler-level correctness checks across all callers.

11. **[HIGH] `AppUseCases.createMenuItem` / `updateMenuItem` accept `data: any`.**  
    `apps/api/src/core/use-cases/AppUseCases.ts`: violates strict-TypeScript mandate; shape is validated downstream by Prisma at runtime only.

12. **[MEDIUM] Monolithic bootstrap in `index.ts`.**  
    `apps/api/src/index.ts` (~400 lines) registers all routes, DI bindings, and middleware in a single file.  
    No route modularisation exists beyond the single `authRoute.ts` extraction.

13. **[MEDIUM] `uploadService.ts` has no port interface.**  
    The S3/local dual-mode upload service (`apps/api/src/uploadService.ts`) is not exposed through a named port in `apps/api/src/core/ports/`. It cannot be swapped, mocked, or tested in isolation.

14. **[MEDIUM] `UpdateOrderStatusSchema` permits `CANCELLED`/`REJECTED` without `cancelledAt` write.**  
    Schema field `Order.cancelledAt` exists. Use case does not set it on status transition. Audit and billing reconciliation are compromised.

---

## 6 — Testing Gaps

> Current test count: **3 total** (1 auth route unit test, 1 EOD use-case unit test, 1 health integration test).

1. **Zero tests for `AppUseCases` core paths.**  
   `placeOrder`, `updateOrderStatus`, `getBill`, `processCheckout`, `openSession`, `closeSession` have no test coverage. These are the highest-value, highest-risk paths in the system.

2. **Zero tests for Order domain entity state machine.**  
   `apps/api/src/core/domain/Order.ts` — state transitions (`addItem`, `removeItem`, status guards) are untested.

3. **Zero tests for `TableSession` domain entity.**  
   `TableSession.closeSession()` and related invariants in `apps/api/src/core/domain/` are untested.

4. **Zero tests for `CsvExportAdapter`.**  
   `apps/api/src/adapters/secondary/csv/CsvExportAdapter.ts` — column ordering, escaping, and encoding are untested.

5. **Zero integration tests for non-health routes.**  
   `tests/integration/health.test.ts` is the only integration test. Every HTTP route (auth, tables, sessions, orders, menu, payments, admin) lacks integration coverage.

6. **Zero tests for `PrismaRepositories` adapter layer.**  
   Hard-delete violations (AV-1, AV-2), missing `tenantId` writes (AV-3, AV-5), and missing `businessDate` (AV-4) are all undetected by tests.

7. **Zero tests for `GetRestaurantDashboardUseCase` and `GetPlatformDashboardUseCase`.**  
   Dedicated use-case classes extracted from the monolith have no corresponding test files.

8. **Zero tests for `GetEODAuditReportUseCase` under varied inputs.**  
   `apps/api/src/__tests__/GetEODAuditReportUseCase.test.ts` contains exactly 1 test case. Date-boundary, empty-result, and multi-tenant scenarios are not covered.

9. **Zero tests for `shared-validation` Zod schemas.**  
   `packages/shared-validation/src/index.ts` schemas (`PlaceOrderSchema`, `PaySchema`, `UpdateOrderStatusSchema`, etc.) are not tested for valid/invalid/boundary inputs.

10. **Zero tests for `config.ts` env validation.**  
    `apps/api/src/config.ts` Zod environment schema is not tested for missing or malformed variables.

---

## 7 — Documentation Gaps

| # | Gap | Missing From |
|---|-----|-------------|
| DG-1 | No ADR for price-snapshot invariant (`OrderItem.unitPrice`). The invariant is implicit in the schema but violated in code with no record of the design intent. | `.ai/DECISIONS.md` |
| DG-2 | No ADR or spec for `uploadService.ts` (S3 vs. local toggle, bucket naming, access policy). | `.ai/DECISIONS.md`, `.ai/ARCHITECTURE.md` |
| DG-3 | No ADR or task for RBAC implementation despite `.ai/CURRENT_TASK.md` pointing to it as the active work. Roles, permissions matrix, enforcement layer, and schema changes are undocumented. | `.ai/DECISIONS.md` |
| DG-4 | `businessDate` semantics undefined: which timezone, what rollover time, who is responsible for computing it (client, API, DB default). | `docs/DOMAIN_MODEL.md`, `.ai/DECISIONS.md` |
| DG-5 | `TenantAuditLog` model in schema has no corresponding documentation, port, or use case. Active vs. vestigial status is unknown. | `docs/DOMAIN_MODEL.md`, `.ai/ARCHITECTURE.md` |
| DG-6 | `CsvExportAdapter` output format (column names, ordering, encoding, newline convention) is undocumented. | `docs/ANALYTICS.md` |
| DG-7 | Dual-URL Prisma connection pattern (`DATABASE_URL` + `DIRECT_URL`) validated in `config.ts` is not explained in any runbook or environment guide. | `docs/` (missing file) |
| DG-8 | `docs/PRD.md` and `docs/IMPLEMENTATION_MAP.md` carry no last-reviewed date or schema version tag. Staleness cannot be assessed by inspection alone. | `docs/PRD.md`, `docs/IMPLEMENTATION_MAP.md` |
| DG-9 | `.ai/AI_RULES.md` (1 258 bytes) is a strict subset of `.ai/AGENTS.md`. The relationship between the two files (which is canonical, which is the read target for AI agents) is not stated in either file. | `.ai/AI_RULES.md`, `.ai/AGENTS.md` |
| DG-10 | Session status enum values (`OPEN`, `CLOSED`, `REOPENED`, `FINALIZED`) are not documented in `.ai/ARCHITECTURE.md` (which incorrectly states `ACTIVE`). No state-transition diagram exists for session lifecycle. | `.ai/ARCHITECTURE.md`, `docs/DOMAIN_MODEL.md` |

---

## Findings Summary

| Category | Count | Critical |
|----------|-------|---------|
| Duplicated Knowledge | 4 | — |
| Missing Knowledge | 7 | — |
| Outdated Knowledge | 4 | — |
| Contradicting Rules | 6 | 3 |
| Architectural Violations | 14 | 7 |
| Testing Gaps | 10 | — |
| Documentation Gaps | 10 | — |
| **Total** | **55** | **10** |

> [!CAUTION]
> The 7 CRITICAL architectural violations (AV-1 through AV-7) involve data loss, broken multi-tenant isolation, and a permanently silent QR-code flow. These must be remediated before any further feature work.
