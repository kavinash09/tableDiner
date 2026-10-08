# TableDiner Event-Driven Analytics: Recommended Evolution Roadmap

**Document**: `recommended-evolution-roadmap.md`  
**Role**: Principal Architect  
**Status**: Strategic Evolutionary Architecture Roadmap  
**Date**: 2026-10-09  

---

## 1. Architectural Philosophy: Progressive Enhancement

A common failure mode in modern software engineering is building an enterprise-scale distributed architecture (Kafka, microservices, separate OLAP clusters) before the product has achieved the scale to justify it. This incurs massive operational overhead, high infrastructure bills, and degraded developer velocity.

TableDiner follows the **Principle of Progressive Evolutionary Architecture**:

> **Start with the simplest architecture that completely solves the immediate problem, while structuring interfaces so that each future evolutionary step requires zero rewrites of core domain logic.**

```
[ Phase 1: PostgreSQL Outbox ] ───► [ Phase 2: Scalable SaaS ] ──────► [ Phase 3: Dedicated OLAP ] ──────► [ Phase 4: Enterprise Streaming ]
- PostgreSQL (Docker Dev / RDS Prod) - Dedicated Worker Process           - ClickHouse / DuckDB OLAP           - Managed Event Broker
- In-Process Outbox Relay (SKIP LOCKED) - Read Replica Isolation          - Dedicated Analytics API            - Multi-Region Partitioning
- Materialized Read Tables in Postgres - 100+ Concurrent Restaurants       - Sub-Second Multi-Year Slicing      - Real-Time AI / ML Pipeline
- Dev/Prod Dialect Parity            - < $50 / Month Cost                 - < $250 / Month Cost                - Enterprise Infrastructure
```

---

## 2. Phased Evolutionary Roadmap & Justification Triggers

---

### Phase 1: Foundation & PostgreSQL Event Outbox (Unified Dev/Prod Parity)

- **Target Architecture**:
  - Primary Database: **PostgreSQL 16**.
    - *Local Development*: PostgreSQL running via Docker container with host volume mapping (`.postgres_data`).
    - *Production*: Managed PostgreSQL (AWS RDS PostgreSQL, Supabase, Neon, or Cloud SQL).
  - Adds `AnalyticsEvent` outbox table and pre-aggregated read projection tables directly in PostgreSQL.
  - Leverages PostgreSQL's native **`FOR UPDATE SKIP LOCKED`** for non-blocking concurrent outbox polling.
  - Leverages native **`JSONB`** for event payloads and native timestamp interval arithmetic (`EXTRACT(EPOCH FROM ...)`).
  - An asynchronous background worker daemon runs in-process inside Fastify API server on an event loop tick.
  - Outbox appends commit in the same atomic `prisma.$transaction` as operational writes.
  - Dashboard routes perform instantaneous $O(1)$ primary key lookups.
- **Infrastructure Impact**:
  - Dev: Single Docker container run with volume mapping. Zero external cloud costs.
  - Prod: Standard managed PostgreSQL RDS instance.
- **Capacity**: Up to **150+ concurrent restaurants** (~1,000,000+ events / month).
- **Justification Criteria (Why Start Here)**:
  - Eliminates SQLite single-writer table locks entirely.
  - Ensures 100% SQL dialect parity between local development and production.
  - Unlocks native JSONB indexing and non-blocking `SKIP LOCKED` outbox consumption immediately.

---

### Phase 2: Scalable Multi-Tenant Analytics (PostgreSQL + Dedicated Worker)

- **Target Architecture**:
  - Migrate primary database from SQLite to **PostgreSQL**.
  - Separate the background relay daemon into a **dedicated worker process** (`apps/worker`), decoupling background compute from Fastify HTTP request threads.
  - Introduce an **Outbox Table with SKIP LOCKED**:
    ```sql
    SELECT * FROM "AnalyticsEvent"
    WHERE status = 'PENDING'
    ORDER BY "occurredAt" ASC
    LIMIT 100
    FOR UPDATE SKIP LOCKED;
    ```
    Allows multiple concurrent worker instances to process events in parallel without race conditions.
  - Enable **Read Replicas**: Dashboard queries read from a read replica, ensuring 100% compute and I/O isolation from the primary write database.
- **Infrastructure Impact**:
  - Managed PostgreSQL instance (e.g. AWS RDS, Supabase, Neon) with 1 read replica.
  - Cost: **$40 – $100 / month**.
- **Capacity**: **50 to 500 active restaurants** (~5,000,000 events / month).
- **Clear Decision Trigger Points (When Phase 2 Becomes Justified)**:
  1. Active restaurant count exceeds **30 locations**.
  2. Transactional write volume exceeds **50 writes / second** during peak dinner rush, causing SQLite lock wait alerts.
  3. Database file size exceeds **10 GB**.
  4. Team requires horizontal autoscaling of the Fastify API across multiple server instances (SQLite cannot be shared across multiple server nodes).

