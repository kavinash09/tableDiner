# TableDiner Event-Driven Analytics: Infrastructure Impact Report

**Document**: `infrastructure-impact-report.md`  
**Role**: Principal Architect  
**Status**: Infrastructure Strategy Evaluation  
**Date**: 2026-10-09  

---

## 1. Executive Summary

This report evaluates three architectural options for implementing event-driven analytics in TableDiner:
- **Option A**: Same Database + In-Process Outbox & Background Worker
- **Option B**: Separate Analytics Database + CDC / Extraction Worker
- **Option C**: Distributed Event Broker Architecture (Kafka / RabbitMQ / Redis Streams)

Each option is rigorously scored across Complexity, Financial Cost, Operational Burden, Scalability, and Suitability for TableDiner's current Pilot/Starter stage.

---

## 2. Deep Evaluation of Architectural Options

---

### Option A: Same Database + Event Table + In-Process Background Worker

```
┌────────────────────────────────────────────────────────┐
│ Fastify API Monolith Process (Node.js)                 │
│                                                        │
│  HTTP Handler ──► Interactive Transaction ─────────┐   │
│                          │                         │   │
│                          ▼                         ▼   │
│  In-Process Relay ◄── SQLite DB (WAL) ◄────────────┘   │
│  (setInterval Tick)  ├── Operational Tables            │
│       │              ├── `analytics_events` (Outbox)   │
│       ▼              └── Materialized Read Projections │
│  Projectors ─────────┘                                 │
└────────────────────────────────────────────────────────┘
```

- **Architecture Details**:
  - The Event Store (`analytics_events`) and Projection tables live inside the existing SQLite database (`tablediner.db`).
  - Operational mutations and outbox event appends commit in the **exact same ACID database transaction** (`prisma.$transaction`).
  - An asynchronous background worker runs inside the existing Fastify Node.js process using a lightweight tick interval (every 500ms).
  - When the worker ticks, it reads unforwarded events ordered by UUIDv7, invokes domain projectors, updates projection rows, and advances the checkpoint.
- **Complexity**: **Low (Score: 2/10)**.
  - Zero new infrastructure to provision, configure, or monitor.
  - No network boundaries, no distributed transactions, no serialization overhead.
- **Financial Cost**: **$0.00 / month (Zero incremental cost)**.
  - Runs on existing hardware/VM. No cloud database fees, no broker instances.
- **Operational Burden**: **Minimal (Score: 2/10)**.
  - Deployment is identical: `pnpm run dev` or `node dist/index.js`.
  - Backups remain a single SQLite database file copy.
  - Debugging is local and synchronous; zero distributed tracing required.
- **Scalability**: **Moderate**.
  - Handles up to **50–100 active restaurants** with ~200,000 to 500,000 events/month.
  - In SQLite with WAL mode (`PRAGMA journal_mode = WAL`), readers do not block writers and writers do not block readers. Write transactions take < 2ms.
  - Bottleneck: SQLite is single-writer. If write volume exceeds 500 writes/second continuously, lock queueing occurs.
- **Suitability for Current Stage**: **EXCEPTIONAL (10/10 - Strongly Recommended)**.
  - Maximizes business value, eliminates OLTP query contention, and establishes the event-driven data model with zero operational overhead.

---

### Option B: Separate Analytics Database (Physical / Logical Separation)

```
┌────────────────────────────────────────────────────────┐
│ Fastify API Process                                    │
│  HTTP Handler ──► Operational DB (SQLite / Postgres)   │
│                         │ (Outbox Table)               │
└─────────────────────────┼──────────────────────────────┘
                          │ Polling / CDC Sync Worker
                          ▼
┌────────────────────────────────────────────────────────┐
│ Dedicated Analytics DB (PostgreSQL / DuckDB / Supabase)│
│  ├── `analytics_events`                                │
│  └── Materialized Projection Tables                    │
└────────────────────────────────────────────────────────┘
```

- **Architecture Details**:
  - Operational transactions write to the primary database (`tablediner.db`).
  - An outbox table captures events in the primary database.
  - A separate extraction process or worker reads events and syncs them over the network to a secondary database dedicated exclusively to analytics.
  - Dashboard queries target the secondary database, ensuring zero load on the primary.
