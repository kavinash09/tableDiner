# TableDiner Event-Driven Analytics: Migration Risk Assessment

**Document**: `migration-risk-assessment.md`  
**Role**: Principal Systems Architect, Risk & Security Specialist  
**Status**: Comprehensive Risk & Mitigation Matrix  
**Date**: 2026-10-09  

---

## 1. Executive Summary

Transitioning an active transactional platform to an event-driven architecture introduces operational, performance, and cognitive risks. This document assesses each potential hazard across:
1. Probability of Occurrence
2. Severity of Business Impact
3. Automated Safeguards & Architectural Mitigations
4. Fallback & Recovery Procedures

---

## 2. Risk Matrix & Detailed Risk Evaluation

| Risk ID | Hazard Description | Severity | Probability | Overall Risk Level |
|---|---|---|---|---|
| **R-01** | Operational Write Latency Overhead | Low | High | 🟡 Medium |
| **R-02** | SQLite Database Lock Contention | Medium | Medium | 🟡 Medium |
| **R-03** | Eventual Consistency UX Desynchronization | Medium | High | 🟡 Medium |
| **R-04** | Duplicate Event Processing (Double Counting)| Critical | Low | 🔴 High |
| **R-05** | Historical Data Omission / Discontinuity | High | Medium | 🔴 High |
| **R-06** | Outbox Worker Stall / Poison Pill | High | Low | 🟡 Medium |
| **R-07** | Developer Cognitive Load & Debugging Complexity | Medium | High | 🟡 Medium |

---

### Detailed Assessment & Mitigation Protocols

---

### Risk R-01: Operational Write Latency Overhead
- **Hazard**: Appending an event to the `AnalyticsEvent` table inside the operational transaction increases the latency of diner order placement (`POST /table/:qrCode/order`) and bill payment (`POST /table/:qrCode/pay`).
- **Technical Analysis**: In SQLite, appending a single row to a table with an active index adds approximately $0.8\text{ms} - 1.5\text{ms}$ of disk I/O.
- **Severity**: Low (Diners do not perceive a 1ms latency delta).
- **Mitigation Control**:
  - Keep outbox event payloads compact and strictly denormalized (avoid deep nested object graph lookups during write).
  - Use UUIDv7 identifiers so inserts cluster sequentially at the end of the B-Tree index without random page splits.
- **Fallback**: If write latency exceeds 50ms, outbox writes can be buffered in an in-memory queue with an asynchronous transaction flush.

---

### Risk R-02: SQLite Database Lock Contention
- **Hazard**: SQLite enforces a single-writer concurrency model. If the background relay daemon is reading from `AnalyticsEvent` while diners and kitchen staff are simultaneously committing transactions, `SQLITE_BUSY: database is locked` errors could occur.
- **Technical Analysis**: In legacy Rollback Journal mode, reads and writes mutually block.
- **Severity**: Medium (Could cause 500 Internal Server Errors on dining checkout).
- **Mitigation Control**:
  - **Mandatory WAL Mode**: Ensure SQLite operates in WAL mode (`PRAGMA journal_mode = WAL;`). In WAL mode, **readers never block writers, and writers never block readers**.
  - **Busy Timeout**: Configure `PRAGMA busy_timeout = 5000;` on all Prisma database connections, allowing SQLite to wait up to 5 seconds for lock release rather than immediately throwing an exception.
  - **Batch Sizing**: The outbox worker reads in small, controlled batches (100 events max) and yields the event loop tick before processing.
- **Fallback**: Increase busy timeout or transition to PostgreSQL (Option B) if concurrency exceeds 100 simultaneous active restaurant locations.

---

### Risk R-03: Eventual Consistency UX Desynchronization
- **Hazard**: A cashier collects a cash payment, immediately flips to the Daily Dashboard tab, and does not see the revenue figure updated for 500ms to 2000ms.
- **Technical Analysis**: Because read models are updated out-of-band by the outbox relay, there is an inherent processing latency delta between operational commit and projection update.
- **Severity**: Medium (Cashier perceives a "laggy" or "broken" system and refreshes the browser repeatedly).
- **Mitigation Control**:
  - **Sub-Second Relay Cycle**: Configure the in-process outbox daemon to poll every 500ms, ensuring 95% of events are projected in under 800ms.
  - **UI Optimistic Notification**: The admin frontend displays a subtle, live *"Syncing..."* indicator or relies on client-side state cache updates.
  - **Dual-Read Reconciliation**: The dashboard route handler can verify if the projection watermark is within 5 seconds of the current timestamp. If lag is detected, it falls back to a fast live delta query.