---

### Phase 3: Dedicated Analytics Platform (Columnar OLAP Store)

- **Target Architecture**:
  - Decouple analytics storage from PostgreSQL into a **dedicated columnar OLAP database** (e.g. **ClickHouse** or embedded **DuckDB**).
  - Operational PostgreSQL database writes events to the outbox table.
  - A sync daemon streams committed events into ClickHouse.
  - Deploy the **Universal Semantic Query DSL** (`POST /api/v1/analytics/query`).
  - Columnar vectorization enables sub-second aggregations, multi-year trend queries, and dynamic multi-dimensional slicing over 50M+ events without pre-aggregated summary tables.
- **Infrastructure Impact**:
  - ClickHouse cloud instance or embedded DuckDB node + sync daemon.
  - Cost: **$150 – $350 / month**.
- **Capacity**: **500 to 5,000 active restaurants** (~100,000,000 events / month).
- **Clear Decision Trigger Points (When Phase 3 Becomes Justified)**:
  1. Active restaurant count exceeds **250 locations**.
  2. Restaurant owners demand complex custom date range queries spanning 1–3 years (e.g. *"Compare cocktail sales every Friday night across all 12 months"*).
  3. Analytical queries on PostgreSQL read replicas begin requiring expensive table scans that exceed 1000ms.
  4. Storage costs for row-based relational event tables grow prohibitively (ClickHouse provides 90%+ compression over row stores).

---

### Phase 4: Enterprise-Scale Streaming Architecture (Distributed Event Broker)

- **Target Architecture**:
  - Replace database-polling outbox relay with a **distributed event streaming broker** (e.g. **Kafka**, **AWS Kinesis**, or **Redis Streams**) fed via Change Data Capture (Debezium).
  - Implement partitioned event topics (`tablediner.events.dining`, `tablediner.events.kitchen`, `tablediner.events.payment`) partitioned by `tenantId`.
  - Independent microservice consumer groups:
    - Analytics Service (ClickHouse ingestion)
    - Real-Time Push Service (WebSockets / SSE to kitchen tablets)
    - Fraud & Audit Service
    - Marketing & Loyalty Engine
  - Real-time machine learning pipelines (dynamic menu pricing, prep time forecasting).
- **Infrastructure Impact**:
  - Managed Kafka/Confluent cluster + multi-node worker clusters + ClickHouse cluster.
  - Cost: **$500 – $2,000+ / month**.
  - Requires dedicated Site Reliability Engineering (SRE) support.
- **Capacity**: **5,000 to 50,000+ franchise locations** (Billions of events / month).
- **Clear Decision Trigger Points (When Phase 4 Becomes Justified)**:
  1. TableDiner signs enterprise multi-brand national franchise chains (e.g. 1,000+ outlets simultaneously).
  2. Multiple downstream services require real-time event feeds (marketing automation, inventory ERP integrations, external accounting systems).
  3. Cross-region multi-cloud active-active deployments are legally or contractually mandated.

---

## 3. Evolutionary Decision Matrix

| Dimension | Phase 1: Pilot Starter | Phase 2: Scalable SaaS | Phase 3: Dedicated OLAP | Phase 4: Enterprise Streaming |
|---|---|---|---|---|
| **Primary Goal** | Stop OLTP lock contention & simplify queries | Scale to hundreds of restaurants | Self-serve multi-year dynamic slicing | Global franchise real-time ecosystem |
| **Operational DB** | SQLite (WAL mode) | PostgreSQL Primary + Replica | PostgreSQL Primary | PostgreSQL / Aurora |
| **Analytics Store** | Materialized Views in SQLite | Materialized Views in Postgres | ClickHouse / DuckDB Columnar | ClickHouse / Snowflake |
| **Relay Mechanism** | In-Process Node.js interval | Dedicated Worker Process | Outbox Sync Daemon | Kafka / Redis Streams / CDC |
| **Monthly Cost** | **$0.00** | $40 – $100 | $150 – $350 | $500 – $2,000+ |
| **Target Scale** | 1 – 30 restaurants | 30 – 250 restaurants | 250 – 2,000 restaurants | 2,000+ restaurants |
| **Trigger Metric** | Immediate deployment | > 30 stores OR multi-node API | > 250 stores OR slow OLAP | > 2,000 stores OR external pub/sub |

---

## 4. Strategic Recommendation for Immediate Execution

**Proceed with Phase 1 immediately:**
1. Zero infrastructure cost.
2. Zero risk to existing deployments.
3. Clean Hexagonal Architecture boundaries ensure that when the Phase 2 trigger is reached (migrating from SQLite to PostgreSQL), only the secondary adapter implementation is swapped, preserving 100% of the domain entity logic and event taxonomy.