- **Complexity**: **Medium (Score: 6/10)**.
  - Requires maintaining two database connection pools, dual Prisma clients, and separate schema migrations.
  - Must handle network partitions between the primary API and the analytics database.
- **Financial Cost**: **$20 – $80 / month**.
  - Managed PostgreSQL instance (e.g. AWS RDS, Supabase, Neon) or dedicated server storage.
- **Operational Burden**: **Moderate (Score: 5/10)**.
  - Two database backup routines, connection pooling tuning, latency monitoring between databases.
  - Dual migrations must be kept synchronized across deployments.
- **Scalability**: **High**.
  - Easily supports **100 – 500 active restaurants** (millions of events/month).
  - Primary database is 100% reserved for dining orders and payments. Analytics queries never touch operational I/O.
- **Suitability for Current Stage**: **Premature for Pilot, Ideal for Growth Stage (6/10)**.
  - Adds unnecessary network and dual-database maintenance friction while TableDiner is in pilot validation.

---

### Option C: Distributed Event Broker Architecture (Kafka / RabbitMQ / Redis Streams)

```
┌────────────────────────────────────────────────────────┐
│ Fastify API Monolith                                   │
│  HTTP Handler ──► Primary DB ──► Outbox                │
└───────────────────────┬────────────────────────────────┘
                        │ Debezium / Outbox Publisher
                        ▼
┌────────────────────────────────────────────────────────┐
│ Distributed Event Broker (Kafka / Redis Streams / NATS)│
│  Topic: `tablediner.events.v1` (Partitioned by Tenant) │
└───────────────────────┬────────────────────────────────┘
                        │ Consumer Group Workers
                        ▼
┌────────────────────────────────────────────────────────┐
│ Standalone Analytics Service + Columnar OLAP Store     │
│ (ClickHouse / TimescaleDB)                             │
└────────────────────────────────────────────────────────┘
```

- **Architecture Details**:
  - Transactional Outbox pattern feeds an event streaming broker (Kafka, AWS Kinesis, or Redis Streams) via Change Data Capture (Debezium) or a polling daemon.
  - Multiple decoupled consumer worker instances consume partitioned topic streams.
  - Dedicated analytical workers maintain projections in a specialized columnar OLAP database (e.g. ClickHouse).
- **Complexity**: **Very High (Score: 9/10)**.
  - Distributed systems failure modes: split-brain, consumer group rebalancing, poison pill deadlocks, partition reordering, schema registry governance.
  - Requires specialized DevOps expertise and complex distributed tracing.
- **Financial Cost**: **$200 – $800+ / month**.
  - Managed Kafka/Confluent cluster + multi-node worker compute + managed ClickHouse / TimescaleDB.
- **Operational Burden**: **High (Score: 9/10)**.
  - Monitoring consumer lag, broker broker disk saturation, ZooKeeper/KRaft quorum, network topologies.
  - Local development requires running multiple Docker containers (Kafka, Zookeeper, Schema Registry, ClickHouse).
- **Scalability**: **Extreme (Millions of events / second)**.
  - Built for national/global enterprise restaurant chains with tens of thousands of simultaneous locations.
- **Suitability for Current Stage**: **POOR (1/10 - Massive Anti-Pattern / Premature Optimization)**.
  - Introducing Kafka or a distributed broker at TableDiner's current stage would massively increase development cycle times, inflate cloud costs, and create fatal operational distraction without delivering any additional business value.

---

## 3. Comparative Evaluation Matrix

| Criterion | Option A: Same DB (In-Process) | Option B: Separate Analytics DB | Option C: Event Broker (Kafka/Streams) |
|---|---|---|---|
| **Architectural Complexity** | 🟢 Low (2/10) | 🟡 Medium (6/10) | 🔴 Very High (9/10) |
| **Incremental Infrastructure Cost**| 🟢 **$0 / month** | 🟡 $20 – $80 / mo | 🔴 $200 – $800+ / mo |
| **Operational Overhead** | 🟢 Minimal (Single process) | 🟡 Moderate (Dual DB) | 🔴 High (Distributed systems) |
| **Development Velocity Impact** | 🟢 Zero friction | 🟡 Moderate friction | 🔴 High friction (Docker clusters) |
| **Transaction Atomicity** | 🟢 **100% Native ACID** | 🟡 Outbox required | 🔴 Outbox + CDC required |
| **Eventual Consistency Latency** | 🟢 **< 500ms** | 🟡 1s – 5s | 🟡 500ms – 2s |
| **Capacity (Active Restaurants)** | 1 – 100 locations | 50 – 500 locations | 500 – 50,000+ locations |
| **Suitability for Current Stage** | 🟢 **RECOMMENDED (10/10)** | 🟡 Stage 2 Horizon | 🔴 NOT RECOMMENDED (1/10) |

