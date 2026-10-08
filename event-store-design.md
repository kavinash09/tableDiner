# TableDiner Analytics Event Store Design

**Document**: `event-store-design.md`  
**Role**: Principal Systems Architect, Principal Analytics Architect  
**Status**: Technical Architecture & Storage Specification  
**Date**: 2026-10-09  

---

## 1. Core Architecture & Guarantees

The **Analytics Event Store** is the single immutable source of truth for all historical facts across TableDiner. It is engineered with five non-negotiable guarantees:

1. **Strict Immutability**: The storage engine forbids SQL `UPDATE` and `DELETE` operations. An event once written can never be changed.
2. **Append-Only Write Model**: Events are committed chronologically in append-only logs.
3. **Multi-Tenant Physical & Logical Isolation**: Every row is strictly partitioned by `tenantId` and `restaurantId`.
4. **Time-Ordered Queryability**: Uses monotonically increasing UUIDv7 / ULID identifiers combined with millisecond-precision timestamps.
5. **Auditable & Tamper-Evident**: Each event record incorporates a cryptographic hash chained to the preceding event in the tenant stream, guaranteeing mathematical non-repudiation.

---

## 2. Relational Schema Specification (`analytics_events`)

The Event Store is modeled as a first-class table in the database schema (`packages/db/prisma/schema.prisma`):

```prisma
model AnalyticsEvent {
  id              String   @id // UUIDv7: 36-char time-sortable string
  tenantId        String
  restaurantId    String
  businessDate    String   // YYYY-MM-DD operational business date
  
  eventName       String   // e.g. "kitchen.order.served"
  schemaVersion   String   @default("1.0.0") // SemVer
  
  // Causality and Distributed Tracing
  entityType      String   // "Session" | "Order" | "Payment" | "Table" | "MenuItem"
  entityId        String   // Primary key of affected domain aggregate
  causationId     String?  // Event ID that triggered this event
  correlationId   String   // Trace token linking the end-to-end user journey
  idempotencyKey  String   @unique // Enforces exactly-once persistence
  
  // Dual Timestamps
  occurredAt      DateTime // Physical time event occurred in the real world
  recordedAt      DateTime @default(now()) // Event store commit timestamp
  
  // Strongly-Typed JSON Payloads
  payload         String   // Stringified JSON containing domain state
  metadata        String   // Stringified JSON containing actor, device, IP context
  
  // Tamper-Evident Integrity
  sequenceNumber  BigInt   // Monotonic sequence within tenant stream
  prevEventHash   String?  // SHA-256 hash of previous event in sequence
  eventHash       String   // SHA-256(prevEventHash + id + tenantId + eventName + payload)

  // Tenant Boundary Relationship
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  restaurant      Restaurant @relation(fields: [restaurantId], references: [id], onDelete: Restrict)

  @@index([tenantId, restaurantId, occurredAt])
  @@index([tenantId, businessDate, eventName])
  @@index([tenantId, entityType, entityId])
  @@index([eventName, occurredAt])
  @@index([occurredAt])
}
```

---

## 3. Storage Fields & Typings Rationale

### 3.1 Time-Sortable UUIDv7 Identifier
- **Why UUIDv7**: Standard UUIDv4 is completely random, causing severe B-Tree index fragmentation and high cache page thrashing during high-volume inserts.
- UUIDv7 embeds a 48-bit Unix timestamp prefix followed by cryptographically random bits. This ensures chronological physical index clustering in SQLite/PostgreSQL, reducing write amplification and accelerating range scans on recent events by up to 400%.

### 3.2 Dual-Timestamp Semantics (`occurredAt` vs `recordedAt`)
- **`occurredAt`**: Captures when the event happened in the real world (e.g., when the kitchen chef tapped "Mark Ready" on the physical tablet). Critical for true operational SLA duration calculations.
- **`recordedAt`**: Captures when the event was committed to the database log. Critical for streaming outbox ingestion, pipeline replay, and catching up downstream projectors after network partitions.

### 3.3 Payload Strategy: Self-Contained Document JSON
- Relational schemas struggle when domain entities change. By storing the domain state in a structured `payload` string (or JSON column in PostgreSQL), event schemas remain self-contained.
- **Strict Invariant**: Payloads must be snapshot-complete. They must contain all relevant dimensional attributes (e.g. `categoryName`, `itemName`, `unitPrice`, `tableName`) at the instant of event creation, protecting analytics against future catalog modifications.

---

## 4. Tamper-Evident Cryptographic Hash Chaining

To satisfy enterprise compliance, financial auditability, and tamper detection, the Event Store maintains a **per-tenant cryptographic blockchain**:

```
[Event N-1]                                [Event N]
┌───────────────────────────────┐          ┌───────────────────────────────┐
│ id: 018e22...                 │          │ id: 018e23...                 │
│ sequenceNumber: 1042          │          │ sequenceNumber: 1043          │
│ prevEventHash: "a4f8..."      │          │ prevEventHash: "b7e1..." ◄────┼── Points to
│ eventHash:     "b7e1..." ─────┼─────────►│ eventHash:     "c9d3..."      │   Event N-1's
└───────────────────────────────┘          └───────────────────────────────┘   eventHash
```

### Verification Algorithm:
1. When appending `Event N`, the repository fetches `prevEventHash = Event(N-1).eventHash`.
2. Computes:
   $$\text{eventHash}_N = \text{SHA256}(\text{prevEventHash} + \text{id}_N + \text{tenantId} + \text{eventName} + \text{occurredAt} + \text{payload})$$
3. If any past row in the database is modified or deleted by an unauthorized database operator, the hash chain breaks immediately, triggering a critical audit alarm in the platform dashboard.

---

## 5. Storage Engine Progression Strategy

```
               [ Phase 1 & 2: MVP / Starter ]
               SQLite / Embedded Relational Table
               (Same DB, Zero Operational Complexity)
                                 │
                                 ▼
               [ Phase 3: Single-Tenant Scale ]
               PostgreSQL + BRIN Indexing
               (Logical Schema Isolation, TimescaleDB Hypertables)
                                 │
                                 ▼
               [ Phase 4: Enterprise SaaS Scale ]
               Dedicated OLAP Columnar Store (ClickHouse / BigQuery)
               (Trillion-row real-time analytical slicing & vectorization)
```

### 5.1 MVP / Starter Phase (SQLite)
- Uses SQLite with WAL (Write-Ahead Logging) enabled.
- `analytics_events` lives alongside transactional tables.
- B-Tree indexes on `[tenantId, businessDate, eventName]` and `[occurredAt]` allow instant streaming queries for asynchronous projection workers.

### 5.2 Enterprise SaaS Phase (ClickHouse / TimescaleDB)
- **Engine**: ClickHouse `ReplacingMergeTree` or `MergeTree`.
- Partitioned by `toYYYYMM(occurredAt)` and clustered by `(tenantId, restaurantId, eventName)`.
- Columnar compression yields a 90%+ storage reduction compared to raw row storage, allowing sub-second aggregations over 100M+ events.