- **Fallback**: Provide a manual "Force Refresh" button that triggers an instantaneous outbox drain for that specific restaurant.

---

### Risk R-04: Duplicate Event Processing (Double Counting)
- **Hazard**: The outbox daemon processes an event, increments `grossRevenue` in `AggDailyFinancialSummary`, but crashes before saving its checkpoint. Upon restart, it re-reads the event and adds the revenue a second time.
- **Technical Analysis**: At-least-once delivery guarantees inevitably produce duplicate deliveries in failure recovery scenarios.
- **Severity**: Critical (Financial reports and EOD cash audits become corrupted and overstated).
- **Mitigation Control**:
  - **Atomic Checkpoint Commit**: The projector updates the materialized summary row AND the projector checkpoint table within the **same atomic database transaction**.
  - **Idempotency Enforcement**: The projection update uses an idempotency check:
    ```sql
    INSERT INTO AnalyticsProjectorLedger (projectorName, eventId) VALUES ('FinancialProjector', $eventId);
    ```
    If the `eventId` already exists in the ledger, the update is skipped (`ON CONFLICT DO NOTHING`).
  - **Nightly Reconciliation**: Automated cron verifies projections against raw immutable event logs and self-heals any divergence.
- **Fallback**: Automated rollback of the projection table and full deterministic replay from event store genesis.

---

### Risk R-05: Historical Data Omission / Discontinuity
- **Hazard**: Switching dashboards to read models leaves past weeks and months with empty metrics because events only started recording after deployment.
- **Technical Analysis**: Materialized views require historical events to represent historical metrics accurately.
- **Severity**: High (Historical comparison charts and monthly revenue reports break).
- **Mitigation Control**:
  - **Synthetic Historical Backfill Script**: Prior to cutover, execute `packages/db/scripts/backfill-historical-events.ts`. The script traverses completed legacy `Session` and `Order` rows, constructs valid synthetic historical domain events, and appends them to `AnalyticsEvent` with historical `occurredAt` timestamps.
  - The projectors then run in historical batch mode to populate all past daily summaries.
- **Fallback**: Dual-Read routing: queries for dates prior to the cutover date transparently route to the legacy relational query adapter.

---

### Risk R-06: Outbox Worker Stall / Poison Pill
- **Hazard**: An event with a malformed payload or missing required field throws an uncaught exception in a projector, halting the outbox worker and freezing all analytics updates.
- **Technical Analysis**: An unhandled rejection in the polling loop starves downstream processing.
- **Severity**: High (Analytics platform stops updating).
- **Mitigation Control**:
  - **Strict Try/Catch & Error Isolation**: Projectors wrap individual event processing in try/catch blocks.
  - **Dead Letter Queue (DLQ)**: If an event fails processing 3 consecutive times with exponential backoff, it is quarantined in `analytics_dlq_events` and the worker advances to the next event.
  - **Liveness Monitoring**: The `/health` endpoint reports outbox worker heartbeat and current watermark lag.
- **Fallback**: Operators can inspect, repair, and re-inject DLQ events via an admin API route.

---

### Risk R-07: Developer Cognitive Load & Debugging Complexity
- **Hazard**: New engineers or AI agents struggle to trace how a metric is calculated because the business logic is split between operational entities, outbox tables, relay workers, and materialized views.
- **Technical Analysis**: Event-driven systems have higher indirection than monolithic procedural code.
- **Severity**: Medium (Slower onboarding, accidental omission of outbox writes in new features).
- **Mitigation Control**:
  - **Rich Domain Entity Encapsulation**: Rule 21 enforcement ensures developers mutate state through domain entity methods (e.g. `order.markServed()`), which automatically stage their own domain events. Developers do not need to manually craft SQL event records.
  - **Architecture Governance Documentation**: Keep `.ai/knowledge/` and `event-taxonomy.md` authoritative and synchronized.
  - **Architecture Linter / Unit Tests**: Static unit tests verify that every domain entity state transition method emits at least one domain event.
- **Fallback**: Clear, unambiguous step-by-step developer guidelines maintained in `maintenance-checklist.md`.