---

## 4. Architectural Verdict & Strategic Recommendation

### The Recommendation: Option A + PostgreSQL (Unified Dev/Prod Parity)

Based on the decision to adopt **PostgreSQL** across all environments:
1. **Local Development**: PostgreSQL running via a Docker container with external persistent volume mapping (`.postgres_data`).
2. **Production**: Managed PostgreSQL service (AWS RDS PostgreSQL, Supabase, Neon, or Cloud SQL).
3. **Analytics Model**: Option A (Event Outbox + Materialized Read Projections) on PostgreSQL, benefiting from MVCC row-level locking, native `JSONB`, and `SKIP LOCKED` worker queues.

---

## 5. PostgreSQL Deployment & Migration Blueprint

### 5.1 Local Dev Setup via Docker (with External Volume Mapping)

*(Per AI Rule 18, all container execution instructions are provided inline rather than as standalone configuration files.)*

To start the local PostgreSQL instance with persistent data stored on your host machine:

```bash
# 1. Create the external data directory (git-ignored)
mkdir -p .postgres_data

# 2. Run the PostgreSQL 16 container with external volume mapping
docker run -d \
  --name tablediner-postgres \
  --restart unless-stopped \
  -e POSTGRES_USER=tablediner \
  -e POSTGRES_PASSWORD=tablediner_secret \
  -e POSTGRES_DB=tablediner \
  -p 5432:5432 \
  -v "$(pwd)/.postgres_data:/var/lib/postgresql/data" \
  postgres:16-alpine
```

### 5.2 Environment Variable Configuration

In `.env` and `apps/api/.env`:

```env
DATABASE_URL="postgresql://tablediner:tablediner_secret@localhost:5432/tablediner?schema=public"
```

### 5.3 Prisma Schema Provider Configuration

In `packages/db/prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 5.4 Key Advantages of PostgreSQL for Event-Driven Analytics

1. **Elimination of Single-Writer Lock Contention**:
   SQLite only allows one write transaction at a time. PostgreSQL uses Multi-Version Concurrency Control (MVCC) with row-level locking, allowing high-throughput concurrent checkout writes and event appends without blocking.
2. **`FOR UPDATE SKIP LOCKED` for Outbox Processing**:
   PostgreSQL natively supports concurrent outbox consumption:
   ```sql
   SELECT * FROM "AnalyticsEvent"
   WHERE status = 'PENDING'
   ORDER BY "occurredAt" ASC
   LIMIT 100
   FOR UPDATE SKIP LOCKED;
   ```
   Multiple workers or Fastify nodes can process events concurrently with zero duplicate processing.
3. **Native `JSONB` for Event Payloads**:
   Event payloads can be stored as binary JSON (`Json` in Prisma / `JSONB` in Postgres), enabling GIN indexing and fast analytical querying directly on event properties.
4. **Native Interval Arithmetic for SLA and Turn-Time Metrics**:
   In `PrismaRestaurantAnalyticsRepository`:
   ```sql
   SELECT 
     SUM(CASE WHEN "closedAt" > "createdAt" THEN EXTRACT(EPOCH FROM ("closedAt" - "createdAt")) / 60.0 ELSE 0.0 END) as "totalOccupiedMinutes"
   FROM "Session"
   WHERE "restaurantId" = $1 AND "businessDate" = $2 AND "status" != 'OPEN' AND "closedAt" IS NOT NULL;
   ```
5. **Production Parity**:
   Code and queries developed against local Docker PostgreSQL behave identically when deployed to AWS RDS PostgreSQL or managed cloud database services in production.

